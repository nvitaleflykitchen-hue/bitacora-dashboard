import { describe,it,expect } from 'vitest'
import { formWarnings,validateForm,sectors } from './formulariosPermisos'
const vars={fecha:'2026-10-10',desde:'08:00',hasta:'18:00',tareas:'Servicio',sectores:'1, 3',justificaciones:{1:'Acceso',3:'Servicio'}}
const person={nombre:'Ana',apellido:'Prueba',dni:'123',puesto:'Operador',aeroportuario:{ppa:'123',vencimiento:'2027-01-01',sectores:'1, 3',estado:'vigente'}}
describe('validations',()=>{
 it('warns on missing, expired and unauthorized PPA details',()=>{
  const p={...person,dni:'',aeroportuario:{ppa:'',vencimiento:'2026-01-01',sectores:'1'}}
  const warnings=formWarnings({personas:[p],variables:vars},'ppa_auto','2026-10-03')
  expect(warnings.join()).toMatch(/DNI/);expect(warnings.join()).toMatch(/Falta PPA/);expect(warnings.join()).toMatch(/VENCIDO/);expect(warnings.join()).toMatch(/no autorizados/)
 })
 it('uses companion permissions for Anexo E',()=>{
  expect(formWarnings({personas:[person],acompanante:person,variables:vars},'anexo_e','2026-10-03')).toEqual([])
  expect(formWarnings({personas:[person],variables:vars},'anexo_e','2026-10-03')).toContain('Falta el responsable del acompañamiento.')
 })
 it('rejects malformed sectors and invalid schedules',()=>{
  expect(sectors('12, 9, 1, 3, 3')).toEqual(['1','3'])
  expect(()=>validateForm({...vars,sectores:'12'},['a'],'ppa_auto')).toThrow('sector')
  expect(()=>validateForm({...vars,hasta:'07:00'},['a'],'ppa_auto')).toThrow('posterior')
  expect(()=>validateForm(vars,['a','b'],'ppa_auto')).toThrow('una persona')
  expect(()=>validateForm(vars,['a','b'],'anexo_e')).not.toThrow()
 })
 it('accepts manual-only or mixed participants and requires their names',()=>{
  const manual={...vars,personas_manuales:[{nombre:'Emanuel',apellido:'Calderón'}]}
  expect(()=>validateForm(manual,[],'ppa_auto')).not.toThrow()
  expect(()=>validateForm(manual,['registered'],'anexo_e')).not.toThrow()
  expect(()=>validateForm(manual,['registered'],'ppa_auto')).toThrow('una persona')
  expect(()=>validateForm({...manual,responsable_manual:{nombre:''}},[],'anexo_e')).toThrow('nombre')
 })
})
