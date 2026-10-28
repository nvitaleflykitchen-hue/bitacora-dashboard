// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { afterEach, expect, it, vi } from 'vitest'
import { crearAutorizacionRetiroPDF } from './autorizacionRetiroPdf'
afterEach(()=>vi.unstubAllGlobals())
it('imprime sólo los autorizados elegidos y admite listas que ocupan más de una página',async()=>{
  vi.stubGlobal('fetch',async url=>({ok:true,arrayBuffer:async()=>Uint8Array.from(readFileSync(`public${url}`)).buffer}))
  const datos={empresa:'Transportista de prueba',origen:'Mendoza',fecha:'2026-10-28',referencia:'PRUEBA'}
  const blob=await crearAutorizacionRetiroPDF({...datos,personas:[{nombre:'Persona Elegida',dni:'12345678'}]})
  const text=Buffer.from(await blob.arrayBuffer()).toString('latin1')
  expect(text).toContain('PERSONA ELEGIDA DNI 12345678')
  expect(text).not.toContain('PABLO OCAMPO')
  const largo=await crearAutorizacionRetiroPDF({...datos,personas:Array.from({length:60},(_,i)=>({nombre:`Persona autorizada de prueba ${i}`,dni:'12345678'}))})
  const bytes=await largo.arrayBuffer()
  expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1)
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise
  const pages = []
  for (let i=1;i<=pdf.numPages;i++) pages.push((await (await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' '))
  expect(pages.join(' ').replace(/\s+/g,' ')).toContain('PERSONA AUTORIZADA DE PRUEBA 59')
  await pdf.destroy()
})
