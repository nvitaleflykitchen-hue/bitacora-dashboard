import { beforeEach, expect, it, vi } from 'vitest'
import { loadVehicleReport, readAll } from './flotaReportData'
import { saveFleetVehicle } from './flotaVehicleSave'
const { from, calls, source }=vi.hoisted(()=>({from:vi.fn(),calls:[],source:{}}))
vi.mock('./supabase',()=>({supabase:{from,schema:()=>({from})},db:()=>({from})}))
beforeEach(()=>{
  calls.length=0;for(const k of Object.keys(source))delete source[k]
  from.mockImplementation(table=>{
    const query={}
    for(const key of ['select','eq','in','order','update','insert'])query[key]=(...args)=>{calls.push([table,key,...args]);return query}
    query.range=async (start,end)=>({data:(source[table]||[]).slice(start,end+1)})
    query.maybeSingle=async()=>({data:source.saved??null})
    return query
  })
})
it('refresca la ficha e incluye otras categorías por ID, sin filtrar estados',async()=>{
  source.mnt_activos=[{id:'v',nombre:'DOBLO - AC065RF',marca:'Fiat',km_actual:77000}]
  source.tickets=[{id:'t',activo_id:'v',numero:893,categoria:'Flota - historial Prolube',estado:'resuelto'}]
  const [report]=await loadVehicleReport([{id:'v',marca:'Vieja',km_actual:0}])
  expect(report.vehicle.marca).toBe('Fiat');expect(report.tickets).toHaveLength(1)
  expect(calls.some(c=>c[0]==='tickets'&&c[1]==='eq')).toBe(false)
})
it('pagina sin perder registros después del límite de API',async()=>{
  source.rows=Array.from({length:1201},(_,id)=>({id}))
  expect(await readAll(from('rows'))).toHaveLength(1201)
})
it('no hace upsert de la ficha completa y rechaza una edición concurrente',async()=>{
  await expect(saveFleetVehicle({marca:'Fiat',notas:'Viejas'},{id:'v',updated_at:'2026-10-28'},['marca'],[])).rejects.toThrow('cambió')
  expect(calls.find(c=>c[1]==='update')[2]).toEqual({marca:'Fiat',updated_at:expect.any(String)})
  expect(calls).toContainEqual(['mnt_activos','eq','updated_at','2026-10-28'])
})
