alter table equipo.credenciales_personal
  add column if not exists grupo_sanguineo text null
  check (grupo_sanguineo is null or grupo_sanguineo in ('A+','A-','B+','B-','AB+','AB-','O+','O-'));
