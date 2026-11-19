-- Proyecto: mixyhfdlzjarvszinytk. NA no requiere justificación. Conserva autorización, RLS y permisos.
create or replace function public.aero_checklist_guardar(p_id uuid,p_activo uuid,p_turno text,p_km integer,p_combustible text,p_respuestas jsonb,p_observaciones text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 a mantenimiento.activos%rowtype;
 c mantenimiento.checklists_aeropuerto%rowtype;
 v_nombre text;
 v_fecha date := (now() at time zone 'America/Argentina/Cordoba')::date;
 v_keys text[] := array['cabina','caja_limpia','seguro','tarjeta_verde','parking','cubiertas','urea','luces','conos','calzas','matafuego','hidraulico','caja','rampa','patas','grasa'];
 v_na text[] := array['urea','hidraulico','rampa','patas','grasa'];
 k text;
 last_km integer;
begin
 select * into a from mantenimiento.activos where id=p_activo;
 if a.id is null or a.tipo<>'VEHICULO' or not public.aero_checklist_asignado(a.id) or not public.aero_checklist_acceso(a.sede_id) then raise exception 'Vehículo no asignado o sin acceso a su sede'; end if;
 if exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='consultor') then raise exception 'Acceso de solo lectura'; end if;
 -- en_reparacion NO bloquea el control. Nunca actualizar el estado del activo.
 if p_id is null then raise exception 'Falta identificador del control'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_activo::text,0));
 select * into c from mantenimiento.checklists_aeropuerto where id=p_id;
 if found then
   if c.creado_por=auth.uid() and c.activo_id=p_activo and c.km=p_km and c.combustible=p_combustible and c.respuestas=p_respuestas and c.observaciones=trim(coalesce(p_observaciones,'')) then return to_jsonb(c); end if;
   raise exception 'Identificador usado por otro control';
 end if;
 if p_km is null or p_km<0 then raise exception 'Kilometraje inválido'; end if;
 select greatest(coalesce(a.km_actual,0),coalesce(max(km),0)) into last_km from mantenimiento.checklists_aeropuerto where activo_id=p_activo;
 if p_km<last_km then raise exception 'El kilometraje no puede ser menor a la última lectura (%)',last_km; end if;
 if p_combustible is null or p_combustible not in ('completo','3/4','1/2','1/4','reserva') then raise exception 'Combustible inválido'; end if;
 if p_respuestas is null or jsonb_typeof(p_respuestas)<>'object' then raise exception 'Respuestas inválidas'; end if;
 if (select count(*) from jsonb_object_keys(p_respuestas))<>16 then raise exception 'Completá los 16 controles'; end if;
 foreach k in array v_keys loop
   if not (p_respuestas ? k) or coalesce(p_respuestas->>k,'') not in ('ok','nc','na') or (p_respuestas->>k='na' and not k=any(v_na)) then raise exception 'Respuesta inválida: %',k; end if;
 end loop;
 if length(coalesce(p_observaciones,''))>4000 then raise exception 'Observaciones demasiado extensas'; end if;
 if exists(select 1 from jsonb_each_text(p_respuestas) r where r.value='nc') and length(trim(coalesce(p_observaciones,'')))<5 then raise exception 'Describí las no conformidades'; end if;
 select nombre into v_nombre from bitacora.perfiles where id=auth.uid();
 insert into mantenimiento.checklists_aeropuerto(id,activo_id,sede_id,fecha,turno,km,combustible,respuestas,observaciones,resultado,creado_por,responsable,version,creado_at)
 values(p_id,a.id,a.sede_id,v_fecha,null,p_km,p_combustible,p_respuestas,trim(coalesce(p_observaciones,'')),
   case when exists(select 1 from jsonb_each_text(p_respuestas) r where r.value='nc') then 'con_novedades' else 'sin_novedades' end,auth.uid(),coalesce(v_nombre,'Usuario'),2,clock_timestamp()) returning * into c;
 return to_jsonb(c);
end $$;
