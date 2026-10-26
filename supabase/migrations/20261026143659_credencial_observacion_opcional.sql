-- Observación opcional; conserva responsable, confirmación, alcance y auditoría.
create or replace function equipo.validar_sectores_credencial() returns trigger language plpgsql set search_path='' as $$
declare esperado jsonb; cantidad integer;
begin
 if TG_OP='UPDATE' then
  if new.sectores_autorizados is distinct from old.sectores_autorizados
  or new.autorizacion_confirmada is distinct from old.autorizacion_confirmada
  or new.autorizacion_responsable is distinct from old.autorizacion_responsable
  or new.autorizacion_motivo is distinct from old.autorizacion_motivo
  or new.fa_vencimiento is distinct from old.fa_vencimiento
  or new.area_impresa is distinct from old.area_impresa
  or new.persona_id is distinct from old.persona_id or new.token is distinct from old.token
  or new.fecha_emision is distinct from old.fecha_emision or new.fecha_vencimiento is distinct from old.fecha_vencimiento
  or new.emitida_por is distinct from old.emitida_por then raise exception 'Para cambiar la autorización debe reemitir la credencial.'; end if;
  if old.estado<>'activa' and new.estado='activa' then raise exception 'Una credencial invalidada no puede reactivarse.'; end if;
  return new;
 end if;
 cantidad=jsonb_array_length(new.sectores_autorizados);
 if cantidad=0 then return new; end if;
 if auth.uid() is null or not exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo)
 then raise exception 'Sólo administradores activos pueden autorizar accesos.'; end if;
 if not new.autorizacion_confirmada or length(trim(coalesce(new.autorizacion_responsable,'')))<3 then raise exception 'Seleccione el responsable y confirme la autorización nominal.'; end if;
 new.emitida_por=auth.uid();
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sede_id',s.sede_id,'sede_nombre',d.nombre,
 'codigo',s.codigo,'nombre',s.nombre,'zra',s.zra,'tipo',s.tipo,'estado_fisico',s.estado_fisico,'habilitado_ingreso',s.habilitado_ingreso)
 order by s.sede_id,s.codigo),'[]') into esperado
 from equipo.credencial_sectores s join bitacora.sedes d on d.id=s.sede_id
 join equipo.personas p on p.id=new.persona_id
 where s.activo and d.activa and s.sede_id in(21,24) and s.sede_id=any(p.sede_ids)
 and s.codigo ~ '^([A-Z][a-z]|FA)$'
 and s.id in(select (v->>'id')::uuid from jsonb_array_elements(new.sectores_autorizados) v);
 if jsonb_array_length(esperado)<>cantidad then raise exception 'Sector inexistente, duplicado, anterior o fuera de las sedes asignadas.'; end if;
 if exists(select 1 from jsonb_array_elements(esperado) v group by v->>'sede_id' having bool_or(v->>'codigo'='FA') and count(*)>1)
 then raise exception 'Seleccione FA o sectores individuales por sede.'; end if;
 if exists(select 1 from jsonb_array_elements(esperado) v where v->>'codigo'='FA') then
  if new.fa_vencimiento is null or new.fa_vencimiento<current_date or new.fa_vencimiento>new.fecha_vencimiento
  then raise exception 'FA requiere una vigencia entre hoy y el vencimiento de la credencial.'; end if;
 else new.fa_vencimiento=null; end if;
 new.sectores_autorizados=esperado;
 return new;
end $$;
