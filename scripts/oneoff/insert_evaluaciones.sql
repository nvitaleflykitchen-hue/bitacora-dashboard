INSERT INTO equipo.evaluaciones (
    persona_id, evaluador_nombre, evaluador_cargo, antiguedad_con_evaluado, fecha_evaluacion,
    d1_cumple_actividades, d2_sin_supervision, d3_comprende_prioridades,
    e1_cooperacion, e2_comunicacion, e3_maneja_desacuerdos, e4_ambiente_confianza, e5_evita_conflictos,
    p1_cumple_horario, p2_aseo_personal, p3_uniforme,
    resultado_global, supero_prueba, observaciones_rrhh, sugerencias_evaluador, puntaje_calculado
) VALUES
-- Nicolas Peralta
('c332394f-e465-458d-b204-ea49f2e07258', 'Gaston Gracia', 'Encargado', 'Menor a 3 meses', '2026-06-24',
 3, 2, 2,
 3, 3, 3, 2, 3,
 3, 4, 4,
 'Aceptable', false, 
 'Presenta dificultades de adaptación al ritmo operativo y requiere supervisión frecuente para el correcto desarrollo de sus tareas. Continúa bajo seguimiento y evaluación periódica respecto de su evolución y adaptación al perfil requerido para el puesto.',
 '1. SIGUE NECESITANDO SUPERVICION Y HAY QUE ERRADICAR MALOS HABITOS.
2. AL MOMENTO DE TRABAJR ES RAPIDO Y COLABORA CON EL EQUIPO.
3. SER MAS PROACTIVO, NO QUERER DELEGAR TAREAS, ENTENDER QUE CUANDO HAY TIEMPO MUERTO LO MEJOR ES TERMINAR TAREAS ATRASADAS, MEJORAR LOS MODOS Y FORMAS.
4. NO REPRESENTA UN PELIGRO PARA LA OPERACIÓN, PERO ES IMPORTANTE QUE TERMINE DE ADECUARSE A LAS NECESIDADES Y N IMPROVIZAR.
5. LA PERMANENCIA EN EL PUESTO ESTA SUPERDITADA A EL CAMBIO EN SUS ACTITUDES ANTES MENCIONADAS.', 32),

-- Angelo Poggi
('a198ec65-a471-42de-b01c-0c9d8a67187f', 'Gaston Gracia', 'Encargado', 'Menor a 3 meses', '2026-06-24',
 5, 4, 4,
 4, 3, 4, 4, 4,
 5, 5, 4,
 'Alto', false,
 'Muestra predisposición positiva, compromiso con las tareas y buena adaptación inicial al entorno operativo. Se encuentra bajo supervisión y seguimiento desarrollando tareas en cocina y verdura.',
 '1. SIGUE NECESITANDO SUPERVICION, PERO ES APLICADO Y APRENDE RAPIDO.
2. COMPROMISO, DISIPLINA Y ATENCION AL ENTORNO.
3. COMUNICAR DUDAS.
4. NO, TIENE BUENA ACTITUD ANTE EL TRABAJO Y LA AUTORIDAD.
5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR.', 46),

-- Gianni Scialfa
('4ebc2216-d57e-4dd6-8936-f382b1ac467f', 'Gaston Gracia', 'Encargado', 'Superó el periodo de prueba', '2026-06-24',
 3, 3, 2,
 1, 1, 1, 1, 1,
 4, 5, 4,
 'Bajo', true,
 'Presenta dificultades de integración y desempeño dentro del equipo operativo, evidenciando conductas que impactan negativamente en la dinámica laboral y en la productividad del sector. Se considera conveniente revisar su continuidad laboral a fin de preservar el correcto funcionamiento operativo y la estabilidad del equipo.',
 '1. NECESITA SUPERVICION CONSTANTE PARA QUE CUMPLA LAS TAREAS EN TIEMPO Y FORMA.
2. NADA DESTACABLE.
3. TRABAJAR A LA PAR DEL EQUIPO, NO PONER ESCUSAS PARA MEJORAR SU DESEMPEÑO, NO PONER CONSTANTES TRABAS A LAS TAREAS QUE SE LE SOLICITA, DEJAR DE BOICOTEAR LAS TAREAS PARA NO CUMPLIR EN TIEMPO.
4. NO SE ACONSEJA LA PERMANENCIA YA QUE ESTA PERCUDIENDO A LOS NUEVOS INTEGRANTES.
5. SE RECOMIENDA BUSCAR UN REMPLAZO LO ANTES POSIBLE (CHOFER DE CAMION).', 26),

-- Nahuel Cano
('dcd9474d-270a-4e89-9ac1-eeab9ca098db', 'Gaston Gracia', 'Encargado', 'Superó el periodo de prueba', '2026-06-24',
 4, 3, 4,
 1, 2, 1, 1, 1,
 4, 5, 4,
 'Bajo', true,
 'Perfil con conductas conflictivas que afectan el clima laboral y generan fallas operativas, incluyendo demoras en servicios y reportes negativos por parte de la aerolínea. Debido al impacto en la operación, se recomienda evaluar su continuidad en la estructura.',
 '1. NECESITA SUPERVICION POR ESTAR DESCONFORME CON LA EMPRESA Y CON LA AUTORIDAD, MUESTAR ACTITUDES MUY NEGATIVAS PARA LA OPERACIÓN.
2. CONOCIMIENTO DE TODOS LOS PROCESOS Y UNA GRAN CAPACIDAD PARA ANTICIPAR SITUACIONES Y PROYECTAR TAREAS.
3. TRABAJAR ACORDE AL EQUIPO, DEJAR DE SER UNA FIGURA NEGATIVA, SER COLABORATIVO, NO BOICOTEAR LAS OPERACIONES PARA PERJUDICAR Y GENERAR MALESTAR EN EL EQUIPO, DEJAR DE DELEGAR TAREAS, ENTENDER SU PUESTO EN EL EQUIPO.
4. NO SE ACONSEJA LA PERMANENCIA YA QUE ESTA PERCUDIENDO A LOS NUEVOS INTEGRANTES Y SOSTIENE UNA RELACION NEGATIVA CON LOS MAS ANTIGUOS.
5. SE RECOMIENDA SU DESVINCULACION Y BUSQUEDA DE REMPLAZO PARA TAREAS DE VERDURA Y ARMADO.', 30),

-- Teresa Cejas
('8ede2880-fc69-40de-b062-de3d69edaf09', 'Gaston Gracia', 'Encargado', 'Superó el periodo de prueba', '2026-06-24',
 5, 5, 5,
 4, 3, 3, 3, 2,
 5, 5, 4,
 'Alto', true,
 'Colaborador operativo proactivo, responsable y orientado a objetivos, que anticipa problemas de producción y demuestra un compromiso excepcional al cubrir faltantes de personal y postergar descansos; por su desempeño y flexibilidad, se recomienda formalmente su recategorizacion o un incentivo salarial.',
 '1. SIN NINGUN PROBLEMA.
2. COMPROMISO, DISIPLINA Y PREVICION.
3. LA RELACION CON SUS PARES Y AUTORIDAD. (CARÁCTER FUERTE Y CHOCANTE)
4. NO, MUESTRA UN PERFIL CONCILIADOR Y TRATABLE.
5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR Y REMUNERAR SU ESFUERZO.', 44),

-- Daniel Marano
('7c0ecd57-73a0-4439-b9d8-024748474715', 'Gaston Gracia', 'Encargado', 'Superó el periodo de prueba', '2026-06-24',
 5, 5, 5,
 5, 4, 4, 4, 3,
 5, 5, 4,
 'Alto', true,
 'Empleado comprometido y proactivo en la planificación y objetivos de producción. Destaca por su flexibilidad para cubrir funciones adicionales según las necesidades del sector, garantizando la continuidad operativa y manteniendo excelentes relaciones internas. Se sugiere una recategorizacion o incentivo en el sueldo',
 '1. SIN NINGUN PROBLEMA.
2. RESOLUTIVO, COMPROMISO Y PREVICION.
3. LA COMUNICACIONDE FALTANTES.
4. NO, MUESTRA UN PERFIL CONCILIADOR Y TRATABLE. AYUDA A RESOLVER LAS DIFERENCIAS.
5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR Y REMUNERAR SU ESFUERZO.', 49),

-- Jose Veron
('5e166110-1335-4f14-8514-9a3cdaf92254', 'Gaston Gracia', 'Encargado', 'Superó el periodo de prueba', '2026-06-24',
 5, 5, 5,
 3, 3, 4, 3, 2,
 5, 5, 4,
 'Alto', true,
 'Perfil experimentado y comprometido con los objetivos del sector. Destaca por su capacidad para resolver incidentes, capacitar al personal ingresante y asumir funciones extraordinarias ante necesidades operativas, manteniendo siempre una actitud profesional. Se suguiere su recategorizacion o reconocimiento en su remuneracion.',
 '1. SIN NINGUN PROBLEMA
2. CONOCIMIENTO DE LOS PROCESOS, DISIPLINA Y COMPROMISO.
3. COLABORAR MAS CON SUS COMPAÑEROS.
4. NO, MANEJA LAS DIFERENCIAS DE MANERA POSITIVA Y CUIDA EL TRABAJO.
5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR Y REMUNERAR SU ESFUERZO.', 44),

-- Kevin Herrera
('de9072cd-aefb-4473-ae27-f1b89a2bcb0a', 'Gaston Gracia', 'Encargado', 'Menor a 3 meses', '2026-06-24',
 5, 5, 5,
 4, 5, 4, 4, 4,
 5, 5, 4,
 'Alto', false,
 'Mantiene una actitud proactiva, buena predisposición al aprendizaje y adecuado cumplimiento de tareas. Amplio conocimiento de los movimientos en el aeropuerto y contacto con diferentes autoridades del aeropuerto. Tener en cuenta para reubicacion',
 '1. SI, ESTA A LA ALTURA DE LAS CIRCUNSTANCIAS.
2. CONOCIMIENTO DE LOS PROCESOS, DISIPLINA Y COMPROMISO.
3. COMUNICAR LAS DUDAS.
4. NO, ES UNA PERSONA RESOLUTIVA Y PRACTICA AL MOMENTO DE UN PROBLEMA
5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR.', 50);
