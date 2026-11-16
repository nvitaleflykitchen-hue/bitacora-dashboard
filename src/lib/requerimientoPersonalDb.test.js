// @vitest-environment node
import { beforeAll, afterAll, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
let db, before
beforeAll(async()=>{
  db=new PGlite()
  await db.exec(`create schema equipo; create role authenticated;
    create table equipo.reclutamiento_solicitudes(id uuid primary key default gen_random_uuid(),puesto text,estado text,fecha_apertura date not null default current_date,created_at timestamptz default now(),updated_at timestamptz default now());
    create function equipo.touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
    create trigger trg_reclutamiento_solicitudes_updated_at before update on equipo.reclutamiento_solicitudes for each row execute function equipo.touch_updated_at();
    grant usage on schema equipo to authenticated;grant select,insert,update on equipo.reclutamiento_solicitudes to authenticated;
    insert into equipo.reclutamiento_solicitudes(puesto,estado,fecha_apertura,updated_at) values('Reciente','borrador','2026-11-12','2026-11-12'),('Anterior','cerrada','2025-06-08','2025-06-09');`)
  before=(await db.query('select * from equipo.reclutamiento_solicitudes order by puesto')).rows
  await db.exec(readFileSync(new URL('../../supabase/migrations/20261116123934_requerimiento_personal_codigo_pdf.sql',import.meta.url),'utf8'))
},30000)
afterAll(async()=>{await db.close()})
it('numera también cerrados cronológicamente sin modificar datos originales',async()=>{
  const rows=(await db.query('select * from equipo.reclutamiento_solicitudes order by puesto')).rows
  expect(rows.map(({numero_requerimiento,codigo_requerimiento,fecha_necesidad,...rest})=>rest)).toEqual(before)
  expect(rows[0].codigo_requerimiento).toBe('REQ-PER-2025-0001')
  expect(rows[1].codigo_requerimiento).toBe('REQ-PER-2026-0002')
})
it('asigna correlativos sin permisos nuevos de secuencia ni código del cliente',async()=>{
  await db.exec('set role authenticated')
  const row=(await db.query("insert into equipo.reclutamiento_solicitudes(puesto,fecha_apertura,codigo_requerimiento) values('Nuevo','2026-11-16','MANUAL') returning *")).rows[0]
  expect(row.codigo_requerimiento).toBe('REQ-PER-2026-0003')
  await db.query("update equipo.reclutamiento_solicitudes set fecha_apertura='2024-01-01',estado='cerrada' where id=$1",[row.id])
  expect((await db.query('select codigo_requerimiento from equipo.reclutamiento_solicitudes where id=$1',[row.id])).rows[0].codigo_requerimiento).toBe('REQ-PER-2026-0003')
  await expect(db.query("update equipo.reclutamiento_solicitudes set codigo_requerimiento='otro' where id=$1",[row.id])).rejects.toThrow(/permanente/)
  await expect(db.query("insert into equipo.reclutamiento_solicitudes(numero_requerimiento,puesto) values(1,'Repetido')")).rejects.toThrow(/non-DEFAULT/)
})
