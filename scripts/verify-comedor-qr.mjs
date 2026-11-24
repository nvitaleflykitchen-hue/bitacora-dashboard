import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const db=new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema bitacora; create table bitacora.sedes(id integer primary key,nombre text,activa boolean); grant usage on schema bitacora to service_role; grant select on bitacora.sedes to service_role; insert into bitacora.sedes values(1,\'Prueba\',true);')
await db.exec(await readFile(new URL('../sql_comedor_publico.sql',import.meta.url),'utf8'))
const token='11111111-1111-1111-1111-111111111111'
await db.query("insert into bitacora.comedor_qr(sede_id,token,activo,coordinacion,gerencia) values(1,$1,true,'{}','{}')",[token])
await db.exec('set role service_role')
const send=async(id,items=[{tema:'a',detalle:'Demora de servicio'}])=>db.query('select bitacora.recibir_novedad_comedor($1,$2,$3,$4,$5,$6,$7) as numero',[token,id,'Cliente','','',JSON.stringify(items),'ip-test'])
const id='22222222-2222-2222-2222-222222222222'
assert.equal((await send(id)).rows[0].numero,(await send(id)).rows[0].numero)
await assert.rejects(send('33333333-3333-3333-3333-333333333333',[{tema:'z',detalle:'No valido'}]))
for(let i=1;i<=9;i++)await send(`44444444-4444-4444-4444-${String(i).padStart(12,'0')}`)
await assert.rejects(send('55555555-5555-5555-5555-555555555555'),/Limite/)
assert.equal((await db.query('select count(*) as n from bitacora.comedor_novedades')).rows[0].n,10)
await db.exec('reset role; set role anon')
await assert.rejects(db.query('select * from bitacora.comedor_novedades'))
await assert.rejects(send(id))
await db.exec('reset role; update bitacora.comedor_qr set activo=false; set role service_role')
await assert.rejects(send(id),/QR no disponible/)
await db.close()
console.log('QR comedor: idempotencia, temas, limites, aislamiento anonimo y desactivacion correctos.')
