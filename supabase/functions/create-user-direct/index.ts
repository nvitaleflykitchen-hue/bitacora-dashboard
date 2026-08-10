import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { db: { schema: 'bitacora' } }
    )

    // Verify token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
       return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify the caller is an admin
    const { data: callerPerfil } = await supabaseAdmin.from('perfiles').select('rol').eq('id', user.id).single()
    
    if (callerPerfil?.rol?.toLowerCase() !== 'admin') {
      return new Response(JSON.stringify({ error: 'Se requiere rol admin' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const input = await req.json()
    let { persona_id } = input
    let { email, nombre, rol, telefono } = input

    const allowedRoles = new Set(['admin', 'editor', 'encargado', 'consultor', 'grupo', 'sede', 'operario', 'flota', 'mnt_editor'])
    if (!allowedRoles.has(String(rol || '').toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Tipo de acceso inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let persona = null
    if (persona_id) {
      const personaResult = await supabaseAdmin
        .rpc('get_persona_for_user_enable', { p_persona_id: persona_id })
        .maybeSingle()
      if (personaResult.error || !personaResult.data) {
        return new Response(JSON.stringify({ error: 'No se encontró la persona indicada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      persona = personaResult.data
      persona_id = persona.id
      if (!persona.activo) {
        return new Response(JSON.stringify({ error: 'No se puede habilitar una persona inactiva' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      email = String(persona.email || '').trim().toLowerCase()
      nombre = [persona.nombre, persona.apellido].filter(Boolean).join(' ')
      telefono = persona.telefono || null
    }

    if (!email || !nombre || !rol) {
      return new Response(JSON.stringify({ error: 'Email, nombre y rol son obligatorios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: existingPerfil } = await supabaseAdmin.from('perfiles')
      .select('id,email,nombre,rol,activo').ilike('email', email).maybeSingle()
    if (existingPerfil) {
      if (persona_id) {
        const { data: linked, error: linkError } = await supabaseAdmin
          .rpc('link_persona_to_profile', { p_persona_id: persona_id, p_perfil_id: existingPerfil.id })
        if (linkError || !linked) throw linkError || new Error('No se pudo vincular el legajo')
      }
      return new Response(JSON.stringify({ data: { user: { id: existingPerfil.id, email }, perfil: existingPerfil, linked_existing: true } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    // Create user in Auth without sending an email
    const { data: newUserAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: '123456',
      email_confirm: true,
      user_metadata: { nombre }
    })

    if (createError) throw createError

    // Insert profile directly in bitacora schema
    const { data: newPerfil, error: insertError } = await supabaseAdmin.from('perfiles').insert({
      id: newUserAuth.user.id,
      email: email,
      nombre: nombre,
      rol: rol,
      telefono: telefono || null,
      sede_ids: persona?.sede_ids || null,
      activo: true,
      must_change_password: true
    }).select().single()

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserAuth.user.id)
      throw insertError
    }

    if (persona_id) {
      const { data: linked, error: linkError } = await supabaseAdmin
        .rpc('link_persona_to_profile', { p_persona_id: persona_id, p_perfil_id: newUserAuth.user.id })
      if (linkError || !linked) {
        await supabaseAdmin.from('perfiles').delete().eq('id', newUserAuth.user.id)
        await supabaseAdmin.auth.admin.deleteUser(newUserAuth.user.id)
        throw linkError
      }
    }

    return new Response(JSON.stringify({ data: { user: newUserAuth.user, perfil: newPerfil } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
