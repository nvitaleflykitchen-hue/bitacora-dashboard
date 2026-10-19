-- Add the department only; preserve existing authorization checks and privileges.
alter table equipo.personas drop constraint personas_functional_area_check;
alter table equipo.personas add constraint personas_functional_area_check check (
 functional_area is null or functional_area in ('operations','logistics','quality','maintenance','administration','hr','production','airports','warehouse')
);
do $$
declare definition text; old_list text := '''operations'',''logistics'',''quality'',''maintenance'',''administration'',''hr'',''production'',''airports''';
begin
 select pg_get_functiondef('public.emitir_credencial_multisede(uuid,uuid,jsonb,uuid[])'::regprocedure) into definition;
 if position(old_list in definition)=0 then raise exception 'Unexpected department validation; review before applying'; end if;
 execute replace(definition,old_list,old_list||',''warehouse''');
end $$;
