import { db, supabase } from './supabase'
import { getActivos, getCapa, getRequerimientos, getSedes, getTareas, getTickets } from './queries'

export async function loadExecutiveBriefingData(sedeIds) {
  const sites=await getSedes(sedeIds)
  const ids=sites.map(site=>site.id)
  const [tasks,capas,requirements,tickets,assets,peopleResult]=await Promise.all([
    getTareas({sedeIds:ids,incluirResueltas:true}), getCapa({sedeIds:ids}), getRequerimientos({sedeIds:ids}),
    getTickets({sedeIds:ids}), getActivos({sedeIds:ids}),
    supabase.schema('equipo').from('personas').select('id,nombre,apellido,sede_ids,activo').eq('activo',true).overlaps('sede_ids',ids.map(Number)),
  ])
  if(peopleResult.error)throw peopleResult.error
  const people=peopleResult.data||[]
  const docsResult=people.length ? await db().from('documentacion_items').select('entity_type,entity_id,codigo,estado,fecha_vencimiento').eq('entity_type','persona').in('entity_id',people.map(p=>String(p.id))) : {data:[],error:null}
  if(docsResult.error)throw docsResult.error
  return {tasks,capas,requirements,tickets,assets,sites,people,documents:docsResult.data||[]}
}
