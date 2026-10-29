// @vitest-environment node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { jsPDF } from 'jspdf'
import { expect, it, vi } from 'vitest'
import { credentialPrintGroups, drawCredentialFront } from './credenciales'
import { hasIncompatibleCredentialSectors } from './credentialAccess'
import { expandCredentialCards } from './credencialesA4'
vi.mock('./supabase',()=>({supabase:{}}))
it('imprime una sola tarjeta FA para Central y exige habilitación explícita',async()=>{
  const persona={nombre:'Persona de prueba',apellido:'Equipo Central',sede_ids:[30],puesto:'Coordinación multisede'}
  const credencial={fa_todas_sedes:true,sectores_autorizados:[],fa_vencimiento:'2027-10-29',fecha_vencimiento:'2028-10-29',area_impresa:'operations'}
  expect(hasIncompatibleCredentialSectors(persona,credencial)).toBe(true)
  expect(hasIncompatibleCredentialSectors(persona,credencial,true)).toBe(false)
  expect(expandCredentialCards([{credencial}])).toHaveLength(1)
  const [group]=credentialPrintGroups(credencial)
  const pdf=new jsPDF({unit:'mm',format:[53.98,85.6]})
  const logo='data:image/png;base64,'+readFileSync('public/fly-kitchen-credencial.png').toString('base64')
  drawCredentialFront(pdf,{persona,credencial,group,logo})
  const bytes=pdf.output('arraybuffer')
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs')
  const reader=await getDocument({data:new Uint8Array(bytes.slice(0)),useSystemFonts:true}).promise
  const text=(await (await reader.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ')
  expect(text).toContain('TODAS LAS SEDES');expect(text).toContain('FA');expect(text).toContain('29·10·2027')
  mkdirSync('tmp',{recursive:true});writeFileSync('tmp/fa-global-preview.pdf',Buffer.from(bytes))
},30000)
