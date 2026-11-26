-- Exclusivamente mixyhfdlzjarvszinytk. Responsables solicitados y carga manual.
-- Conserva GRANT, RLS, roles, sedes y las firmas existentes de las RPC.
begin;
alter table bitacora.fp_formularios drop constraint fp_formularios_persona_ids_check;
alter table bitacora.fp_formularios add constraint fp_formularios_personas_check check(coalesce(jsonb_typeof(datos->'personas')='array' and jsonb_array_length(datos->'personas') between 1 and 100,false));
create or replace function bitacora.fp_context() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Se requiere iniciar sesión'; end if;
 select jsonb_build_object(
 'personas',coalesce((select jsonb_agg(bitacora.fp_person_snapshot(p.id) order by p.apellido,p.nombre) from equipo.personas p where p.activo and bitacora.fp_person_access(p.id,'ver')),'[]'::jsonb),
 'responsables',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'apellido',p.apellido,'puesto',p.puesto,'sede_ids',p.sede_ids,'aeroportuario',bitacora.fp_person_snapshot(p.id)->'aeroportuario') order by p.apellido,p.nombre)
 from equipo.personas p where p.activo and exists(select 1 from bitacora.sedes s where bitacora.fp_access(s.id,'ver')) and
 (bitacora.fp_person_access(p.id,'ver') or (p.nombre,p.apellido) in (('Nicolas Abel Luis','Vitale'),('Benjamin Renato','Garcia Abalos'),('Raúl Guillermo','Solorza')))),'[]'::jsonb),
 'sedes',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.nombre,'acciones',(select jsonb_agg(a) from unnest(array['ver','crear','editar','generar','firmar','presentar','anular','plantillas']) a where bitacora.fp_access(s.id,a)))) from bitacora.sedes s where bitacora.fp_access(s.id,'ver')),'[]'::jsonb),
 'plantillas',coalesce((select jsonb_agg(to_jsonb(t) order by t.tipo,t.version desc) from bitacora.fp_plantillas t),'[]'::jsonb),
 'admin',exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo),
 'supervisores',case when exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo) then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'habilitado',exists(select 1 from bitacora.fp_supervisores x where x.usuario_id=p.id))) from bitacora.perfiles p where p.activo and p.rol<>'admin'),'[]'::jsonb) else '[]'::jsonb end,
 'roles',case when exists(select 1 from bitacora.perfiles where id=auth.uid() and rol='admin' and activo) then (select jsonb_agg(to_jsonb(r)) from bitacora.fp_roles r) else '[]'::jsonb end
 ) into result;
 return result;
end $$;
create or replace function bitacora.fp_save(p_id uuid,p_version integer,p_template uuid,p_sede integer,p_personas uuid[],p_acompanante uuid,p_variables jsonb)
returns bitacora.fp_formularios language plpgsql security definer set search_path=pg_catalog as $$
declare f bitacora.fp_formularios; t bitacora.fp_plantillas; d jsonb; p uuid; manuales jsonb; manual jsonb; normalizados jsonb := '[]'; responsable jsonb; item jsonb; normalizado jsonb; k text; cantidad integer;
begin
 if not bitacora.fp_access(p_sede,case when p_id is null then 'crear' else 'editar' end) then raise exception 'Sin permiso para esta sede'; end if;
 if p_id is not null then
  select * into f from bitacora.fp_formularios where id=p_id for update;
  if not found or not bitacora.fp_access(f.sede_id,'editar') or f.estado<>'borrador' or p_version is null or f.version<>p_version then raise exception 'El borrador cambió, ya fue generado o no está autorizado. Actualizá.'; end if;
 end if;
 select * into t from bitacora.fp_plantillas where id=p_template and activa;
 if not found then raise exception 'Plantilla no disponible'; end if;
 if p_variables is null or jsonb_typeof(p_variables)<>'object' or octet_length(p_variables::text)>100000 then raise exception 'Datos del formulario inválidos'; end if;
 p_personas=coalesce(p_personas,'{}'::uuid[]);
 manuales=coalesce(nullif(p_variables->'personas_manuales','null'::jsonb),'[]'::jsonb);
 manual=nullif(p_variables->'responsable_manual','null'::jsonb);
 if jsonb_typeof(manuales)<>'array' then raise exception 'Personas manuales inválidas'; end if;
 cantidad=cardinality(p_personas)+jsonb_array_length(manuales);
 if cantidad<1 or cantidad>100 or (t.tipo='ppa_auto' and cantidad<>1) then raise exception 'Cantidad de personas inválida'; end if;
 if p_acompanante is not null and manual is not null then raise exception 'Elegí responsable registrado o manual, no ambos'; end if;
 for item in select value from jsonb_array_elements(manuales || case when manual is null then '[]'::jsonb else jsonb_build_array(manual) end) loop
  if jsonb_typeof(item)<>'object' or coalesce(trim(item->>'nombre'),'')='' then raise exception 'Completá el nombre de cada persona manual'; end if;
  foreach k in array array['nombre','apellido','dni','legajo','puesto'] loop
   if item ? k and (jsonb_typeof(item->k)<>'string' or length(item->>k)>180) then raise exception 'Campo manual inválido: %',k; end if;
  end loop;
  if item ? 'aeroportuario' and jsonb_typeof(item->'aeroportuario')<>'object' then raise exception 'Datos aeroportuarios manuales inválidos'; end if;
  foreach k in array array['ppa','tipo','sectores','aeropuerto','emision','vencimiento','estado'] loop
   if (item->'aeroportuario') ? k and (jsonb_typeof(item->'aeroportuario'->k)<>'string' or length(item->'aeroportuario'->>k)>180) then raise exception 'Dato aeroportuario inválido: %',k; end if;
  end loop;
  if nullif(item->'aeroportuario'->>'emision','') is not null then perform (item->'aeroportuario'->>'emision')::date; end if;
  if nullif(item->'aeroportuario'->>'vencimiento','') is not null then perform (item->'aeroportuario'->>'vencimiento')::date; end if;
  normalizado=jsonb_build_object('id',null,'origen','manual','nombre',trim(item->>'nombre'),'apellido',coalesce(trim(item->>'apellido'),''),'dni',coalesce(trim(item->>'dni'),''),'legajo',coalesce(trim(item->>'legajo'),''),'puesto',coalesce(trim(item->>'puesto'),''),
   'aeroportuario',jsonb_build_object('ppa',coalesce(item->'aeroportuario'->>'ppa',''),'tipo',coalesce(item->'aeroportuario'->>'tipo',''),'sectores',coalesce(item->'aeroportuario'->>'sectores',''),'aeropuerto',coalesce(item->'aeroportuario'->>'aeropuerto',''),'emision',coalesce(item->'aeroportuario'->>'emision',''),'vencimiento',coalesce(item->'aeroportuario'->>'vencimiento',''),'estado',coalesce(item->'aeroportuario'->>'estado','')));
  normalizados=normalizados||jsonb_build_array(normalizado);
 end loop;
 if manual is not null then responsable=normalizados->-1; normalizados=normalizados-(-1); end if;
 p_variables=p_variables||jsonb_build_object('personas_manuales',normalizados,'responsable_manual',responsable);
 if (select count(distinct x) from unnest(p_personas) x)<>cardinality(p_personas) then raise exception 'Personas duplicadas'; end if;
 foreach p in array p_personas loop
  if not exists(select 1 from equipo.personas where id=p and activo and p_sede=any(sede_ids)) or not bitacora.fp_person_access(p,'ver') then raise exception 'La persona debe estar activa y asignada a la sede'; end if;
 end loop;
 if p_acompanante is not null then
  select value into responsable from jsonb_array_elements(bitacora.fp_context()->'responsables') where value->>'id'=p_acompanante::text;
  if responsable is null then raise exception 'Responsable fuera del alcance o inactivo'; end if;
 end if;
 d=jsonb_build_object('personas',coalesce((select jsonb_agg(bitacora.fp_person_snapshot(x) order by n) from unnest(p_personas) with ordinality a(x,n)),'[]'::jsonb)||normalizados,
 'acompanante',responsable,'variables',p_variables,'sede',(select nombre from bitacora.sedes where id=p_sede));
 if p_id is null then
  insert into bitacora.fp_formularios(template_id,sede_id,persona_ids,acompanante_id,plantilla,datos,created_by,created_name,updated_by)
  values(t.id,p_sede,p_personas,p_acompanante,to_jsonb(t),d,auth.uid(),coalesce((select nombre from bitacora.perfiles where id=auth.uid()),'Usuario'),auth.uid()) returning * into f;
 else
  update bitacora.fp_formularios set template_id=t.id,sede_id=p_sede,persona_ids=p_personas,acompanante_id=p_acompanante,plantilla=to_jsonb(t),datos=d,version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_id returning * into f;
 end if;
 return f;
end $$;

notify pgrst,'reload schema';
commit;
