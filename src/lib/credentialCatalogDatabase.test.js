// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll,afterAll,it,expect } from 'vitest'
let pg
beforeAll(async()=>{
  pg=new PGlite()
  await pg.exec(`create schema equipo; create schema bitacora;
    create table bitacora.sedes(id integer primary key,nombre text,activa boolean default true);
    insert into bitacora.sedes values(21,'Aeropuerto de Córdoba',true),(24,'Planta de Producción Córdoba',true);
    create table equipo.credencial_sectores(id uuid primary key default gen_random_uuid(),sede_id integer references bitacora.sedes,codigo text constraint credencial_sectores_codigo_check check(codigo ~ '^[0-9]{2}$'),nombre text,clasificacion text,zra boolean,activo boolean default true,unique(sede_id,codigo));
    insert into equipo.credencial_sectores(sede_id,codigo,nombre,zra) values(24,'05','Cámaras antiguas',true);
    create table equipo.credenciales_personal(id uuid default gen_random_uuid(),sectores_autorizados jsonb,autorizacion_confirmada boolean default true,area_impresa text,persona_id uuid,token uuid,fecha_emision date,fecha_vencimiento date,emitida_por uuid,estado text default 'activa');
    insert into equipo.credenciales_personal(sectores_autorizados) select jsonb_build_array(jsonb_build_object('id',id,'codigo',codigo,'nombre',nombre)) from equipo.credencial_sectores;
  `)
  await pg.exec(readFileSync(new URL('../../supabase/migrations/20261016095311_credenciales_sectores_letras_z.sql',import.meta.url),'utf8'))
  await pg.exec('create trigger validar before insert or update on equipo.credenciales_personal for each row execute function equipo.validar_sectores_credencial()')
},60000)
afterAll(async()=>{await pg?.close()})
const emit=async(codes,confirmed=true)=>pg.query(`insert into equipo.credenciales_personal(sectores_autorizados,autorizacion_confirmada)
 select jsonb_agg(jsonb_build_object('id',id,'nombre','valor no confiable')), $2 from equipo.credencial_sectores where sede_id=24 and codigo=any($1::text[]) returning sectores_autorizados`,[codes,confirmed])
it('carga 8 letras aeroportuarias y 12 de planta; D une cámaras y Z es rojo',async()=>{
 const rows=(await pg.query("select sede_id,codigo,nombre,zra from equipo.credencial_sectores where codigo ~ '^[A-Z]$' order by sede_id,codigo")).rows
 expect(rows.filter(r=>r.sede_id===21).map(r=>r.codigo)).toEqual(['A','B','C','D','G','H','I','Z'])
 expect(rows.filter(r=>r.sede_id===24).map(r=>r.codigo)).toEqual(['A','B','C','D','G','H','I','J','K','L','M','Z'])
 expect(rows.filter(r=>r.codigo==='Z').every(r=>r.zra)).toBe(true)
 expect(rows.find(r=>r.codigo==='D').nombre).toContain('cámaras')
})
it('conserva la emisión numérica y prohíbe usarla para una nueva emisión',async()=>{
 expect((await pg.query("select sectores_autorizados from equipo.credenciales_personal where sectores_autorizados->0->>'codigo'='05'")).rows).toHaveLength(1)
 await expect(emit(['05'])).rejects.toThrow('catálogo numérico')
 expect((await pg.query("select activo from equipo.credencial_sectores where codigo='05'")).rows[0].activo).toBe(true)
})
it('exige confirmación, impide Z redundante y congela el alcance de la emisión',async()=>{
 await expect(emit(['Z'],false)).rejects.toThrow('confirmar')
 await expect(emit(['A','Z'])).rejects.toThrow('Z ya incluye')
 const result=(await emit(['Z'])).rows[0].sectores_autorizados
 expect(result).toHaveLength(1)
 expect(result[0]).toMatchObject({codigo:'Z',zra:true,sede_id:24,nombre:'Acceso total a los sectores de esta sede, incluido ZRA'})
 await expect(pg.exec("update equipo.credenciales_personal set sectores_autorizados='[]'")).rejects.toThrow('reemitir')
})
