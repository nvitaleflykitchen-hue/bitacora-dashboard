// Prueba de UI/PDF con API simulada: bloquea toda conexión externa.
// node scripts/verify-credential-browser.mjs <ruta-a-playwright/index.mjs>
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createServer as httpServer} from 'node:http'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
import {build} from 'vite'
import react from '@vitejs/plugin-react'
const {chromium}=await import(pathToFileURL(process.argv[2]).href)
const root=process.cwd(), dir=path.join(root,'tmp/credential-qa')
await mkdir(dir,{recursive:true})
await writeFile(path.join(dir,'index.html'),'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tmp/credential-qa/entry.jsx"></script></body></html>')
await writeFile(path.join(dir,'photo.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="450" height="436"><rect width="450" height="436" fill="#dfe3e8"/><circle cx="225" cy="145" r="75" fill="#7c8799"/><path d="M70 436V355a155 140 0 0 1 310 0v81" fill="#354f7c"/></svg>')
await writeFile(path.join(dir,'entry.jsx'),`
import React from 'react';import{createRoot}from'react-dom/client';
import Modal from '../../src/components/CredencialPersonalModal.jsx';
import Verify from '../../src/views/CredencialVerificacion.jsx';
import {descargarCredencialesA4} from '../../src/lib/credencialesA4';
import {getCredencialPersona} from '../../src/lib/credenciales';
import FeedbackHost from '../../src/components/FeedbackHost.jsx';import '../../src/index.css';
const persona={id:'00000000-0000-0000-0000-000000000003',nombre:'PERSONA',apellido:'DE PRUEBA',dni:'00000000',puesto:'OPERARIO DE ARMADO AEROPORTUARIO',functional_area:'operations',sede_ids:[24],foto_url:'personas/fixture/photo.svg'};
window.downloadA4=async()=>descargarCredencialesA4([{persona,credencial:await getCredencialPersona(persona.id)}]);
const sedes=[{id:24,nombre:'Planta de Producción Córdoba',activa:true},{id:25,nombre:'Rosario',activa:true}];
createRoot(document.getElementById('root')).render(<><FeedbackHost/>{location.search.includes('verify')?<Verify token="00000000-0000-0000-0000-000000000099"/>:<Modal persona={persona} sedes={sedes} onClose={()=>{}}/>}</>);
`)
await build({configFile:false,envDir:false,root,logLevel:'warn',
  build:{outDir:path.join(dir,'dist'),rollupOptions:{input:path.join(dir,'index.html')}},
  define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:4179'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('fixture-key')},
  plugins:[{name:'credential-auth-fixture',enforce:'pre',resolveId(source){if(source==='../lib/auth')return '\0credential-auth-fixture'},load(id){if(id==='\0credential-auth-fixture')return `export const useAuth=()=>({perfil:{rol:location.search.includes('consultor')?'consultor':'admin',activo:true}})`}},react()],
})
const server=httpServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname
    const file=pathname==='/tmp/credential-qa/photo.svg'?path.join(dir,'photo.svg'):pathname==='/fly-kitchen-credencial.png'?path.join(root,'public/fly-kitchen-credencial.png'):path.join(dir,'dist',pathname)
    if(!file.startsWith(root))throw new Error('Fuera del fixture')
    const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream'
    res.writeHead(200,{'Content-Type':mime});res.end(await readFile(file))
  }catch{res.writeHead(404);res.end()}
})
await new Promise(resolve=>server.listen(4179,'127.0.0.1',resolve))
let browser, diagnosticPage
try {
  browser=await chromium.launch({headless:true,channel:'msedge'})
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true})
  const errors=[]
  let emitted=null, calls=0, photoCalls=0
  const names=['Administración y oficinas','Cocina y producción primaria','Depósitos de materias primas','Armado de catering aeroportuario','Cámaras de producto terminado y trolleys','Despacho aeroportuario y dársena','Lavado, retornos y residuos','Área técnica y mantenimiento']
  const catalog=names.map((nombre,i)=>({id:`00000000-0000-0000-0000-${String(i+10).padStart(12,'0')}`,sede_id:24,sede_nombre:'Planta de Producción Córdoba',codigo:String(i+1).padStart(2,'0'),nombre,clasificacion:i>=3&&i<=5?'Restringido':'Operativo',zra:i>=3&&i<=5}))
  catalog.push({id:'00000000-0000-0000-0000-000000000030',sede_id:25,sede_nombre:'Rosario',codigo:'04',nombre:'Depósito Rosario',clasificacion:'Operativo',zra:false})
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url())
    if(url.origin!=='http://127.0.0.1:4179')return route.abort()
    if(url.pathname.startsWith('/storage/v1/object/')){
      photoCalls++
      if(photoCalls===1)return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Photo temporarily unavailable'})})
      return route.fulfill({status:200,contentType:'image/svg+xml',body:await readFile(path.join(dir,'photo.svg'))})
    }
    if(!url.pathname.startsWith('/rest/v1/'))return route.continue()
    calls++
    let data
    if(url.pathname.endsWith('/credencial_sectores'))data=catalog
    else if(url.pathname.endsWith('/credenciales_personal'))data=emitted
    else if(url.pathname.endsWith('/rpc/emitir_credencial_multisede')){
      const body=route.request().postDataJSON()
      assert.equal(body.p_datos.autorizacion_confirmada,true)
      emitted={id:'00000000-0000-0000-0000-000000000050',token:'00000000-0000-0000-0000-000000000099',estado:'activa',fecha_emision:'2026-10-14',fecha_vencimiento:'2028-10-14',...body.p_datos,area_impresa:body.p_datos.area,sectores_autorizados:catalog.filter(s=>body.p_sector_ids.includes(s.id))}
      data=emitted
    } else if(url.pathname.endsWith('/rpc/verificar_credencial_multisede'))data=[{...emitted,nombre:'PERSONA DE PRUEBA',puesto:'OPERARIO DE ARMADO AEROPORTUARIO',empresa:'Fly Kitchen S.A.',sectores_autorizados:emitted.estado==='activa'?emitted.sectores_autorizados:[]}]
    else throw new Error(`Petición no prevista: ${url.pathname}`)
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
  })
  const page=await context.newPage()
  diagnosticPage=page
  console.log('Browser listo; abriendo fixture local.')
  page.on('pageerror',e=>{errors.push(e.message);console.error('Error de página:',e.message)})
  await page.goto('http://127.0.0.1:4179/tmp/credential-qa/index.html')
  await page.getByLabel('Departamento',{exact:true}).selectOption('airports')
  await page.getByRole('button',{name:'Reintentar foto'}).click()
  await page.waitForFunction(()=>{const img=document.querySelector('img[alt="Fotografía del titular"]');return img?.complete&&img.naturalWidth>0})
  assert.equal(photoCalls,2,'La foto vuelve a descargarse después del fallo')
  console.log('Formulario cargado; verificando emisión.')
  assert.equal(await page.getByRole('checkbox',{checked:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'Emitir credencial',exact:true}).isEnabled(),false)
  for(const name of ['04 · Armado de catering aeroportuario · ZRA','05 · Cámaras de producto terminado y trolleys · ZRA','06 · Despacho aeroportuario y dársena · ZRA','04 · Depósito Rosario'])await page.getByRole('checkbox',{name,exact:true}).check()
  await page.getByRole('checkbox',{name:/Confirmo que/}).check()
  await page.getByRole('button',{name:'Emitir credencial',exact:true}).click()
  await page.getByRole('button',{name:'Confirmar emisión',exact:true}).click()
  await page.getByText('Credencial emitida por dos años.',{exact:true}).waitFor()
  assert.equal(await page.getByText('04',{exact:true}).first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(185, 28, 28)')
  console.log('Emisión simulada verificada; exportando PDF.')
  assert.equal(emitted.sectores_autorizados.length,4)
  await page.getByAltText('QR de validación de la credencial emitida').waitFor()
  await page.getByRole('heading',{name:'Control de accesos y credenciales'}).scrollIntoViewIfNeeded()
  await page.screenshot({path:path.join(dir,'desktop.png'),fullPage:true})
  const downloadPromise=page.waitForEvent('download')
  await page.getByRole('button',{name:'Descargar PDF CR80'}).click()
  await (await downloadPromise).saveAs(path.join(dir,'credencial-prueba.pdf'))
  const a4Download=page.waitForEvent('download')
  await page.evaluate(()=>window.downloadA4())
  await (await a4Download).saveAs(path.join(dir,'credenciales-a4-prueba.pdf'))
  await page.setViewportSize({width:390,height:844})
  await page.getByRole('heading',{name:'Control de accesos y credenciales'}).scrollIntoViewIfNeeded()
  await page.screenshot({path:path.join(dir,'mobile.png'),fullPage:true})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin overflow horizontal en mobile')
  await page.getByRole('checkbox',{name:'04 · Depósito Rosario',exact:true}).uncheck()
  assert.equal(await page.getByRole('checkbox',{name:/Confirmo que/}).isChecked(),false)
  assert.equal(await page.getByRole('button',{name:'Descargar PDF CR80'}).isEnabled(),false)
  await page.goto('http://127.0.0.1:4179/tmp/credential-qa/index.html?verify')
  await page.getByText('CREDENCIAL VÁLIDA',{exact:true}).waitFor()
  assert.equal(await page.getByText('Rosario',{exact:true}).count(),1)
  await page.screenshot({path:path.join(dir,'qr.png'),fullPage:true})
  emitted.estado='extraviada'
  await page.reload();await page.getByText('CREDENCIAL EXTRAVIADA',{exact:true}).waitFor()
  assert.equal(await page.getByText('Sectores autorizados',{exact:true}).count(),0)
  const before=calls
  await page.goto('http://127.0.0.1:4179/tmp/credential-qa/index.html?consultor')
  await page.getByText('Disponible únicamente para administradores.').waitFor()
  assert.equal(calls,before)
  assert.deepEqual(errors,[])
  console.log('PASS: UI desktop/mobile, selección sin permisos automáticos, emisión, QR, PDF, cambios pendientes, extravío, rol consultor. API simulada; tráfico externo bloqueado.')
} catch(error) {
  if(diagnosticPage){await diagnosticPage.screenshot({path:path.join(dir,'error.png'),fullPage:true});console.error((await diagnosticPage.locator('body').innerText()).slice(0,2500))}
  throw error
} finally { await browser?.close();await new Promise(resolve=>server.close(resolve)) }
