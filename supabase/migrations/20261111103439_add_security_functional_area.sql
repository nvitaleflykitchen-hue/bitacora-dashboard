-- Área funcional únicamente: conserva roles, permisos y autorizaciones de acceso.
begin;
alter table equipo.personas drop constraint personas_functional_area_check;
alter table equipo.personas add constraint personas_functional_area_check check (
 functional_area is null or functional_area in ('operations','logistics','quality','maintenance','administration','hr','production','airports','warehouse','security')
);

do $$
declare definition text; old_validation text := 'coalesce(p_datos->>''area'','''') not in (''operations'',''logistics'',''quality'',''maintenance'',''administration'',''hr'',''production'',''airports'',''warehouse'')';
begin
 select pg_get_functiondef('public.emitir_credencial_multisede(uuid,uuid,jsonb,uuid[])'::regprocedure) into definition;
 if position(old_validation in definition)=0 then raise exception 'Unexpected department validation; review before applying'; end if;
 execute replace(definition,old_validation,replace(old_validation,'''warehouse'')','''warehouse'',''security'')'));
end $$;
commit;
