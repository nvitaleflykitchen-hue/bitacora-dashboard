-- Los registros históricos de BioGuard pertenecen a la planta productiva de Córdoba.
-- Se limita la actualización al lote migrado desde el proyecto fuente y sólo a filas sin sede.
do $$
declare
  v_sede_id bigint;
begin
  select id into v_sede_id
  from bitacora.sedes
  where nombre = 'Planta de Producción Córdoba' and activa is true;

  if v_sede_id is null then
    raise exception 'No se encontró la sede activa Planta de Producción Córdoba';
  end if;

  update bitacora.microbiologia_resultados
  set sede_id = v_sede_id,
      updated_at = now()
  where source_project = 'bioguard:oaelabufwmgfkbikkfov'
    and source_est_id = 'default'
    and sede_id is null;
end
$$;

-- Los diez protocolos originales disponibles se conservaron en el bucket público
-- bitacora-adjuntos bajo microbiologia/legacy/. Las demás referencias permanecen
-- como nombre de archivo hasta recuperar los PDF del proyecto fuente.
update bitacora.microbiologia_resultados
set record_data = jsonb_set(
      coalesce(record_data, '{}'::jsonb),
      '{evidencia_path}',
      to_jsonb('microbiologia/legacy/' || evidencia),
      true
    ),
    updated_at = now()
where source_project = 'bioguard:oaelabufwmgfkbikkfov'
  and evidencia is not null
  and (
    evidencia like '2026-01-28Protocolo%.pdf'
    or evidencia like 'UMI - %.pdf'
  );
