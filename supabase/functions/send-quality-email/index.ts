import { createClient } from '@supabase/supabase-js'
import nodemailer from 'npm:nodemailer'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ROLES = new Set(['admin', 'editor', 'grupo', 'encargado'])
const ADJUNTOS_BUCKET = 'bitacora-adjuntos'
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
const MAX_ATTACHMENTS = 8

type RequestBody = {
  nc_id?: string | number
  escalamiento_id?: string | number
}

type Adjunto = {
  nombre: string | null
  mime_type: string | null
  storage_path: string | null
  tamaño_bytes: number | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'No autorizado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error('Configuración incompleta de Supabase')
    if (!smtpUser || !smtpPass) return json({ error: 'Falta configurar SMTP_USER o SMTP_PASS para habilitar los correos.' }, 503)

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await callerClient.auth.getUser()
    if (userError || !user) return json({ error: 'No autorizado' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: caller, error: callerError } = await admin
      .schema('bitacora')
      .from('perfiles')
      .select('id,nombre,email,rol,activo')
      .eq('id', user.id)
      .single()

    if (callerError || !caller?.activo) return json({ error: 'Perfil inactivo o inexistente' }, 403)
    if (!ALLOWED_ROLES.has(String(caller.rol || '').toLowerCase())) {
      return json({ error: 'El perfil no tiene permiso para notificar a Calidad' }, 403)
    }

    const input = await req.json() as RequestBody
    if (!input.nc_id || !input.escalamiento_id) {
      return json({ error: 'nc_id y escalamiento_id son obligatorios' }, 400)
    }

    const { data: nc, error: ncError } = await admin
      .schema('bitacora')
      .from('no_conformidades')
      .select('id,codigo,descripcion,categoria,causa_raiz,responsable,sede_id,sede_nombre,fecha_apertura,estado,created_by')
      .eq('id', input.nc_id)
      .single()
    if (ncError || !nc) return json({ error: 'No se encontró la no conformidad' }, 404)

    const { data: escalamiento, error: escalamientoError } = await admin
      .schema('bitacora')
      .from('escalamientos')
      .select('id,tipo,descripcion')
      .eq('id', input.escalamiento_id)
      .single()
    if (escalamientoError || !escalamiento) return json({ error: 'No se encontró el escalamiento' }, 404)
    if (
      String(escalamiento.tipo).toLowerCase() !== 'calidad' ||
      !String(escalamiento.descripcion || '').includes(String(nc.codigo))
    ) {
      return json({ error: 'El escalamiento no corresponde a esta NC o no está dirigido a Calidad' }, 400)
    }

    const { data: adjuntos, error: adjuntosError } = await admin
      .schema('bitacora')
      .from('adjuntos')
      .select('nombre,mime_type,storage_path,tamaño_bytes')
      .eq('entity_type', 'no_conformidad')
      .eq('entity_id', String(nc.id))
      .eq('tipo', 'archivo')
      .order('created_at', { ascending: true })
    if (adjuntosError) throw adjuntosError

    const attachments: Array<{ filename: string; path: string }> = []
    let attachmentBytes = 0
    let omittedImages = 0
    for (const file of (adjuntos || []) as Adjunto[]) {
      const size = Number(file.tamaño_bytes || 0)
      const isImage = String(file.mime_type || '').startsWith('image/')
      const fits = attachments.length < MAX_ATTACHMENTS &&
        attachmentBytes + size <= MAX_ATTACHMENT_BYTES
      if (!isImage || !file.storage_path) continue
      if (!fits) {
        omittedImages++
        continue
      }

      const { data: signed, error: signedError } = await admin.storage
        .from(ADJUNTOS_BUCKET)
        .createSignedUrl(file.storage_path, 60 * 60)
      if (signedError || !signed?.signedUrl) {
        omittedImages++
        continue
      }
      attachments.push({
        filename: safeFilename(file.nombre || `evidencia-${attachments.length + 1}.jpg`),
        path: signed.signedUrl,
      })
      attachmentBytes += size
    }

    const recipients = String(Deno.env.get('QUALITY_EMAIL_TO') || 'tecnica@flykitchen.com.ar')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
    const from = Deno.env.get('QUALITY_EMAIL_FROM') ||
      'Bitácora In Situ <notificaciones@flykitchen.com.ar>'
    const appUrl = String(Deno.env.get('APP_URL') || 'https://bitacora-dashboard.vercel.app')
      .replace(/\/+$/, '')
    const detailUrl = `${appUrl}/?view=noConformidades&targetType=no_conformidad&targetId=${encodeURIComponent(String(nc.id))}`
    const subject = `[${nc.codigo}] No conformidad escalada a Calidad — ${nc.sede_nombre || 'Sin sede'}`
    const html = renderEmail({ nc, caller, detailUrl, attachmentsCount: attachments.length, omittedImages })
    const text = renderText({ nc, caller, detailUrl, attachmentsCount: attachments.length, omittedImages })

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })

    const info = await transporter.sendMail({
      from: from,
      to: recipients,
      replyTo: caller.email || undefined,
      subject: subject,
      html: html,
      text: text,
      attachments: attachments,
    })

    const messageId = info.messageId

    const { error: commentError } = await admin
      .schema('bitacora')
      .from('comentarios')
      .insert({
        entidad_tipo: 'no_conformidad',
        entidad_id: String(nc.id),
        autor_id: user.id,
        autor_nombre: caller.nombre || 'Sistema',
        texto: `Notificación formal enviada por email a ${recipients.join(', ')}. Referencia: ${messageId}.`,
      })
    if (commentError) console.warn('email-sent-comment-failed', commentError)

    return json({
      sent: true,
      id: messageId,
      recipients,
      attachments: attachments.length,
      omitted_images: omittedImages,
    })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Error interno' }, 500)
  }
})

function renderEmail({ nc, caller, detailUrl, attachmentsCount, omittedImages }: any) {
  const description = multiline(nc.descripcion || '—')
  const rootCause = multiline(nc.causa_raiz || 'No informada')
  const evidenceNote = attachmentsCount
    ? `${attachmentsCount} imagen${attachmentsCount === 1 ? '' : 'es'} adjunta${attachmentsCount === 1 ? '' : 's'}.`
    : 'La notificación no contiene imágenes adjuntas.'
  const omittedNote = omittedImages
    ? ` ${omittedImages} imagen${omittedImages === 1 ? '' : 'es'} adicional${omittedImages === 1 ? '' : 'es'} debe${omittedImages === 1 ? '' : 'n'} consultarse en la aplicación.`
    : ''

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px">
      <div style="background:#111827;color:#fff;padding:22px 26px;border-radius:8px 8px 0 0">
        <div style="font-size:12px;letter-spacing:1.4px;color:#a3e635">FLY KITCHEN · BITÁCORA IN SITU</div>
        <h1 style="font-size:22px;margin:10px 0 0">No conformidad escalada a Calidad</h1>
      </div>
      <div style="background:#fff;padding:24px 26px;border:1px solid #e4e4e7;border-top:0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${row('Código', nc.codigo)}
          ${row('Fecha', formatDate(nc.fecha_apertura))}
          ${row('Sede', nc.sede_nombre || 'Sin sede')}
          ${row('Categoría', nc.categoria || '—')}
          ${row('Estado', nc.estado || '—')}
          ${row('Responsable', nc.responsable || 'No informado')}
          ${row('Reportado por', caller.nombre || caller.email || 'Usuario')}
        </table>
        <h2 style="font-size:15px;margin:24px 0 8px">Descripción</h2>
        <div style="font-size:14px;line-height:1.6;padding:14px;background:#f4f4f5;border-radius:5px">${description}</div>
        <h2 style="font-size:15px;margin:20px 0 8px">Causa raíz</h2>
        <div style="font-size:14px;line-height:1.6;padding:14px;background:#f4f4f5;border-radius:5px">${rootCause}</div>
        <p style="font-size:13px;color:#52525b;margin:20px 0">${escapeHtml(evidenceNote + omittedNote)}</p>
        <a href="${escapeHtml(detailUrl)}" style="display:inline-block;background:#166534;color:#fff;text-decoration:none;padding:11px 16px;border-radius:5px;font-weight:bold">
          Abrir no conformidad
        </a>
      </div>
      <div style="font-size:11px;color:#71717a;padding:14px 4px">
        Notificación automática. La trazabilidad oficial permanece en Bitácora In Situ.
      </div>
    </div>
  </body>
</html>`
}

function renderText({ nc, caller, detailUrl, attachmentsCount, omittedImages }: any) {
  return [
    'NO CONFORMIDAD ESCALADA A CALIDAD',
    '',
    `Código: ${nc.codigo}`,
    `Fecha: ${formatDate(nc.fecha_apertura)}`,
    `Sede: ${nc.sede_nombre || 'Sin sede'}`,
    `Categoría: ${nc.categoria || '—'}`,
    `Estado: ${nc.estado || '—'}`,
    `Responsable: ${nc.responsable || 'No informado'}`,
    `Reportado por: ${caller.nombre || caller.email || 'Usuario'}`,
    '',
    'Descripción:',
    nc.descripcion || '—',
    '',
    'Causa raíz:',
    nc.causa_raiz || 'No informada',
    '',
    `Imágenes adjuntas: ${attachmentsCount}`,
    omittedImages ? `Imágenes adicionales disponibles en la aplicación: ${omittedImages}` : '',
    '',
    `Abrir no conformidad: ${detailUrl}`,
  ].filter(Boolean).join('\n')
}

function row(label: string, value: unknown) {
  return `<tr>
    <td style="padding:7px 10px 7px 0;color:#71717a;width:145px;border-bottom:1px solid #e4e4e7">${escapeHtml(label)}</td>
    <td style="padding:7px 0;font-weight:600;border-bottom:1px solid #e4e4e7">${escapeHtml(value ?? '—')}</td>
  </tr>`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function multiline(value: unknown) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>')
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function safeFilename(value: string) {
  return value.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120) || 'evidencia.jpg'
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
