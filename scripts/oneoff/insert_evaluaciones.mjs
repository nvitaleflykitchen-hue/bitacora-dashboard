import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const evaluaciones = [
  {
    persona_id: 'c332394f-e465-458d-b204-ea49f2e07258',
    evaluador_nombre: 'Gaston Gracia',
    evaluador_cargo: 'Encargado',
    antiguedad_con_evaluado: 'Menor a 3 meses',
    fecha_evaluacion: '2026-06-24',
    d1_cumple_actividades: 3,
    d2_sin_supervision: 2,
    d3_comprende_prioridades: 2,
    e1_cooperacion: 3,
    e2_comunicacion: 3,
    e3_maneja_desacuerdos: 3,
    e4_ambiente_confianza: 2,
    e5_evita_conflictos: 3,
    p1_cumple_horario: 3,
    p2_aseo_personal: 4,
    p3_uniforme: 4,
    resultado_global: 'Aceptable',
    supero_prueba: false,
    observaciones_rrhh: 'Presenta dificultades de adaptación al ritmo operativo y requiere supervisión frecuente para el correcto desarrollo de sus tareas. Continúa bajo seguimiento y evaluación periódica respecto de su evolución y adaptación al perfil requerido para el puesto.',
    sugerencias_evaluador: '1. SIGUE NECESITANDO SUPERVICION Y HAY QUE ERRADICAR MALOS HABITOS.\n2. AL MOMENTO DE TRABAJR ES RAPIDO Y COLABORA CON EL EQUIPO.\n3. SER MAS PROACTIVO, NO QUERER DELEGAR TAREAS, ENTENDER QUE CUANDO HAY TIEMPO MUERTO LO MEJOR ES TERMINAR TAREAS ATRASADAS, MEJORAR LOS MODOS Y FORMAS.\n4. NO REPRESENTA UN PELIGRO PARA LA OPERACIÓN, PERO ES IMPORTANTE QUE TERMINE DE ADECUARSE A LAS NECESIDADES Y N IMPROVIZAR.\n5. LA PERMANENCIA EN EL PUESTO ESTA SUPERDITADA A EL CAMBIO EN SUS ACTITUDES ANTES MENCIONADAS.',
    puntaje_calculado: 32
  },
  {
    persona_id: 'a198ec65-a471-42de-b01c-0c9d8a67187f',
    evaluador_nombre: 'Gaston Gracia',
    evaluador_cargo: 'Encargado',
    antiguedad_con_evaluado: 'Menor a 3 meses',
    fecha_evaluacion: '2026-06-24',
    d1_cumple_actividades: 5,
    d2_sin_supervision: 4,
    d3_comprende_prioridades: 4,
    e1_cooperacion: 4,
    e2_comunicacion: 3,
    e3_maneja_desacuerdos: 4,
    e4_ambiente_confianza: 4,
    e5_evita_conflictos: 4,
    p1_cumple_horario: 5,
    p2_aseo_personal: 5,
    p3_uniforme: 4,
    resultado_global: 'Alto',
    supero_prueba: false,
    observaciones_rrhh: 'Muestra predisposición positiva, compromiso con las tareas y buena adaptación inicial al entorno operativo. Se encuentra bajo supervisión y seguimiento desarrollando tareas en cocina y verdura.',
    sugerencias_evaluador: '1. SIGUE NECESITANDO SUPERVICION, PERO ES APLICADO Y APRENDE RAPIDO.\n2. COMPROMISO, DISIPLINA Y ATENCION AL ENTORNO.\n3. COMUNICAR DUDAS.\n4. NO, TIENE BUENA ACTITUD ANTE EL TRABAJO Y LA AUTORIDAD.\n5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR.',
    puntaje_calculado: 46
  },
  {
    persona_id: '4ebc2216-d57e-4dd6-8936-f382b1ac467f',
    evaluador_nombre: 'Gaston Gracia',
    evaluador_cargo: 'Encargado',
    antiguedad_con_evaluado: 'Superó el periodo de prueba',
    fecha_evaluacion: '2026-06-24',
    d1_cumple_actividades: 3,
    d2_sin_supervision: 3,
    d3_comprende_prioridades: 2,
    e1_cooperacion: 1,
    e2_comunicacion: 1,
    e3_maneja_desacuerdos: 1,
    e4_ambiente_confianza: 1,
    e5_evita_conflictos: 1,
    p1_cumple_horario: 4,
    p2_aseo_personal: 5,
    p3_uniforme: 4,
    resultado_global: 'Bajo',
    supero_prueba: true,
    observaciones_rrhh: 'Presenta dificultades de integración y desempeño dentro del equipo operativo, evidenciando conductas que impactan negativamente en la dinámica laboral y en la productividad del sector. Se considera conveniente revisar su continuidad laboral a fin de preservar el correcto funcionamiento operativo y la estabilidad del equipo.',
    sugerencias_evaluador: '1. NECESITA SUPERVICION CONSTANTE PARA QUE CUMPLA LAS TAREAS EN TIEMPO Y FORMA.\n2. NADA DESTACABLE.\n3. TRABAJAR A LA PAR DEL EQUIPO, NO PONER ESCUSAS PARA MEJORAR SU DESEMPEÑO, NO PONER CONSTANTES TRABAS A LAS TAREAS QUE SE LE SOLICITA, DEJAR DE BOICOTEAR LAS TAREAS PARA NO CUMPLIR EN TIEMPO.\n4. NO SE ACONSEJA LA PERMANENCIA YA QUE ESTA PERCUDIENDO A LOS NUEVOS INTEGRANTES.\n5. SE RECOMIENDA BUSCAR UN REMPLAZO LO ANTES POSIBLE (CHOFER DE CAMION).',
    puntaje_calculado: 26
  },
  {
    persona_id: 'dcd9474d-270a-4e89-9ac1-eeab9ca098db',
    evaluador_nombre: 'Gaston Gracia',
    evaluador_cargo: 'Encargado',
    antiguedad_con_evaluado: 'Superó el periodo de prueba',
    fecha_evaluacion: '2026-06-24',
    d1_cumple_actividades: 4,
    d2_sin_supervision: 3,
    d3_comprende_prioridades: 4,
    e1_cooperacion: 1,
    e2_comunicacion: 2,
    e3_maneja_desacuerdos: 1,
    e4_ambiente_confianza: 1,
    e5_evita_conflictos: 1,
    p1_cumple_horario: 4,
    p2_aseo_personal: 5,
    p3_uniforme: 4,
    resultado_global: 'Bajo',
    supero_prueba: true,
    observaciones_rrhh: 'Perfil con conductas conflictivas que afectan el clima laboral y generan fallas operativas, incluyendo demoras en servicios y reportes negativos por parte de la aerolínea. Debido al impacto en la operación, se recomienda evaluar su continuidad en la estructura.',
    sugerencias_evaluador: '1. NECESITA SUPERVICION POR ESTAR DESCONFORME CON LA EMPRESA Y CON LA AUTORIDAD, MUESTAR ACTITUDES MUY NEGATIVAS PARA LA OPERACIÓN.\n2. CONOCIMIENTO DE TODOS LOS PROCESOS Y UNA GRAN CAPACIDAD PARA ANTICIPAR SITUACIONES Y PROYECTAR TAREAS.\n3. TRABAJAR ACORDE AL EQUIPO, DEJAR DE SER UNA FIGURA NEGATIVA, SER COLABORATIVO, NO BOICOTEAR LAS OPERACIONES PARA PERJUDICAR Y GENERAR MALESTAR EN EL EQUIPO, DEJAR DE DELEGAR TAREAS, ENTENDER SU PUESTO EN EL EQUIPO.\n4. NO SE ACONSEJA LA PERMANENCIA YA QUE ESTA PERCUDIENDO A LOS NUEVOS INTEGRANTES Y SOSTIENE UNA RELACION NEGATIVA CON LOS MAS ANTIGUOS.\n5. SE RECOMIENDA SU DESVINCULACION Y BUSQUEDA DE REMPLAZO PARA TAREAS DE VERDURA Y ARMADO.',
    puntaje_calculado: 30
  },
  {
    persona_id: '8ede2880-fc69-40de-b062-de3d69edaf09',
    evaluador_nombre: 'Gaston Gracia',
    evaluador_cargo: 'Encargado',
    antiguedad_con_evaluado: 'Superó el periodo de prueba',
    fecha_evaluacion: '2026-06-24',
    d1_cumple_actividades: 5,
    d2_sin_supervision: 5,
    d3_comprende_prioridades: 5,
    e1_cooperacion: 4,
    e2_comunicacion: 3,
    e3_maneja_desacuerdos: 3,
    e4_ambiente_confianza: 3,
    e5_evita_conflictos: 2,
    p1_cumple_horario: 5,
    p2_aseo_personal: 5,
    p3_uniforme: 4,
    resultado_global: 'Alto',
    supero_prueba: true,
    observaciones_rrhh: 'Colaborador operativo proactivo, responsable y orientado a objetivos, que anticipa problemas de producción y demuestra un compromiso excepcional al cubrir faltantes de personal y postergar descansos; por su desempeño y flexibilidad, se recomienda formalmente su recategorizacion o un incentivo salarial.',
    sugerencias_evaluador: '1. SIN NINGUN PROBLEMA.\n2. COMPROMISO, DISIPLINA Y PREVICION.\n3. LA RELACION CON SUS PARES Y AUTORIDAD. (CARÁCTER FUERTE Y CHOCANTE)\n4. NO, MUESTRA UN PERFIL CONCILIADOR Y TRATABLE.\n5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR Y REMUNERAR SU ESFUERZO.',
    puntaje_calculado: 44
  },
  {
    persona_id: '7c0ecd57-73a0-4439-b9d8-024748474715',
    evaluador_nombre: 'Gaston Gracia',
    evaluador_cargo: 'Encargado',
    antiguedad_con_evaluado: 'Superó el periodo de prueba',
    fecha_evaluacion: '2026-06-24',
    d1_cumple_actividades: 5,
    d2_sin_supervision: 5,
    d3_comprende_prioridades: 5,
    e1_cooperacion: 5,
    e2_comunicacion: 4,
    e3_maneja_desacuerdos: 4,
    e4_ambiente_confianza: 4,
    e5_evita_conflictos: 3,
    p1_cumple_horario: 5,
    p2_aseo_personal: 5,
    p3_uniforme: 4,
    resultado_global: 'Alto',
    supero_prueba: true,
    observaciones_rrhh: 'Empleado comprometido y proactivo en la planificación y objetivos de producción. Destaca por su flexibilidad para cubrir funciones adicionales según las necesidades del sector, garantizando la continuidad operativa y manteniendo excelentes relaciones internas. Se sugiere una recategorizacion o incentivo en el sueldo',
    sugerencias_evaluador: '1. SIN NINGUN PROBLEMA.\n2. RESOLUTIVO, COMPROMISO Y PREVICION.\n3. LA COMUNICACIONDE FALTANTES.\n4. NO, MUESTRA UN PERFIL CONCILIADOR Y TRATABLE. AYUDA A RESOLVER LAS DIFERENCIAS.\n5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR Y REMUNERAR SU ESFUERZO.',
    puntaje_calculado: 49
  },
  {
    persona_id: '5e166110-1335-4f14-8514-9a3cdaf92254',
    evaluador_nombre: 'Gaston Gracia',
    evaluador_cargo: 'Encargado',
    antiguedad_con_evaluado: 'Superó el periodo de prueba',
    fecha_evaluacion: '2026-06-24',
    d1_cumple_actividades: 5,
    d2_sin_supervision: 5,
    d3_comprende_prioridades: 5,
    e1_cooperacion: 3,
    e2_comunicacion: 3,
    e3_maneja_desacuerdos: 4,
    e4_ambiente_confianza: 3,
    e5_evita_conflictos: 2,
    p1_cumple_horario: 5,
    p2_aseo_personal: 5,
    p3_uniforme: 4,
    resultado_global: 'Alto',
    supero_prueba: true,
    observaciones_rrhh: 'Perfil experimentado y comprometido con los objetivos del sector. Destaca por su capacidad para resolver incidentes, capacitar al personal ingresante y asumir funciones extraordinarias ante necesidades operativas, manteniendo siempre una actitud profesional. Se suguiere su recategorizacion o reconocimiento en su remuneracion.',
    sugerencias_evaluador: '1. SIN NINGUN PROBLEMA\n2. CONOCIMIENTO DE LOS PROCESOS, DISIPLINA Y COMPROMISO.\n3. COLABORAR MAS CON SUS COMPAÑEROS.\n4. NO, MANEJA LAS DIFERENCIAS DE MANERA POSITIVA Y CUIDA EL TRABAJO.\n5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR Y REMUNERAR SU ESFUERZO.',
    puntaje_calculado: 44
  },
  {
    persona_id: 'de9072cd-aefb-4473-ae27-f1b89a2bcb0a',
    evaluador_nombre: 'Gaston Gracia',
    evaluador_cargo: 'Encargado',
    antiguedad_con_evaluado: 'Menor a 3 meses',
    fecha_evaluacion: '2026-06-24',
    d1_cumple_actividades: 5,
    d2_sin_supervision: 5,
    d3_comprende_prioridades: 5,
    e1_cooperacion: 4,
    e2_comunicacion: 5,
    e3_maneja_desacuerdos: 4,
    e4_ambiente_confianza: 4,
    e5_evita_conflictos: 4,
    p1_cumple_horario: 5,
    p2_aseo_personal: 5,
    p3_uniforme: 4,
    resultado_global: 'Alto',
    supero_prueba: false,
    observaciones_rrhh: 'Mantiene una actitud proactiva, buena predisposición al aprendizaje y adecuado cumplimiento de tareas. Amplio conocimiento de los movimientos en el aeropuerto y contacto con diferentes autoridades del aeropuerto. Tener en cuenta para reubicacion',
    sugerencias_evaluador: '1. SI, ESTA A LA ALTURA DE LAS CIRCUNSTANCIAS.\n2. CONOCIMIENTO DE LOS PROCESOS, DISIPLINA Y COMPROMISO.\n3. COMUNICAR LAS DUDAS.\n4. NO, ES UNA PERSONA RESOLUTIVA Y PRACTICA AL MOMENTO DE UN PROBLEMA\n5. SE RECOMIENDA MANTENER EN EL PUESTO, CAPACITARLA PARA SUMAR MAS CONOCIMIENTO DEL SECTOR.',
    puntaje_calculado: 50
  }
];

async function insertAll() {
  const { data, error } = await supabase.schema('equipo').from('evaluaciones').insert(evaluaciones);
  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("Successfully inserted", evaluaciones.length, "evaluations");
  }
}

insertAll();
