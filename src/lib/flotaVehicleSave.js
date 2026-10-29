import { supabase } from './supabase'
import { fleetPatch, FLEET_EDIT_FIELDS } from './flotaModel'
import { normalizarConcesion } from './activoConcesion'

export async function saveFleetVehicle(form, original, changed, sedes) {
  const fields=original?.id ? [...changed] : FLEET_EDIT_FIELDS.filter(k=>form[k]!==undefined)
  if(fields.includes('bien_concesionado')) fields.push('concesion_propietario','concesion_referencia')
  const patch=normalizarConcesion(fleetPatch(form,fields))
  if(!Object.keys(patch).length) return original
  if(fields.includes('sede_id')) {
    const name=sedes.find(s=>String(s.id)===String(patch.sede_id))?.nombre || null
    patch.sede_nombre=name; patch.sede=name
  }
  const table=supabase.from('mnt_activos')
  let query=original?.id ? table.update({...patch,updated_at:new Date().toISOString()}).eq('id',original.id) : table.insert({...patch,tipo:'VEHICULO',estado:form.estado || 'operativo'})
  if(original?.updated_at) query=query.eq('updated_at',original.updated_at)
  const {data,error}=await query.select().maybeSingle()
  if(error) throw error
  if(!data) throw Error('La ficha cambió o ya no tenés acceso. Cerrá y volvé a abrir antes de guardar; no se sobrescribieron datos.')
  return data
}
