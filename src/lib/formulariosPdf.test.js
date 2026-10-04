// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { it,expect } from 'vitest'
import { createFormularioPdf } from './formulariosPdf'
const person={nombre:'Ana',apellido:'Prueba',dni:'12345678',puesto:'Operador',aeroportuario:{ppa:'1234',sectores:'1'}}
const form=(tipo,n)=>({plantilla:{tipo,layout:1,version:1,nombre:tipo},datos:{personas:Array(n).fill(person),acompanante:person,variables:{fecha:'2026-10-04',desde:'08:00',hasta:'18:00',tareas:'Servicio',empresa:'Prueba',sectores:'1',justificaciones:{1:'Servicio'}}}})
it('generates one PDF with every group of five participants',async()=>{
 const bytes=await createFormularioPdf(form('anexo_e',11),{templateBytes:readFileSync('public/formularios/anexo-e-v1.pdf')})
 const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBe(3)
 expect(pdf.getPage(0).getSize()).toEqual({width:588,height:768})
})
it('preserves overflowing input on additional pages and rejects unknown layouts',async()=>{
 const f=form('ppa_auto',1);f.datos.variables.observaciones='Texto completo '.repeat(600)
 const bytes=await createFormularioPdf(f,{templateBytes:readFileSync('public/formularios/ppa-auto-v1.pdf')})
 expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2)
 await expect(createFormularioPdf({...f,plantilla:{...f.plantilla,layout:999}})).rejects.toThrow('no compatible')
})
