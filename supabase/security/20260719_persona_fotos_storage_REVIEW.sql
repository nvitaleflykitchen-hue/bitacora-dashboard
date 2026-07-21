-- REVIEW ONLY - NO APLICAR SIN CONFIRMACION EXPLICITA DEL USUARIO.
-- Proyecto autorizado: mixyhfdlzjarvszinytk (cerdova-db).
-- Bucket privado para fotos internas de personal.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-personal',
  'fotos-personal',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists persona_fotos_staff_select on storage.objects;
create policy persona_fotos_staff_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'fotos-personal'
  and (storage.foldername(name))[1] = 'personas'
  and exists (
    select 1
    from bitacora.perfiles p
    join equipo.personas persona
      on persona.id::text = (storage.foldername(name))[2]
    where p.id = (select auth.uid())
      and p.activo = true
      and (
        p.rol in ('admin', 'editor', 'consultor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.grupo_id = p.grupo_id and s.id = any (persona.sede_ids)
        ))
        or (p.rol = 'encargado' and persona.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
      )
  )
);

drop policy if exists persona_fotos_staff_insert on storage.objects;
create policy persona_fotos_staff_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos-personal'
  and (storage.foldername(name))[1] = 'personas'
  and exists (
    select 1
    from bitacora.perfiles p
    join equipo.personas persona
      on persona.id::text = (storage.foldername(name))[2]
    where p.id = (select auth.uid())
      and p.activo = true
      and (
        p.rol in ('admin', 'editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.grupo_id = p.grupo_id and s.id = any (persona.sede_ids)
        ))
        or (p.rol = 'encargado' and persona.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
      )
  )
);

drop policy if exists persona_fotos_staff_delete on storage.objects;
create policy persona_fotos_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fotos-personal'
  and (storage.foldername(name))[1] = 'personas'
  and exists (
    select 1
    from bitacora.perfiles p
    join equipo.personas persona
      on persona.id::text = (storage.foldername(name))[2]
    where p.id = (select auth.uid())
      and p.activo = true
      and (
        p.rol in ('admin', 'editor')
        or (p.rol = 'grupo' and exists (
          select 1 from bitacora.sedes s
          where s.grupo_id = p.grupo_id and s.id = any (persona.sede_ids)
        ))
        or (p.rol = 'encargado' and persona.sede_ids && coalesce(p.sede_ids, '{}'::integer[]))
      )
  )
);

-- No se crea policy UPDATE: el frontend no usa upsert. Sube un objeto nuevo,
-- actualiza equipo.personas.foto_url y luego elimina el objeto anterior.
