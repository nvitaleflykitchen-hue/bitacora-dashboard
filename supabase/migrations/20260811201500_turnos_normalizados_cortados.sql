-- Tipos de turno normalizados y soporte de doble rango para turno cortado.

alter table equipo.horario_turnos
  add column tipo text,
  add column hora_desde_2 time,
  add column hora_hasta_2 time;

update equipo.horario_turnos set tipo = nombre;

alter table equipo.horario_turnos
  alter column tipo set not null,
  add constraint horario_turnos_tipo_check
    check (tipo in ('Matutino','Vespertino','Nocturno','Intermedio','Cortado')),
  add constraint horario_turnos_tipo_nombre_check
    check (nombre = tipo),
  add constraint horario_turnos_segundo_rango_check
    check (
      (tipo = 'Cortado'
        and hora_desde < hora_hasta
        and hora_desde_2 is not null
        and hora_hasta_2 is not null
        and hora_desde_2 < hora_hasta_2
        and hora_hasta <= hora_desde_2)
      or
      (tipo <> 'Cortado' and hora_desde_2 is null and hora_hasta_2 is null)
    );

create unique index horario_turnos_sede_tipo_uidx
  on equipo.horario_turnos (sede_id, tipo);

comment on column equipo.horario_turnos.tipo is 'Tipo normalizado: Matutino, Vespertino, Nocturno, Intermedio o Cortado.';
comment on column equipo.horario_turnos.hora_desde_2 is 'Inicio del segundo tramo, obligatorio solamente para turno Cortado.';
comment on column equipo.horario_turnos.hora_hasta_2 is 'Fin del segundo tramo, obligatorio solamente para turno Cortado.';
