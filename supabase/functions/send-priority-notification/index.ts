import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
}

type EventInput = { module:string; entity_id:string | number; mentioned_user_ids?:string[] }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers:cors })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const callerClient = createClient(url, anonKey, { global:{ headers:{ Authorization:authHeader } } })
    const { data:{ user }, error:userError } = await callerClient.auth.getUser()
    if (userError || !user) return json({ error:'No autorizado' }, 401)

    const admin = createClient(url, serviceKey)
    const { data:caller } = await admin.schema('bitacora').from('perfiles')
      .select('id,activo').eq('id', user.id).single()
    if (!caller?.activo) return json({ error:'Perfil inactivo' }, 403)

    const input = await req.json() as EventInput
    const event = await resolveVerifiedEvent(admin, input, user.id)
    if (!event) return json({ skipped:true, reason:'El registro no es de prioridad alta/crítica' })

    const recipientIds = new Set<string>()
    if (event.mentionedUserIds?.length) {
      const { data:mentionedProfiles } = await admin.schema('bitacora').from('perfiles')
        .select('id').eq('activo', true).in('id', event.mentionedUserIds)
      for (const profile of mentionedProfiles || []) recipientIds.add(profile.id)
    } else {
      const { data:admins } = await admin.schema('bitacora').from('perfiles')
        .select('id').eq('activo', true).eq('rol', 'admin')
      for (const profile of admins || []) recipientIds.add(profile.id)

      if (event.responsableUserId) recipientIds.add(event.responsableUserId)
      for (const profileId of event.responsableUserIds || []) {
        if (profileId) recipientIds.add(profileId)
      }
      if (event.responsableEmail) {
        const { data:profile } = await admin.schema('bitacora').from('perfiles')
          .select('id').eq('activo', true).ilike('email', event.responsableEmail).maybeSingle()
        if (profile?.id) recipientIds.add(profile.id)
      }
      if (event.sedeId) {
        const { data:sedeProfiles } = await admin.schema('bitacora').from('perfiles')
          .select('id').eq('activo', true).in('rol', ['encargado','sede']).contains('sede_ids', [event.sedeId])
        for (const profile of sedeProfiles || []) recipientIds.add(profile.id)

        const { data:sede } = await admin.schema('bitacora').from('sedes')
          .select('grupo_id').eq('id', event.sedeId).maybeSingle()
        if (sede?.grupo_id) {
          const { data:groupSupervisors } = await admin.schema('bitacora').from('perfiles')
            .select('id').eq('activo', true).eq('rol', 'grupo').eq('grupo_id', sede.grupo_id)
          for (const profile of groupSupervisors || []) recipientIds.add(profile.id)
        }
      }
    }

    if (event.excludeUserId) recipientIds.delete(event.excludeUserId)

    const ids = [...recipientIds]
    if (!ids.length) return json({ sent:0, recipients:0 })

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@flykitchen.com.ar'
    if (!vapidPublic || !vapidPrivate) throw new Error('Faltan secretos VAPID en la Edge Function')
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const dedupeBase = `${event.module}:${event.entityType}:${event.entityId}:${event.priority}`
    const rows = ids.map(destinatario_id => ({
      destinatario_id,
      modulo:event.module,
      entidad_tipo:event.entityType,
      entidad_id:String(event.entityId),
      titulo:event.title,
      cuerpo:event.body,
      prioridad:event.priority,
      url:event.url,
      dedupe_key:`${dedupeBase}:${destinatario_id}`,
    }))
    const { error:insertError } = await admin.schema('bitacora').from('notificaciones').insert(rows)
    if (insertError && insertError.code !== '23505') throw insertError

    const { data:subscriptions } = await admin.schema('bitacora').from('push_subscriptions')
      .select('*').in('user_id', ids).eq('active', true)
    let sent = 0
    const payload = JSON.stringify({
      title:event.title, body:event.body, url:event.url,
      tag:dedupeBase, dedupe_key:dedupeBase, requireInteraction:true,
    })
    for (const sub of subscriptions || []) {
      try {
        await webpush.sendNotification({
          endpoint:sub.endpoint,
          keys:{ p256dh:sub.p256dh, auth:sub.auth_key },
        }, payload)
        sent++
      } catch (error) {
        if ([404,410].includes(error?.statusCode)) {
          await admin.schema('bitacora').from('push_subscriptions')
            .update({ active:false, updated_at:new Date().toISOString() }).eq('id', sub.id)
        } else console.error('push-send', error)
      }
    }
    await admin.schema('bitacora').from('notificaciones')
      .update({ enviada_at:new Date().toISOString() }).in('dedupe_key', rows.map(r=>r.dedupe_key))
    return json({ sent, recipients:ids.length })
  } catch (error) {
    console.error(error)
    return json({ error:error.message || 'Error interno' }, 500)
  }
})

async function resolveVerifiedEvent(admin:any, input:EventInput, callerUserId:string) {
  const module = String(input?.module || '')
  const id = input?.entity_id
  if (!id) return null
  if (module === 'compras') {
    const { data:r } = await admin.schema('bitacora').from('requerimientos')
      .select('id,numero,descripcion,urgencia,sede_id,comprador_id,supervisor_compras_id').eq('id', id).single()
    if (!r || r.urgencia !== 'alta') return null
    return { module, entityType:'requerimiento', entityId:r.id, priority:'alta', sedeId:r.sede_id,
      responsableUserIds:[r.comprador_id, r.supervisor_compras_id].filter(Boolean),
      title:`Compra urgente #${r.numero || r.id}`, body:r.descripcion, url:'/?view=requerimientos' }
  }
  if (module === 'tareas') {
    const { data:t } = await admin.schema('bitacora').from('tareas')
      .select('id,titulo,prioridad,sede_id,responsable_id').eq('id', id).single()
    if (!t || String(t.prioridad).toLowerCase() !== 'alta') return null
    return { module, entityType:'tarea', entityId:t.id, priority:'alta', sedeId:t.sede_id,
      responsableUserId:t.responsable_id, title:'Nueva tarea de prioridad alta', body:t.titulo, url:'/?view=tareas' }
  }
  if (module === 'mantenimiento') {
    const { data:t } = await admin.from('mnt_tickets')
      .select('id,numero,descripcion,prioridad,sede_id,responsable_id').eq('id', id).single()
    if (!t || !['alta','critica'].includes(String(t.prioridad).toLowerCase())) return null
    let responsableEmail = null
    if (t.responsable_id) {
      const { data:responsable } = await admin.from('mnt_responsables')
        .select('email').eq('id', t.responsable_id).maybeSingle()
      responsableEmail = responsable?.email || null
    }
    return { module, entityType:'ticket', entityId:t.id, priority:t.prioridad, sedeId:t.sede_id,
      responsableEmail, title:`Ticket ${String(t.prioridad).toUpperCase()} #${t.numero || t.id}`,
      body:t.descripcion, url:'/?view=mntTickets' }
  }
  if (module === 'escalamientos') {
    const { data:e } = await admin.schema('bitacora').from('escalamientos')
      .select('id,tipo,descripcion,sede_id,responsable_id').eq('id', id).single()
    if (!e) return null
    return { module, entityType:'escalamiento', entityId:e.id, priority:'alta', sedeId:e.sede_id,
      responsableUserId:e.responsable_id, title:'Nuevo escalamiento', body:`${e.tipo}: ${e.descripcion}`, url:'/?view=escalamientos' }
  }
  if (module === 'comentario') {
    const { data:c } = await admin.schema('bitacora').from('comentarios')
      .select('id,entidad_tipo,entidad_id,autor_id,autor_nombre,texto,eliminado_at').eq('id', id).maybeSingle()
    if (!c || c.eliminado_at) return null
    if (String(c.autor_id) !== String(callerUserId)) return null
    const parent = await resolveComentarioParent(admin, c.entidad_tipo, c.entidad_id)
    if (!parent) return null
    const mentionedUserIds = Array.isArray(input.mentioned_user_ids)
      ? [...new Set(input.mentioned_user_ids.filter(Boolean).map(String))]
      : []
    return { module, entityType:'comentario', entityId:c.id, priority:'media', sedeId:parent.sedeId,
      responsableUserId:parent.responsableUserId, responsableEmail:parent.responsableEmail,
      mentionedUserIds,
      excludeUserId:c.autor_id,
      title:`Nuevo comentario de ${c.autor_nombre}`,
      body:c.texto.length > 140 ? `${c.texto.slice(0,140)}...` : c.texto,
      url:parent.url }
  }
  return null
}

async function resolveComentarioParent(admin:any, entidadTipo:string, entidadId:string) {
  // Nota: bitacora.escalamientos no tiene columna responsable_id (ver branch 'escalamientos'
  // arriba, que ya referencia ese campo inexistente). Para comentarios en escalamientos
  // dependemos del fallback por sede (admins + encargados/sede de esa sede), sin responsable puntual.
  if (entidadTipo === 'ticket') {
    const { data:t } = await admin.from('mnt_tickets')
      .select('id,sede_id,responsable_id').eq('id', entidadId).maybeSingle()
    if (!t) return null
    let responsableEmail = null
    if (t.responsable_id) {
      const { data:r } = await admin.from('mnt_responsables').select('email').eq('id', t.responsable_id).maybeSingle()
      responsableEmail = r?.email || null
    }
    return { sedeId:t.sede_id, responsableEmail, url:'/?view=mntTickets' }
  }
  if (entidadTipo === 'tarea') {
    const { data:t } = await admin.schema('bitacora').from('tareas')
      .select('id,sede_id,responsable_id').eq('id', entidadId).maybeSingle()
    if (!t) return null
    return { sedeId:t.sede_id, responsableUserId:t.responsable_id, url:'/?view=tareas' }
  }
  if (entidadTipo === 'escalamiento') {
    const { data:e } = await admin.schema('bitacora').from('escalamientos')
      .select('id,sede_id').eq('id', entidadId).maybeSingle()
    if (!e) return null
    return { sedeId:e.sede_id, url:'/?view=escalamientos' }
  }
  if (entidadTipo === 'no_conformidad') {
    const { data:n } = await admin.schema('bitacora').from('no_conformidades')
      .select('id,sede_id,created_by').eq('id', entidadId).maybeSingle()
    if (!n) return null
    return { sedeId:n.sede_id, responsableUserId:n.created_by, url:'/?view=capa' }
  }
  return null
}

function json(value:unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers:{ ...cors, 'Content-Type':'application/json' } })
}
