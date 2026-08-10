-- El responsable puede consultar su propia tarea para responder el compromiso.
-- La escritura general sigue restringida por tareas_update; los avances se
-- registran exclusivamente mediante las RPC auditadas de Pica Sesos.
drop policy if exists tareas_select on bitacora.tareas;

create policy tareas_select on bitacora.tareas
for select to authenticated
using (
  responsable_id = (select auth.uid())
  or exists (
    select 1
    from bitacora.perfiles p
    where p.id = (select auth.uid())
      and (
        p.rol in ('admin','editor','consultor')
        or (
          p.rol = 'grupo'
          and exists (
            select 1
            from bitacora.sedes s
            where s.grupo_id = p.grupo_id
              and s.id = tareas.sede_id
          )
        )
        or (
          p.rol in ('encargado','sede')
          and tareas.sede_id = any (coalesce(p.sede_ids, '{}'::integer[]))
        )
      )
  )
);

-- Índices de soporte para las claves foráneas y consultas de seguimiento.
create index if not exists compromisos_proximo_actor_id_idx
  on bitacora.compromisos (proximo_actor_id);
create index if not exists compromisos_cerrado_por_idx
  on bitacora.compromisos (cerrado_por);
create index if not exists compromiso_eventos_actor_id_idx
  on bitacora.compromiso_eventos (actor_id);
create index if not exists pica_sesos_config_updated_by_idx
  on bitacora.pica_sesos_config (updated_by);
