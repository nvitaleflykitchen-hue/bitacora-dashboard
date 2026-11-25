// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('cierra acceso anónimo, reserva hashes al servidor y conserva las vistas sujetas a RLS', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema mantenimiento;
      grant usage on schema mantenimiento to authenticated, service_role;
      create table mantenimiento.tickets(id int primary key, sede_id int);
      create table mantenimiento.activos(id int primary key, sede_id int);
      insert into mantenimiento.tickets values(1,21),(2,24);
      insert into mantenimiento.activos values(1,21),(2,24);
      alter table mantenimiento.tickets enable row level security;
      alter table mantenimiento.activos enable row level security;
      create policy scope on mantenimiento.tickets for select to authenticated using(sede_id=21);
      create policy scope on mantenimiento.activos for select to authenticated using(sede_id=21);
      grant select on all tables in schema mantenimiento to authenticated,service_role;
      create view public.mnt_tickets as select * from mantenimiento.tickets;
      create view public.mnt_activos as select * from mantenimiento.activos;
    `)
    const tables = ['app_users','global_settings','recipe_ingredients','raw_materials','recipes','final_products','product_packaging','technical_sheets']
    for (const table of tables) await db.exec(`create table public.${table}(id int); insert into public.${table} values(1);`)
    await db.exec('grant all on all tables in schema public to anon,authenticated,service_role;')
    const sql = readFileSync(new URL('../../sql_auditoria_contencion_REVIEW.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    await db.exec(sql) // Safe retry after deployment interruption.
    for (const table of [...tables,'mnt_tickets','mnt_activos']) {
      expect((await db.query(`select has_table_privilege('anon','public.${table}','SELECT') as allowed`)).rows[0].allowed).toBe(false)
    }
    expect((await db.query("select has_table_privilege('authenticated','public.app_users','SELECT') as allowed")).rows[0].allowed).toBe(false)
    await db.exec('set role authenticated')
    expect((await db.query('select id from public.mnt_tickets')).rows).toEqual([{id:1}])
    expect((await db.query('select id from public.mnt_activos')).rows).toEqual([{id:1}])
    expect((await db.query('select id from public.recipes')).rows).toEqual([{id:1}])
    await db.exec('reset role; set role service_role')
    expect((await db.query('select id from public.app_users')).rows).toEqual([{id:1}])
    expect((await db.query('select id from public.mnt_tickets')).rows).toHaveLength(2)
    await db.exec('reset role')
    expect((await db.query('select count(*)::int as total from mantenimiento.tickets')).rows[0].total).toBe(2)
  } finally { await db.close() }
}, 30000)
