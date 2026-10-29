// @vitest-environment node
// Prueba optativa con snapshot de sólo lectura: no consulta ni modifica producción.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { groupVehicleReport } from './flotaReportData'
import { createVehicleReportPdf } from './flotaReportPdf'
vi.mock('./supabase',()=>({supabase:{},db:()=>({})}))
it.skipIf(!existsSync('tmp/flota-snapshot.json'))('integra AC065RF contra snapshot actual sin omitir históricos ni alterar importes',async()=>{
  const s=JSON.parse(readFileSync('tmp/flota-snapshot.json','utf8'))
  const extras=JSON.parse(readFileSync('tmp/flota-extras.json','utf8'))
  const reports=JSON.parse(readFileSync('tmp/flota-reports.json','utf8'))
  const [data]=groupVehicleReport([s.activo],{...extras,reports,documentation:s.documentacion,plans:s.planes,tickets:s.tickets,providers:[s.proveedor]})
  expect(data.vehicle.dominio).toBe('AC065RF');expect(data.vehicle.marca).toBe('Fiat');expect(data.vehicle.anio).toBe('2017')
  expect(data.tickets).toHaveLength(10)
  expect(data.tickets.filter(t=>t.estado==='resuelto')).toHaveLength(9)
  expect(data.tickets.find(t=>t.numero===858).estado).toBe('abierto')
  expect(new Set(data.tickets.map(t=>t.id)).size).toBe(10)
  expect(data.plans[0]).toMatchObject({activo:true,proxima_fecha:'2027-02-20'})
  expect(data.reading).toMatchObject({km:77000,fuente:'Ticket 893'})
  expect(data.tickets.every(t=>t.costo_real===null)).toBe(true)
  expect(data.warnings.join(' ')).toContain('no coinciden')
  expect(data.warnings.join(' ')).toContain('vencido el 01/10/2026')
  const pdf=createVehicleReportPdf([data],'Aeropuerto Mendoza')
  const bytes=pdf.output('arraybuffer')
  mkdirSync('output/pdf',{recursive:true})
  writeFileSync('output/pdf/AC065RF-informe-flota-corregido.pdf',Buffer.from(bytes))
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
  const reader=await getDocument({data:new Uint8Array(bytes),useSystemFonts:true}).promise
  const pages=[]
  for(let i=1;i<=reader.numPages;i++) pages.push((await (await reader.getPage(i)).getTextContent()).items.map(x=>x.str).join(' '))
  const text=pages.join(' ').replace(/\s+/g,' ')
  for(const number of [858,893,894,895,896,897,898,899,900,901]) expect(text).toContain(`Ticket ${number}`)
  expect(text).toContain('87.882 km');expect(text).toContain('77.000 km')
  expect(text.indexOf('Ticket 893')).toBeLessThan(text.indexOf('Ticket 901'))
  writeFileSync('tmp/flota-pdf-text.txt',text)
},30000)
