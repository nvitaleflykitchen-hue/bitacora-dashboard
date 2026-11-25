-- PENDIENTE de autorización. Proyecto: mixyhfdlzjarvszinytk.
-- Requiere publicar primero cambiar-clave-obligatoria y el formulario actualizado.
BEGIN;
CREATE OR REPLACE FUNCTION bitacora_private.protect_profile_security_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, bitacora, bitacora_private AS $$
BEGIN
  -- El servidor puede cambiar exclusivamente la bandera y su marca temporal.
  IF current_setting('role',true) = 'service_role'
     AND (to_jsonb(NEW) - 'must_change_password' - 'updated_at') =
         (to_jsonb(OLD) - 'must_change_password' - 'updated_at') THEN
    RETURN NEW;
  END IF;
  IF bitacora_private.is_bitacora_admin() THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid() <> OLD.id THEN
    RAISE EXCEPTION 'No autorizado para modificar este perfil' USING ERRCODE='42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.sede_ids IS DISTINCT FROM OLD.sede_ids OR NEW.grupo_id IS DISTINCT FROM OLD.grupo_id
     OR NEW.activo IS DISTINCT FROM OLD.activo OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'Los permisos y el cambio obligatorio se administran en el servidor' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.seguridad_pre_request()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ruta text=ltrim(coalesce(current_setting('request.path',true),''),'/');
BEGIN
  IF EXISTS (SELECT 1 FROM bitacora.perfiles WHERE id=auth.uid()
             AND must_change_password=true)
     AND ruta NOT IN ('rpc/obtener_perfil_sesion','rpc/registrar_acceso_app') THEN
    RAISE EXCEPTION 'Debés cambiar la contraseña antes de operar' USING ERRCODE='42501';
  END IF;
  IF equipo.es_cuenta_seguridad() AND ruta NOT IN
    ('rpc/seguridad_operar','rpc/obtener_perfil_sesion','rpc/registrar_acceso_app') THEN
    RAISE EXCEPTION 'La cuenta de Seguridad sólo tiene acceso a Portería.' USING ERRCODE='42501';
  END IF;
END $$;

-- Protege checklists sin tocar otras visitas ni reasignar históricos.
CREATE OR REPLACE FUNCTION bitacora_private.proteger_autor_checklist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p bitacora.perfiles%ROWTYPE; a mantenimiento.activos%ROWTYPE; datos jsonb;
        prefijo constant text='CHECKLIST_VEHICULO::';
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND starts_with(coalesce(OLD.observacion,''),prefijo) THEN
    RAISE EXCEPTION 'El checklist es histórico: registrá un nuevo control' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF NOT starts_with(coalesce(NEW.observacion,''),prefijo) THEN RETURN NEW; END IF;
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'El checklist debe registrarse como un nuevo control'; END IF;
  SELECT * INTO p FROM bitacora.perfiles WHERE id=auth.uid();
  IF p.id IS NULL OR NOT p.activo OR coalesce(p.must_change_password,false)
     OR p.rol NOT IN ('admin','editor','flota','mnt_editor','grupo','encargado','sede','operario') THEN
    RAISE EXCEPTION 'Cuenta no autorizada para registrar controles' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM mantenimiento.activos WHERE id=NEW.activo_id;
  IF a.id IS NULL OR a.tipo IS DISTINCT FROM 'VEHICULO' OR a.estado='baja' THEN
    RAISE EXCEPTION 'Vehículo no disponible';
  END IF;
  IF NOT coalesce((p.rol IN ('admin','editor','flota')
      OR EXISTS (SELECT 1 FROM bitacora.perfil_permisos x WHERE x.perfil_id=p.id
                 AND x.modulo='mantenimiento' AND x.accion='manage_all' AND x.activo)
      OR (p.rol='grupo' AND EXISTS(SELECT 1 FROM bitacora.sedes s WHERE s.id=a.sede_id AND s.grupo_id=p.grupo_id))
      OR (p.rol IN ('mnt_editor','encargado','sede','operario') AND a.sede_id=ANY(coalesce(p.sede_ids,'{}')))),false) THEN
    RAISE EXCEPTION 'Vehículo fuera de las sedes asignadas' USING ERRCODE='42501';
  END IF;
  datos=substring(NEW.observacion FROM length(prefijo)+1)::jsonb;
  IF jsonb_typeof(datos)<>'object' THEN RAISE EXCEPTION 'Checklist inválido'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY['balizas','frenos','luces','tablero','aceite','rampa','neumaticos','agua','combustible','matafuego']) k
    WHERE NOT coalesce(datos->'respuestas'->>k IN ('ok','observado','critico')
      OR (k='rampa' AND datos->'respuestas'->>k='na'),false)) THEN
    RAISE EXCEPTION 'Respondé los diez controles';
  END IF;
  IF datos->>'km' IS NOT NULL AND (datos->>'km' !~ '^[0-9]+$') THEN RAISE EXCEPTION 'Kilometraje inválido'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each_text(datos->'respuestas') r WHERE r.value IN ('observado','critico'))
     AND length(trim(coalesce(datos->>'observaciones','')))=0 THEN RAISE EXCEPTION 'Describí las no conformidades'; END IF;
  datos=datos || jsonb_build_object('estado',CASE
    WHEN EXISTS(SELECT 1 FROM jsonb_each_text(datos->'respuestas') r WHERE r.value='critico') THEN 'no_apto'
    WHEN EXISTS(SELECT 1 FROM jsonb_each_text(datos->'respuestas') r WHERE r.value='observado') THEN 'observado'
    ELSE 'apto' END);
  NEW.created_by=p.id;
  NEW.visitante=coalesce(nullif(p.nombre,''),p.email);
  NEW.fecha=clock_timestamp();
  NEW.tipo_visita='inspeccion';
  datos=datos || jsonb_build_object('conductor',NEW.visitante,'creado_por',NEW.visitante,
    'autor_id',p.id,'activo_id',a.id,'activo_nombre',a.nombre,'sede_id',a.sede_id,
    'sede',coalesce(a.sede_nombre,a.sede),'created_at',NEW.fecha,
    'fecha_control',(NEW.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date);
  NEW.observacion=prefijo || datos::text;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bitacora_private.proteger_autor_checklist() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS proteger_autor_checklist ON mantenimiento.visitas_activo;
CREATE TRIGGER proteger_autor_checklist BEFORE INSERT OR UPDATE OR DELETE ON mantenimiento.visitas_activo
FOR EACH ROW EXECUTE FUNCTION bitacora_private.proteger_autor_checklist();
COMMIT;
