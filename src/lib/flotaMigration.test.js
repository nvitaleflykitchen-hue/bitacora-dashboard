// @vitest-environment node
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
it('la migración aditiva conserva datos y vistas dependientes y permite persistir año y combustible',async()=>{
  const db=new PGlite()
  try {
    await db.exec("create schema mantenimiento; create table mantenimiento.activos(id text primary key,nombre text,numero_serie text,notas text); insert into mantenimiento.activos values('v','DOBLO - AC065RF','2-307082','Conservar'); create view public.mnt_activos as select * from mantenimiento.activos; create view public.consumidor_existente as select nombre from public.mnt_activos;")
    await db.exec(readFileSync('supabase/migrations/20261028171535_flota_ficha_campos_persistentes.sql','utf8'))
    await db.exec("update public.mnt_activos set anio=2017,combustible='nafta',dominio='AC065RF',km_lectura_fecha='2026-08-20' where id='v'")
    expect((await db.query('select * from mantenimiento.activos')).rows[0]).toMatchObject({anio:2017,combustible:'nafta',numero_serie:'2-307082',notas:'Conservar'})
    expect((await db.query('select * from public.consumidor_existente')).rows).toEqual([{nombre:'DOBLO - AC065RF'}])
  } finally {await db.close()}
},30000)
