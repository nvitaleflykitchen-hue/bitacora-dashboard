import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const {chromium}=await import(pathToFileURL(process.argv[2]).href)
const root=process.cwd(),dir=path.join(root,'tmp/sector-qa')
await mkdir(dir,{recursive:true})
await writeFile(path.join(dir,'index.html'),'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tmp/sector-qa/entry.jsx"></script></body></html>')
await writeFile(path.join(dir,'entry.jsx'),`
import React from 'react';import{createRoot}from'react-dom/client';
import SectorMatrix from '../../src/components/SectorMatrix';
import {CredentialPreview} from '../../src/components/CredencialPersonalModal';
import {drawCredentialFront,drawCredentialBack,imageData,CARD_W,CARD_H} from '../../src/lib/credenciales';
import {jsPDF} from 'jspdf';import QRCode from 'qrcode';import '../../src/index.css';
const names=['Oficinas','Recepción','Vestuarios','Verdulería','Carnicería','Cocina caliente','Pastelería','Depósito','Sala de envasado','Armado','Lavadero','Sector limpieza','Playón frontal','Playón posterior','Carga y descarga','Patio de cisternas','Grupo electrógeno','Sala de Líneas Aéreas'];
const symbols=['Of','Rp','Ve','Vd','Ca','Cc','Pa','Dp','En','Ar','La','Li','Pf','Pp','Cd','Ci','Ge','Ae'];
const colors=['#475569','#475569','#6D28D9','#166534','#166534','#9A3412','#9A3412','#0F766E','#1D4ED8','#1D4ED8','#0E7490','#0E7490','#854D0E','#854D0E','#854D0E','#4B5563','#4B5563','#991B1B'];
const sectors=names.map((nombre,i)=>({id:String(i),numero:i+1,simbolo:symbols[i],codigo:String(i+1).padStart(2,'0')+'-'+symbols[i],nombre,color:colors[i],zra:i===17}));
const persona={nombre:'PERSONA',apellido:'DE PRUEBA',puesto:'OPERARIO',functional_area:'operations',sede_ids:[24]};
const credencial={fecha_vencimiento:'2028-10-22',area_impresa:'operations'};
const group={nombre:'Planta de Producción Córdoba',sectores:sectors};
window.downloadFixture=async()=>{const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:[CARD_W,CARD_H]});const logo=await imageData('/fly-kitchen-credencial.png');const qr=await QRCode.toDataURL('https://example.invalid/fixture');drawCredentialFront(pdf,{persona,credencial,logo,fotoRecortada:null,group});pdf.addPage([CARD_W,CARD_H]);drawCredentialBack(pdf,{logo,qr});pdf.save('matriz-18-sectores.pdf')};
createRoot(document.getElementById('root')).render(<main style={{padding:20,maxWidth:1100,margin:'auto'}}><h1 style={{fontSize:26,marginBottom:10}}>Planta Córdoba · Matriz de sectores</h1><p>Vista de prueba: ningún permiso real fue modificado.</p><SectorMatrix sectors={sectors}/><h2 style={{margin:'25px 0',fontSize:20}}>Credencial compacta · 18 sectores</h2><CredentialPreview persona={persona} presentation={{area:{code:'OPS',color:'#F36C00'},jobTitle:'OPERARIO'}} preview={group} draft={{grupo:'',fotoX:50,fotoY:50,fotoZoom:1}} foto={null} qr={null} vencimiento="2028-10-22"/></main>);
`)
const server=await createServer({configFile:false,envDir:false,root,server:{host:'127.0.0.1',port:4183,strictPort:true},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4183'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('fixture')}})
await server.listen()
let browser
try {
 browser=await chromium.launch({headless:true,channel:'msedge'})
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true})
 await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4183'?route.continue():route.abort())
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:4183/tmp/sector-qa/index.html')
 await page.getByRole('heading',{name:/Planta Córdoba/}).waitFor()
 assert.equal(await page.getByRole('button').count(),18)
 await page.screenshot({path:path.join(dir,'desktop.png'),fullPage:true})
 const download=page.waitForEvent('download');await page.evaluate(()=>window.downloadFixture());await(await download).saveAs(path.join(dir,'matriz-18-sectores.pdf'))
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desborde horizontal')
 assert.deepEqual(errors,[])
 console.log('PASS: 18 fichas, escritorio/móvil sin desborde, PDF CR80 generado. Sin conexiones externas.')
} finally {await browser?.close();await server.close()}
