-- Carga puntual autorizada por el usuario.
-- Proyecto correcto: mixyhfdlzjarvszinytk (cerdova-db).
-- Inserta las dos solicitudes ya enviadas para Hospital Villa Dolores.
-- No borra ni modifica registros existentes. Evita duplicar por sede + fecha + puesto + motivo.

begin;

with sede as (
  select id
  from bitacora.sedes
  where activa = true
    and nombre ilike 'Hospital Villa Dolores'
  order by id
  limit 1
), solicitudes as (
  select *
  from (
    values
      (
        'Camarera'::text,
        'Rotativo:

* Turno mañana: 07:00 a 15:00 hs
* Turno tarde: 14:30 a 22:30 hs'::text,
        '2026-06-24'::date,
        'Alta'::text,
        'Eventual'::text,
        'Cobertura eventual por licencias vigentes, incluyendo carpeta médica extendida desde febrero y cobertura de vacaciones.'::text,
        1::integer,
        'Eventual'::text,
        'Limpieza del sector
Control de stock
Distribución de raciones
Apoyo como ayudante de cocina
Colaboración general en el servicio'::text,
        'Disponibilidad horaria para turnos rotativos
Predisposición para aprender el puesto
Responsabilidad y compromiso con el servicio
Buena disposición para el trabajo en equipo'::text,
        'Experiencia en cocina o servicios gastronómicos, deseable pero no excluyente.'::text,
        'A definir según requerimiento de ingreso y preocupacional.'::text,
        'María Elizabeth Mío'::text,
        '3544-418626'::text,
        'Se solicita agilizar el proceso de entrevistas, selección y turnos preocupacionales para poder iniciar la capacitación a la mayor brevedad posible.'::text
      ),
      (
        'Camarera / Ayudante de cocina'::text,
        'Rotativo:

* Turno mañana: 07:00 a 15:00 hs
* Turno tarde: 14:30 a 22:30 hs'::text,
        '2026-06-24'::date,
        'Alta'::text,
        'Permanente'::text,
        'Cobertura de puesto permanente por renuncia de una cocinera.'::text,
        1::integer,
        'Permanente'::text,
        'Limpieza del sector
Control de stock
Distribución de raciones
Apoyo como ayudante de cocina
Colaboración en tareas generales de cocina
Asistencia en la preparación y organización del servicio'::text,
        'Disponibilidad horaria para turnos rotativos
Predisposición para aprender el puesto
Responsabilidad y compromiso
Capacidad para adaptarse a la dinámica del servicio hospitalario
Buena disposición para el trabajo en equipo'::text,
        'Experiencia en cocina o servicios gastronómicos, deseable pero no excluyente.'::text,
        'A definir según requerimiento de ingreso y preocupacional.'::text,
        'María Elizabeth Mío'::text,
        '3544-418626'::text,
        'Se solicita agilizar el proceso de entrevistas, selección y turnos preocupacionales para poder iniciar la capacitación a la mayor brevedad posible.'::text
      )
  ) as v(
    puesto,
    horario,
    fecha_apertura,
    urgencia,
    periodo_necesidad,
    motivo,
    cantidad,
    modalidad,
    tareas,
    requisitos,
    experiencia,
    documentacion,
    responsable,
    contacto,
    observaciones
  )
), inserted as (
  insert into equipo.reclutamiento_solicitudes (
    estado,
    puesto,
    sede_id,
    horario,
    fecha_apertura,
    urgencia,
    periodo_necesidad,
    motivo,
    cantidad,
    modalidad,
    tareas,
    requisitos,
    experiencia,
    documentacion,
    responsable,
    contacto,
    observaciones
  )
  select
    'recibiendo_cvs',
    solicitudes.puesto,
    sede.id,
    solicitudes.horario,
    solicitudes.fecha_apertura,
    solicitudes.urgencia,
    solicitudes.periodo_necesidad,
    solicitudes.motivo,
    solicitudes.cantidad,
    solicitudes.modalidad,
    solicitudes.tareas,
    solicitudes.requisitos,
    solicitudes.experiencia,
    solicitudes.documentacion,
    solicitudes.responsable,
    solicitudes.contacto,
    solicitudes.observaciones
  from solicitudes
  cross join sede
  where not exists (
    select 1
    from equipo.reclutamiento_solicitudes rs
    where rs.sede_id = sede.id
      and rs.fecha_apertura = solicitudes.fecha_apertura
      and rs.puesto = solicitudes.puesto
      and rs.motivo = solicitudes.motivo
  )
  returning id, puesto, periodo_necesidad, estado
)
select *
from inserted
order by puesto;

commit;
