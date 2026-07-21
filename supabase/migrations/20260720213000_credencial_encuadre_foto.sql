alter table equipo.credenciales_personal
  add column if not exists foto_pos_x numeric(5,2) not null default 50 check (foto_pos_x between 0 and 100),
  add column if not exists foto_pos_y numeric(5,2) not null default 50 check (foto_pos_y between 0 and 100),
  add column if not exists foto_zoom numeric(4,2) not null default 1 check (foto_zoom between 1 and 1.8);
