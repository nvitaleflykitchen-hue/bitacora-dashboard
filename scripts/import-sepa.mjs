import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { normalizeSepaCatalogRow } from '../server/sepaProvider.js'

const args = process.argv.slice(2)
const input = args.find(arg => !arg.startsWith('--'))
const apply = args.includes('--apply')
const sqlDirectory = args.find(arg => arg.startsWith('--sql-dir='))?.slice('--sql-dir='.length)
if (!input || !existsSync(input)) {
  console.error('Uso: node scripts/import-sepa.mjs <carpeta-o-zip> [--apply | --sql-dir=<carpeta>]')
  process.exit(1)
}

function decode(buffer) {
  try { return new TextDecoder('utf-8', { fatal:true }).decode(buffer) }
  catch { return new TextDecoder('windows-1252').decode(buffer) }
}
function parseLine(line, delimiter = '|') {
  const cells=[]; let value=''; let quoted=false
  for (let i=0;i<line.length;i++) {
    const char=line[i]
    if (char==='"' && quoted && line[i+1]==='"') { value+='"'; i++; continue }
    if (char==='"') { quoted=!quoted; continue }
    if (char===delimiter && !quoted) { cells.push(value); value=''; continue }
    value+=char
  }
  cells.push(value)
  return cells
}
function parsePipeFile(path) {
  const lines=decode(readFileSync(path)).replace(/^\uFEFF/,'').split(/\r?\n/).filter(line => line.trim() && !line.startsWith('Última actualización:'))
  if (!lines.length) return []
  const headers=parseLine(lines[0])
  return lines.slice(1).map(line => {
    const cells=parseLine(line)
    return Object.fromEntries(headers.map((key,i) => [key,cells[i] ?? '']))
  })
}
function walk(root, predicate, found=[]) {
  for (const entry of readdirSync(root,{ withFileTypes:true })) {
    const path=join(root,entry.name)
    if (entry.isDirectory()) walk(path,predicate,found)
    else if (predicate(path)) found.push(path)
  }
  return found
}
function extract(zip, destination) {
  execFileSync('tar',['-xf',zip,'-C',destination],{ stdio:'pipe',windowsHide:true })
}

const scratch=mkdtempSync(join(tmpdir(),'fly-sepa-'))
try {
  const root=extname(input).toLowerCase()==='.zip' ? scratch : input
  if (root===scratch) extract(input,root)
  for (const zip of walk(root,path => extname(path).toLowerCase()==='.zip')) {
    const destination=join(dirname(zip),`${basename(zip,'.zip')}-contents`)
    if (!existsSync(destination)) {
      const { mkdirSync } = await import('node:fs'); mkdirSync(destination,{ recursive:true }); extract(zip,destination)
    }
  }
  const files=walk(root,path => basename(path).toLowerCase()==='productos.csv')
  const datasets=[]
  for (const productFile of files) {
    const folder=dirname(productFile)
    const commerce=parsePipeFile(join(folder,'comercio.csv'))[0] || {}
    const dataset=basename(folder).replace(/-contents$/,'')
    const unique=new Map()
    for (const raw of parsePipeFile(productFile)) {
      const normalized=normalizeSepaCatalogRow(raw,commerce,dataset)
      if (!normalized) continue
      const key=[normalized.source_commerce_id,normalized.source_product_id,normalized.ean,normalized.package_barcode].join('|')
      if (!unique.has(key)) unique.set(key,normalized)
    }
    datasets.push({ name:dataset, rows:[...unique.values()] })
  }
  const total=datasets.reduce((sum,item) => sum+item.rows.length,0)
  console.log(`SEPA validado: ${datasets.length} archivos, ${total} productos con GTIN válido.`)
  const danica=datasets.flatMap(item => item.rows).find(row => row.ean==='7791620187211' || row.package_barcode==='17791620187218')
  if (danica) console.log(`Ejemplo Danica encontrado: EAN ${danica.ean || '-'} · bulto ${danica.package_barcode || '-'} · ${danica.name}`)
  if (sqlDirectory) {
    mkdirSync(sqlDirectory,{ recursive:true })
    writeFileSync(join(sqlDirectory,'000_delete.sql'),'delete from bitacora.sepa_products;\n')
    let batchNumber=1
    for (const dataset of datasets) {
      for (let start=0;start<dataset.rows.length;start+=1000) {
        const rows=dataset.rows.slice(start,start+1000)
        const payload=JSON.stringify(rows).replaceAll("'","''")
        const sql=`insert into bitacora.sepa_products
          (source_dataset,source_commerce_id,source_product_id,commerce_name,ean,package_barcode,name,brand,presentation,net_quantity,net_unit,units_per_package,raw_metadata,dataset_updated_at)
        select source_dataset,source_commerce_id,source_product_id,commerce_name,ean,package_barcode,name,brand,presentation,net_quantity,net_unit,units_per_package,coalesce(raw_metadata,'{}'::jsonb),dataset_updated_at
        from jsonb_to_recordset('${payload}'::jsonb) as row(
          source_dataset text,source_commerce_id text,source_product_id text,commerce_name text,ean text,package_barcode text,name text,brand text,presentation text,
          net_quantity numeric,net_unit text,units_per_package integer,raw_metadata jsonb,dataset_updated_at timestamptz
        ) on conflict do nothing;\n`
        writeFileSync(join(sqlDirectory,`${String(batchNumber).padStart(3,'0')}_${dataset.name}.sql`),sql)
        batchNumber++
      }
    }
    console.log(`SQL generado: ${batchNumber-1} lotes en ${sqlDirectory}`)
    process.exit(0)
  }
  if (!apply) { console.log('Simulación terminada. Usá --apply luego de aplicar la migración revisada.'); process.exit(0) }

  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno del proceso.')
  const supabase=createClient(url,serviceKey,{ auth:{ persistSession:false,autoRefreshToken:false } }).schema('bitacora')
  for (const dataset of datasets) {
    const removed=await supabase.from('sepa_products').delete().eq('source_dataset',dataset.name)
    if (removed.error) throw removed.error
    for (let start=0;start<dataset.rows.length;start+=500) {
      const result=await supabase.from('sepa_products').insert(dataset.rows.slice(start,start+500))
      if (result.error) throw result.error
    }
    console.log(`${dataset.name}: ${dataset.rows.length} filas importadas.`)
  }
} finally {
  if (scratch && existsSync(scratch)) rmSync(scratch,{ recursive:true,force:true })
}
