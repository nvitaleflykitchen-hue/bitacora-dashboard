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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
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

    const { email, nombre, rol, telefono } = await req.json()

    if (!email || !nombre || !rol) {
      return new Response(JSON.stringify({ error: 'Email, nombre y rol son obligatorios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      activo: true,
      must_change_password: true
    }).select().single()

    if (insertError) {
      // If we failed to create the profile for some reason, we return a success but with the error info 
      // so the frontend can catch it and handle it or the user knows.
      console.error("Error creating profile:", insertError)
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
