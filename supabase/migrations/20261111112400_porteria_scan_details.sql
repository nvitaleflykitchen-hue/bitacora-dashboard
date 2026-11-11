-- Amplía sólo la respuesta del escaneo autenticado. Conserva permisos y validación por sede.
begin;
do $migration$
declare definition text; anchor text := '  insert into equipo.seguridad_escaneos(credencial_id,sede_id,guardia_id,resultado)';
begin
 select pg_get_functiondef('public.seguridad_operar(text,integer,jsonb)'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'Unexpected scan implementation'; end if;
 definition=replace(definition,anchor,$addition$
  result=result || jsonb_build_object(
   'tipo','credencial','puesto',v->>'puesto','empresa',v->>'empresa',
   'area_impresa',v->>'area_impresa','fecha_emision',cred.fecha_emision,
   'fecha_vencimiento',v->>'fecha_vencimiento',
   'legajo',(select p.legajo from equipo.personas p where p.id=cred.persona_id),
   'foto_path',(select p.foto_url from equipo.personas p where p.id=cred.persona_id),
   'foto_pos_x',cred.foto_pos_x,'foto_pos_y',cred.foto_pos_y,'foto_zoom',cred.foto_zoom);
$addition$ || anchor);
 execute definition;
end $migration$;
commit;
