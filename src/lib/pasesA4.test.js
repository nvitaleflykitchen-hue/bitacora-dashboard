import { expect, it, vi } from 'vitest'
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib'
import { crearPasesA4, posicionPaseA4, pasesUnicos } from './pasesA4'
vi.mock('./supabase',()=>({supabase:{}}))
it('distribuye 11 tarjetas reales dentro de A4 sin superposición',()=>{
 const slots=Array.from({length:11},(_,i)=>posicionPaseA4(i))
 for(const a of slots){
  expect(a.x).toBeGreaterThanOrEqual(5);expect(a.y).toBeGreaterThanOrEqual(5)
  expect(a.x+a.w).toBeLessThanOrEqual(205);expect(a.y+a.h).toBeLessThanOrEqual(292)
  for(const b of slots.filter(s=>s!==a))expect(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y).toBe(true)
 }
})
it('genera 11 tarjetas en la primera hoja y el resto en la siguiente, sin duplicar QR',async()=>{
 const items=Array.from({length:12},(_,i)=>({codigo:'ATA-'+String(i+1).padStart(2,'0'),token:'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'),tipo:i===11?'visita':'temporal'}))
 expect(pasesUnicos([...items,items[0]])).toHaveLength(12)
 const bytes=await crearPasesA4([...items,items[0]])
 const pdf=await PDFDocument.load(bytes)
 expect(pdf.getPageCount()).toBe(2)
 expect(pdf.getPages().map(p=>p.node.Resources().lookup(PDFName.of('XObject'),PDFDict).keys().length)).toEqual([11,1])
 expect(pdf.getPage(0).getWidth()).toBeCloseTo(210*72/25.4)
 if(process.env.PASES_A4_PREVIEW){const {writeFileSync}=await import('node:fs');writeFileSync(process.env.PASES_A4_PREVIEW,bytes)}
})
