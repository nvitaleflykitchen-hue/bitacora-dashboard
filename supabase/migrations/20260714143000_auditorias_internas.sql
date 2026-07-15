-- Fly Gestión - Auditorías internas por sede
-- IMPORTANTE: revisar y aprobar antes de ejecutar en producción.

create extension if not exists pgcrypto;

create table if not exists bitacora.auditoria_plantillas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  tipo_auditoria text not null default 'Integral'
    check (tipo_auditoria in ('Integral','Operativa','Calidad e Inocuidad','Seguridad e Higiene','Seguimiento')),
  tipos_sede text[] not null default '{}',
  version integer not null default 1 check (version > 0),
  normativa text,
  activa boolean not null default true,
  creado_por uuid references bitacora.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bitacora.auditoria_secciones (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references bitacora.auditoria_plantillas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  peso numeric(6,2) not null default 1 check (peso > 0),
  orden integer not null default 0,
  unique (plantilla_id, codigo)
);

create table if not exists bitacora.auditoria_preguntas (
  id uuid primary key default gen_random_uuid(),
  seccion_id uuid not null references bitacora.auditoria_secciones(id) on delete cascade,
  codigo text not null,
  pregunta text not null,
  orientacion text,
  requisito_critico boolean not null default false,
  requiere_evidencia_si_falla boolean not null default true,
  peso numeric(6,2) not null default 1 check (peso > 0),
  orden integer not null default 0,
  activa boolean not null default true,
  unique (seccion_id, codigo)
);

create table if not exists bitacora.auditorias_internas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  sede_id integer not null references bitacora.sedes(id),
  plantilla_id uuid references bitacora.auditoria_plantillas(id),
  tipo_auditoria text not null
    check (tipo_auditoria in ('Integral','Operativa','Calidad e Inocuidad','Seguridad e Higiene','Seguimiento')),
  estado text not null default 'Borrador'
    check (estado in ('Borrador','Programada','En curso','Finalizada','Cerrada','Cancelada')),
  fecha_programada date,
  fecha_inicio timestamptz,
  fecha_finalizacion timestamptz,
  auditor_id uuid not null references bitacora.perfiles(id),
  auditor_nombre text not null,
  participantes text[] not null default '{}',
  objetivo text,
  alcance text,
  normativa text,
  resumen text,
  conclusiones text,
  porcentaje_cumplimiento numeric(6,2) check (porcentaje_cumplimiento between 0 and 100),
  resultado text check (resultado is null or resultado in ('Conforme','Con observaciones','No conforme','Crítico')),
  auditoria_origen_id uuid references bitacora.auditorias_internas(id),
  created_by uuid not null default auth.uid() references bitacora.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bitacora.auditoria_respuestas (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references bitacora.auditorias_internas(id) on delete cascade,
  pregunta_id uuid not null references bitacora.auditoria_preguntas(id),
  valor text not null check (valor in ('Cumple','Parcial','No cumple','No observado')),
  puntaje numeric(6,2) check (puntaje between 0 and 2),
  observacion text,
  respondido_por uuid not null default auth.uid() references bitacora.perfiles(id),
  respondido_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auditoria_id, pregunta_id)
);

create table if not exists bitacora.auditoria_hallazgos (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references bitacora.auditorias_internas(id) on delete cascade,
  respuesta_id uuid references bitacora.auditoria_respuestas(id) on delete set null,
  numero integer not null,
  tipo text not null default 'Observación'
    check (tipo in ('Observación','Oportunidad de mejora','No conformidad')),
  criticidad text not null default 'Media'
    check (criticidad in ('Crítica','Alta','Media','Baja')),
  titulo text not null,
  descripcion text not null,
  contencion_inmediata text,
  accion_propuesta text,
  responsable_id uuid references bitacora.perfiles(id),
  responsable_nombre text,
  fecha_limite date,
  estado text not null default 'Abierto'
    check (estado in ('Abierto','En tratamiento','Pendiente de verificación','Cerrado','Descartado')),
  criterio_cierre text,
  verificacion text,
  verificado_por uuid references bitacora.perfiles(id),
  verificado_at timestamptz,
  no_conformidad_id bigint references bitacora.no_conformidades(id),
  capa_id bigint references bitacora.capa(id),
  created_by uuid not null default auth.uid() references bitacora.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auditoria_id, numero)
);

create index if not exists auditorias_internas_sede_fecha_idx
  on bitacora.auditorias_internas (sede_id, fecha_programada desc, created_at desc);
create index if not exists auditorias_internas_estado_idx
  on bitacora.auditorias_internas (estado);
create index if not exists auditoria_respuestas_auditoria_idx
  on bitacora.auditoria_respuestas (auditoria_id);
create index if not exists auditoria_hallazgos_auditoria_estado_idx
  on bitacora.auditoria_hallazgos (auditoria_id, estado);

create or replace function bitacora.set_auditoria_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, bitacora
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_auditoria_plantillas_updated_at on bitacora.auditoria_plantillas;
create trigger set_auditoria_plantillas_updated_at before update on bitacora.auditoria_plantillas
for each row execute function bitacora.set_auditoria_updated_at();
drop trigger if exists set_auditorias_internas_updated_at on bitacora.auditorias_internas;
create trigger set_auditorias_internas_updated_at before update on bitacora.auditorias_internas
for each row execute function bitacora.set_auditoria_updated_at();
drop trigger if exists set_auditoria_respuestas_updated_at on bitacora.auditoria_respuestas;
create trigger set_auditoria_respuestas_updated_at before update on bitacora.auditoria_respuestas
for each row execute function bitacora.set_auditoria_updated_at();
drop trigger if exists set_auditoria_hallazgos_updated_at on bitacora.auditoria_hallazgos;
create trigger set_auditoria_hallazgos_updated_at before update on bitacora.auditoria_hallazgos
for each row execute function bitacora.set_auditoria_updated_at();

-- Las funciones de alcance consultan perfiles y sedes sin confiar en user_metadata/JWT.
create or replace function bitacora.puede_ver_auditoria_sede(p_sede_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, bitacora
as $$
  select auth.uid() is not null and exists (
    select 1
    from bitacora.perfiles p
    left join bitacora.sedes s on s.id = p_sede_id
    where p.id = auth.uid()
      and p.activo = true
      and (
        p.rol in ('admin','editor')
        or lower(p.email) in ('tecnica@flykitchen.com.ar','rrhh.higieneyseguridad.emp@gmail.com')
        or (lower(p.email) = 'mriviere@flykitchen.com.ar' and lower(coalesce(s.tipo,'')) = 'aeropuerto')
        or (p.rol in ('encargado','sede') and p_sede_id = any(coalesce(p.sede_ids,'{}'::integer[])))
        or (p.rol = 'grupo' and p.grupo_id is not null and p.grupo_id = s.grupo_id)
      )
  );
$$;

create or replace function bitacora.puede_gestionar_auditoria_sede(p_sede_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, bitacora
as $$
  select auth.uid() is not null and exists (
    select 1
    from bitacora.perfiles p
    left join bitacora.sedes s on s.id = p_sede_id
    where p.id = auth.uid()
      and p.activo = true
      and (
        p.rol in ('admin','editor')
        or lower(p.email) in ('tecnica@flykitchen.com.ar','rrhh.higieneyseguridad.emp@gmail.com')
        or (lower(p.email) = 'mriviere@flykitchen.com.ar' and lower(coalesce(s.tipo,'')) = 'aeropuerto')
      )
  );
$$;

create or replace function bitacora.puede_responder_auditoria_sede(p_sede_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, bitacora
as $$
  select bitacora.puede_gestionar_auditoria_sede(p_sede_id)
    or exists (
      select 1
      from bitacora.perfiles p
      left join bitacora.sedes s on s.id = p_sede_id
      where p.id = auth.uid()
        and p.activo = true
        and (
          (p.rol in ('encargado','sede') and p_sede_id = any(coalesce(p.sede_ids,'{}'::integer[])))
          or (p.rol = 'grupo' and p.grupo_id is not null and p.grupo_id = s.grupo_id)
        )
    );
$$;

revoke all on function bitacora.puede_ver_auditoria_sede(integer) from public, anon;
revoke all on function bitacora.puede_gestionar_auditoria_sede(integer) from public, anon;
revoke all on function bitacora.puede_responder_auditoria_sede(integer) from public, anon;
grant execute on function bitacora.puede_ver_auditoria_sede(integer) to authenticated;
grant execute on function bitacora.puede_gestionar_auditoria_sede(integer) to authenticated;
grant execute on function bitacora.puede_responder_auditoria_sede(integer) to authenticated;

alter table bitacora.auditoria_plantillas enable row level security;
alter table bitacora.auditoria_secciones enable row level security;
alter table bitacora.auditoria_preguntas enable row level security;
alter table bitacora.auditorias_internas enable row level security;
alter table bitacora.auditoria_respuestas enable row level security;
alter table bitacora.auditoria_hallazgos enable row level security;

create policy auditoria_plantillas_read on bitacora.auditoria_plantillas for select to authenticated using (true);
create policy auditoria_secciones_read on bitacora.auditoria_secciones for select to authenticated using (true);
create policy auditoria_preguntas_read on bitacora.auditoria_preguntas for select to authenticated using (true);

create policy auditoria_plantillas_manage on bitacora.auditoria_plantillas for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol in ('admin','editor')))
with check (exists (select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol in ('admin','editor')));
create policy auditoria_secciones_manage on bitacora.auditoria_secciones for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol in ('admin','editor')))
with check (exists (select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol in ('admin','editor')));
create policy auditoria_preguntas_manage on bitacora.auditoria_preguntas for all to authenticated
using (exists (select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol in ('admin','editor')))
with check (exists (select 1 from bitacora.perfiles p where p.id=auth.uid() and p.activo and p.rol in ('admin','editor')));

create policy auditorias_internas_read on bitacora.auditorias_internas for select to authenticated
using (bitacora.puede_ver_auditoria_sede(sede_id));
create policy auditorias_internas_insert on bitacora.auditorias_internas for insert to authenticated
with check (created_by=auth.uid() and auditor_id=auth.uid() and bitacora.puede_gestionar_auditoria_sede(sede_id));
create policy auditorias_internas_update on bitacora.auditorias_internas for update to authenticated
using (bitacora.puede_gestionar_auditoria_sede(sede_id))
with check (bitacora.puede_gestionar_auditoria_sede(sede_id));

create policy auditoria_respuestas_read on bitacora.auditoria_respuestas for select to authenticated
using (exists (select 1 from bitacora.auditorias_internas a where a.id=auditoria_id and bitacora.puede_ver_auditoria_sede(a.sede_id)));
create policy auditoria_respuestas_insert on bitacora.auditoria_respuestas for insert to authenticated
with check (respondido_por=auth.uid() and exists (select 1 from bitacora.auditorias_internas a where a.id=auditoria_id and bitacora.puede_responder_auditoria_sede(a.sede_id)));
create policy auditoria_respuestas_update on bitacora.auditoria_respuestas for update to authenticated
using (exists (select 1 from bitacora.auditorias_internas a where a.id=auditoria_id and bitacora.puede_responder_auditoria_sede(a.sede_id)))
with check (exists (select 1 from bitacora.auditorias_internas a where a.id=auditoria_id and bitacora.puede_responder_auditoria_sede(a.sede_id)));

create policy auditoria_hallazgos_read on bitacora.auditoria_hallazgos for select to authenticated
using (exists (select 1 from bitacora.auditorias_internas a where a.id=auditoria_id and bitacora.puede_ver_auditoria_sede(a.sede_id)));
create policy auditoria_hallazgos_insert on bitacora.auditoria_hallazgos for insert to authenticated
with check (created_by=auth.uid() and exists (select 1 from bitacora.auditorias_internas a where a.id=auditoria_id and bitacora.puede_responder_auditoria_sede(a.sede_id)));
create policy auditoria_hallazgos_update on bitacora.auditoria_hallazgos for update to authenticated
using (exists (select 1 from bitacora.auditorias_internas a where a.id=auditoria_id and bitacora.puede_responder_auditoria_sede(a.sede_id)))
with check (exists (select 1 from bitacora.auditorias_internas a where a.id=auditoria_id and bitacora.puede_responder_auditoria_sede(a.sede_id)));

-- Data API: sin acceso anónimo y sin DELETE. La trazabilidad se conserva cancelando/cerrando.
revoke all on bitacora.auditoria_plantillas, bitacora.auditoria_secciones,
  bitacora.auditoria_preguntas, bitacora.auditorias_internas,
  bitacora.auditoria_respuestas, bitacora.auditoria_hallazgos from anon;
grant select, insert, update on bitacora.auditoria_plantillas, bitacora.auditoria_secciones,
  bitacora.auditoria_preguntas, bitacora.auditorias_internas,
  bitacora.auditoria_respuestas, bitacora.auditoria_hallazgos to authenticated;

-- Plantilla inicial basada en los relevamientos aportados y GMC 80/96.
insert into bitacora.auditoria_plantillas
  (codigo,nombre,descripcion,tipo_auditoria,tipos_sede,version,normativa)
values
  ('FK-AUD-INT-001','Auditoría integral de sede','Control operativo, calidad e inocuidad, seguridad e higiene, documentación, mantenimiento y personal.','Integral',array['Comedor','Hospital','Aeropuerto','Universidad','Planta','Oficina'],1,'Resolución Mercosur GMC 80/96; BPM; procedimientos internos Fly Kitchen')
on conflict (codigo) do nothing;

with p as (select id from bitacora.auditoria_plantillas where codigo='FK-AUD-INT-001')
insert into bitacora.auditoria_secciones (plantilla_id,codigo,nombre,peso,orden)
select p.id, v.codigo, v.nombre, v.peso, v.orden from p cross join (values
  ('1','Condiciones higiénico-sanitarias e infraestructura',10,1),
  ('2','Equipamiento, utensilios y mantenimiento',10,2),
  ('3','Equipos de frío y temperaturas',12,3),
  ('4','Higiene, POES y residuos',12,4),
  ('5','Almacenamiento, rotulado y trazabilidad',12,5),
  ('6','Control de plagas y productos químicos',8,6),
  ('7','Higiene personal y requisitos sanitarios',10,7),
  ('8','Elaboración, servicio y contaminación cruzada',12,8),
  ('9','Seguridad e higiene laboral',8,9),
  ('10','Documentación, registros y gestión operativa',6,10)
) as v(codigo,nombre,peso,orden)
on conflict (plantilla_id,codigo) do nothing;

with s as (
  select id,codigo from bitacora.auditoria_secciones
  where plantilla_id=(select id from bitacora.auditoria_plantillas where codigo='FK-AUD-INT-001')
), q(seccion_codigo,codigo,pregunta,critico,peso,orden) as (values
  ('1','1.1','¿Paredes, pisos, techos, iluminación y superficies se encuentran en condiciones higiénicas y de mantenimiento adecuadas?',false,1,1),
  ('1','1.2','¿Rejillas, desagües, ventilación y circulación de aire son adecuados y se encuentran limpios?',false,1,2),
  ('1','1.3','¿No existen humedad, moho, roturas, cavidades ni superficies que impidan una sanitización efectiva?',true,1.5,3),
  ('2','2.1','¿Equipos y utensilios de contacto alimentario se encuentran limpios, íntegros y en buen estado?',true,1.5,1),
  ('2','2.2','¿Hornos, freidoras, campanas y equipos de cocción no presentan grasa carbonizada ni riesgos de incendio?',true,1.5,2),
  ('2','2.3','¿Existe mantenimiento preventivo y correctivo documentado para equipos e instalaciones?',false,1,3),
  ('3','3.1','¿Heladeras, cámaras y freezers se encuentran ordenados, limpios, sin exceso de hielo y con burletes íntegros?',false,1,1),
  ('3','3.2','¿Los alimentos están protegidos, segregados, identificados y dentro de temperaturas seguras?',true,2,2),
  ('3','3.3','¿Se registran temperaturas y se documentan acciones correctivas ante desvíos?',true,1.5,3),
  ('4','4.1','¿Se cumple el cronograma POES y existen registros completos de limpieza y desinfección?',false,1.5,1),
  ('4','4.2','¿Superficies, pisos, zócalos, bajo mesadas y sectores de difícil acceso están limpios?',false,1,2),
  ('4','4.3','¿Los residuos se retiran con frecuencia y los contenedores están identificados, tapados y sanitizados?',false,1,3),
  ('5','5.1','¿Materias primas, elaborados y devoluciones se almacenan separados del piso y por familia de producto?',true,1.5,1),
  ('5','5.2','¿Todos los productos cuentan con rótulo legible, fecha, vencimiento y responsable cuando corresponde?',true,2,2),
  ('5','5.3','¿Se aplica rotación y existe trazabilidad de ingresos, egresos, remanentes, mermas y descartes?',false,1.5,3),
  ('6','6.1','¿Existe un programa vigente y verificable de control de plagas realizado por personal autorizado?',true,1.5,1),
  ('6','6.2','¿Químicos de limpieza están autorizados, identificados, dosificados y segregados de alimentos?',true,1.5,2),
  ('7','7.1','¿El personal posee capacitación y carnet/curso de manipulación vigente?',false,1,1),
  ('7','7.2','¿Se cumplen lavado de manos, indumentaria, cofia, calzado y demás requisitos de higiene personal?',true,1.5,2),
  ('7','7.3','¿Se gestionan adecuadamente enfermedades, heridas, accidentes y restricciones sanitarias del personal?',true,1.5,3),
  ('8','8.1','¿Se evita el contacto entre alimentos crudos, cocidos y listos para consumo?',true,2,1),
  ('8','8.2','¿Se utilizan correctamente tablas, utensilios, recipientes y sectores para prevenir contaminación cruzada?',true,1.5,2),
  ('8','8.3','¿Se cumple el menú/servicio programado y se documentan formalmente los cambios?',false,1,3),
  ('9','9.1','¿Instalaciones eléctricas, cables y tomas están protegidos y sin riesgos visibles?',true,2,1),
  ('9','9.2','¿Matafuegos, señalización, salidas y circulación se encuentran vigentes, accesibles y libres?',true,2,2),
  ('9','9.3','¿Se gestionan accidentes, EPP, condiciones ergonómicas y riesgos del puesto?',true,1.5,3),
  ('10','10.1','¿La documentación obligatoria está vigente, ordenada, limpia y disponible?',false,1,1),
  ('10','10.2','¿Los registros operativos se completan en tiempo y forma y los desvíos generan seguimiento?',false,1.5,2),
  ('10','10.3','¿Existen responsables, plazos y evidencias para las acciones correctivas pendientes?',false,1.5,3)
)
insert into bitacora.auditoria_preguntas
  (seccion_id,codigo,pregunta,requisito_critico,peso,orden)
select s.id,q.codigo,q.pregunta,q.critico,q.peso,q.orden
from q join s on s.codigo=q.seccion_codigo
on conflict (seccion_id,codigo) do nothing;
