alter table equipo.puestos_cct add column convenio_cct text;
update equipo.puestos_cct set convenio_cct = '389/04' where codigo like 'CCT-389-04-%';
alter table equipo.puestos_cct
  alter column convenio_cct set not null,
  add constraint puestos_cct_convenio_check check (convenio_cct in ('389/04','401/05'));

alter table bitacora.sedes add column convenio_cct text;
alter table bitacora.sedes add constraint sedes_convenio_cct_check
  check (convenio_cct is null or convenio_cct in ('389/04','401/05'));

insert into equipo.puestos_cct (codigo,nombre,nivel,area,convenio_cct) values
('CCT-401-05-C1-PEON-COCINA','Peón de cocina',1,'Cocina y elaboración','401/05'),
('CCT-401-05-C1-PEON','Peón',1,'Servicios generales','401/05'),
('CCT-401-05-C1-LAVACOPAS','Lavacopas',1,'Cocina y elaboración','401/05'),
('CCT-401-05-C1-JARDINERO','Jardinero',1,'Servicios generales','401/05'),
('CCT-401-05-C1-CADETE','Cadete',1,'Administración','401/05'),
('CCT-401-05-C1-SERENO','Sereno',1,'Servicios generales','401/05'),
('CCT-401-05-C2-SANDWICHERO','Sandwichero',2,'Cocina y elaboración','401/05'),
('CCT-401-05-C2-CAFETERO','Cafetero',2,'Servicio y distribución','401/05'),
('CCT-401-05-C2-DISTRIBUIDOR-REFRIGERIOS','Distribuidor/a de refrigerios',2,'Servicio y distribución','401/05'),
('CCT-401-05-C2-PORTERO','Portero',2,'Servicios generales','401/05'),
('CCT-401-05-C2-TELEFONISTA','Telefonista',2,'Administración','401/05'),
('CCT-401-05-C2-MEDIO-OFICIAL','Medio Oficial',2,'Mantenimiento','401/05'),
('CCT-401-05-C2-BODEGUERO','Bodeguero',2,'Depósito','401/05'),
('CCT-401-05-C2-DESPACHANTE','Despachante de comidas al mostrador',2,'Servicio y distribución','401/05'),
('CCT-401-05-C2-CAMARERA-ESCOLAR','Camarera de comedores escolares',2,'Servicio y distribución','401/05'),
('CCT-401-05-C2-COMIS-CAMARERO','Comis Camarero',2,'Servicio y distribución','401/05'),
('CCT-401-05-C3-CAMARERO','Camarero/a',3,'Servicio y distribución','401/05'),
('CCT-401-05-C3-AYUDANTE-COCINA','Ayudante de cocina',3,'Cocina y elaboración','401/05'),
('CCT-401-05-C3-MOZO-MOSTRADOR','Mozo de mostrador',3,'Servicio y distribución','401/05'),
('CCT-401-05-C3-MOZO-VENDEDOR','Mozo vendedor',3,'Servicio y distribución','401/05'),
('CCT-401-05-C3-LAVANDERA','Lavandera',3,'Servicios generales','401/05'),
('CCT-401-05-C3-MUCAMA','Mucama',3,'Servicios generales','401/05'),
('CCT-401-05-C3-CHOFER','Chofer',3,'Logística','401/05'),
('CCT-401-05-C3-GUARDAVIDAS','Guardavidas',3,'Servicios generales','401/05'),
('CCT-401-05-C3-PLANCHADORA','Planchadora',3,'Servicios generales','401/05'),
('CCT-401-05-C3-MOZO-GERENCIA','Mozo de Gerencia',3,'Servicio y distribución','401/05'),
('CCT-401-05-C3-JEFE-TELEFONISTA','Jefe de telefonista',3,'Administración','401/05'),
('CCT-401-05-C3-JEFE-LAVADEROS','Jefe de lavaderos',3,'Servicios generales','401/05'),
('CCT-401-05-C4-MOZO-SALON','Mozo de salón',4,'Servicio y distribución','401/05'),
('CCT-401-05-C4-COMIS-COCINA','Comis de cocina',4,'Cocina y elaboración','401/05'),
('CCT-401-05-C4-ADMINISTRATIVO','Empleado administrativo',4,'Administración','401/05'),
('CCT-401-05-C4-ENCARGADO-DESPENSA','Encargado de despensa',4,'Depósito','401/05'),
('CCT-401-05-C4-CONSERJE','Conserje',4,'Servicios generales','401/05'),
('CCT-401-05-C4-CAJERO-ADICIONISTA','Cajero adicionista',4,'Administración','401/05'),
('CCT-401-05-C4-PU4','PU4',4,'Operación pública','401/05'),
('CCT-401-05-C5-GOBERNANTA','Gobernanta',5,'Supervisión','401/05'),
('CCT-401-05-C5-COCINERO-EDUCACIONAL','Cocinero de establecimiento educacional',5,'Cocina y elaboración','401/05'),
('CCT-401-05-C5-RECEPCIONISTA','Recepcionista',5,'Administración','401/05'),
('CCT-401-05-C5-NUTRICION-A','Licenciado/a en Nutrición (Nivel A)',5,'Nutrición','401/05'),
('CCT-401-05-C5-PU5','PU5',5,'Operación pública','401/05'),
('CCT-401-05-C6-COCINERO','Cocinero',6,'Cocina y elaboración','401/05'),
('CCT-401-05-C6-PASTELERO','Pastelero',6,'Cocina y elaboración','401/05'),
('CCT-401-05-C6-PARRILLERO','Parrillero',6,'Cocina y elaboración','401/05'),
('CCT-401-05-C6-MAITRE','Maitre',6,'Servicio y distribución','401/05'),
('CCT-401-05-C6-JEFE-RECEPCION','Jefe de recepción',6,'Administración','401/05'),
('CCT-401-05-C6-PANADERO','Panadero',6,'Cocina y elaboración','401/05'),
('CCT-401-05-C6-ANALISTA-ADMIN','Analista administrativo',6,'Administración','401/05'),
('CCT-401-05-C6-NUTRICION-B','Licenciado/a en Nutrición (Nivel B)',6,'Nutrición','401/05'),
('CCT-401-05-C7-JEFE-COCINEROS','Jefe de Cocineros',7,'Cocina y elaboración','401/05'),
('CCT-401-05-C7-NUTRICION-C','Licenciado/a en Nutrición (Nivel C)',7,'Nutrición','401/05')
on conflict (codigo) do update set nombre=excluded.nombre,nivel=excluded.nivel,area=excluded.area,convenio_cct=excluded.convenio_cct,activo=true;

create index puestos_cct_convenio_nivel_idx on equipo.puestos_cct (convenio_cct,nivel,nombre) where activo=true;
comment on column bitacora.sedes.convenio_cct is 'Convenio aplicable al establecimiento para filtrar el catálogo de puestos.';
