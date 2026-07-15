import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const today = new Date().toISOString().split('T')[0]
    
    // 1. Obtener planes vencidos que pertenecen a un activo
    const { data: planesVencidos, error: errPlanes } = await supabaseClient
      .from('mnt_planes')
      .select('*')
      .eq('activo', true)
      .lte('proxima_fecha', today)
      .not('activo_id', 'is', null)

    if (errPlanes) throw errPlanes

    let generated = 0
    let escalados = 0

    for (const plan of planesVencidos || []) {
      // Ver si ya existe un ticket abierto/en progreso para este plan
      const { data: ticketsActivos, error: errTkt } = await supabaseClient
        .from('mnt_tickets')
        .select('id, estado, escalamiento_id')
        .eq('plan_id', plan.id)
        .neq('estado', 'cerrado')
        .neq('estado', 'cancelado')

      if (errTkt) throw errTkt

      if (ticketsActivos && ticketsActivos.length > 0) {
         // Ticket pendiente. Revisar si amerita escalamiento automático (ej. > 3 días vencido)
         const dateProxima = new Date(plan.proxima_fecha)
         const diffTime = new Date().getTime() - dateProxima.getTime()
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
         
         if (diffDays > 3) {
             const ticketId = ticketsActivos[0].id
             // El vínculo real vive en mantenimiento.tickets.escalamiento_id.
             if (!ticketsActivos[0].escalamiento_id) {
               const { data: escalamiento, error: errEsc } = await supabaseClient
                 .schema('bitacora')
                 .from('escalamientos')
                 .insert({
                   tipo: 'Mantenimiento',
                   descripcion: 'Mantenimiento preventivo vencido por más de 3 días',
                   estado: 'Pendiente',
                   sede_id: plan.sede_id,
                   fecha_reporte: today,
                   reportante: 'Sistema'
                 })
                 .select('id')
                 .single()
               if (errEsc) throw new Error(`No se pudo escalar el plan ${plan.id}: ${errEsc.message}`)

               const { error: errLink } = await supabaseClient
                 .from('mnt_tickets')
                 .update({ escalamiento_id: escalamiento.id })
                 .eq('id', ticketId)
               if (errLink) throw new Error(`No se pudo vincular el escalamiento al ticket ${ticketId}: ${errLink.message}`)
               escalados++
             }
         }
      } else {
         // Crear ticket preventivo
         const { data: activoData } = await supabaseClient.from('mnt_activos').select('sede_id, nombre').eq('id', plan.activo_id).single()
         
         const { data: newTicket, error: errNewTkt } = await supabaseClient
            .from('mnt_tickets')
            .insert({
               plan_id: plan.id,
               activo_id: plan.activo_id,
               sede_id: activoData?.sede_id,
               responsable_id: plan.responsable_id,
               tipo: 'preventivo',
               prioridad: 'media',
               estado: 'abierto',
               descripcion: `Mantenimiento Preventivo: ${plan.nombre}`,
               fecha_limite: plan.proxima_fecha
               // El creador_id o responsable se pueden vincular después
            }).select('id, prioridad, sede_id').single()

         if (errNewTkt) throw new Error(`No se pudo crear el ticket del plan ${plan.id}: ${errNewTkt.message}`)
         generated++
         
         // Trigger push notification invoking the other edge function
         await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-priority-notification`, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
           },
           body: JSON.stringify({
             ticketId: newTicket.id,
             sedeId: newTicket.sede_id,
             message: `Mantenimiento Preventivo Vencido: ${activoData?.nombre || 'Equipo'}`,
             priority: 'Alta' // Set Alta to force notification
           })
         })
      }
    }

    return new Response(JSON.stringify({ success: true, generated, escalados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
