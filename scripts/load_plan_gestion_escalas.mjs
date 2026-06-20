import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) process.env[match[1].trim()] = match[2].trim()
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const db = supabase.schema('bitacora')
const auditoria = 'FK-GEST-ESCALAS-2026-06-19'

const actions = [
  ['CA-2026-010','Uso y control insuficiente de la bitácora de escalas.','Implementar el uso obligatorio de la bitácora en todas las escalas. Miguel deberá controlar diariamente la carga, verificar calidad y oportunidad de los registros, reclamar faltantes y emitir un resumen semanal de desvíos y pendientes.','Inicio inmediato y control permanente','2026-06-29','Matriz de control por escala, registros completos, reclamos documentados y resumen semanal emitido.','Miguel Riviere'],
  ['CA-2026-011','Falta de un criterio definido para la gestión de ranchos durante fines de semana y feriados.','Definir y documentar el circuito de coordinación con despachantes de aduana para fines de semana y feriados. Evaluar y formalizar la modalidad de rancho general de contingencia y su posterior reemplazo o regularización, indicando autorizaciones, responsables, documentación y tiempos de respuesta.','0-15 días','2026-07-07','Procedimiento aprobado, contactos y guardias actualizados, circuito de autorización definido y prueba documentada del mecanismo de contingencia.','Miguel Riviere'],
  ['CA-2026-012','Ausencia de protocolo y stock mínimo para vuelos eventuales y privados.','Elaborar un protocolo para la atención de vuelos eventuales y privados. Definir por escala un stock mínimo de productos críticos —por ejemplo hielo, gaseosas, agua, alfajores y descartables—, niveles de reposición, responsables de control, condiciones de almacenamiento y mecanismo de solicitud urgente.','0-20 días','2026-07-12','Protocolo emitido, listado de stock mínimo por escala, responsables asignados y primer control de inventario realizado.','Miguel Riviere + Responsables de Escala + Comercial + Compras'],
  ['CA-2026-013','Gestión y archivo documental heterogéneo en las escalas.','Establecer un sistema uniforme de higiene documental para el uso, guarda y archivo de remitos, facturas, bitácoras, registros operativos y demás documentación. Definir clasificación, nomenclatura, responsables, plazos de conservación, archivo físico/digital y criterio de descarte.','0-20 días','2026-07-12','Instructivo documental, estructura de carpetas implementada, muestra de documentos ordenados y auditoría de cumplimiento por escala.','Miguel Riviere'],
  ['CA-2026-014','Falta de relevamiento centralizado de los servicios contratados y de su frecuencia y calidad.','Relevar qué servicios se prestan o contratan en cada escala, su proveedor, alcance, frecuencia, costo, responsable interno y estándar esperado. Implementar un método de control de calidad mediante checklist, conformidad del servicio y gestión de desvíos.','0-30 días','2026-07-22','Matriz consolidada de servicios por escala, frecuencias validadas, checklist de calidad y registro de desvíos y reclamos.','Miguel Riviere + Calidad'],
  ['CA-2026-015','Comunicación dispersa y sin canal ni criterio único entre áreas y escalas.','Centralizar la comunicación operativa con las escalas. Definir canales, interlocutores habilitados, temas por área, niveles de escalamiento, tiempos de respuesta y formato de seguimiento para Gerencia, Miguel, Nicolás, Compras, Comercial y RRHH.','0-15 días','2026-07-07','Matriz de comunicación aprobada, canales informados, responsables designados y registro único de temas abiertos.','Gerencia + Miguel Riviere + Nicolás Vitale'],
  ['CA-2026-016','Procesos de escalas no estandarizados o sin documentación consolidada.','Relevar, ordenar y documentar los procesos críticos de las escalas, priorizando abastecimiento, recepción, almacenamiento, despacho, gestión documental, novedades, mantenimiento, vuelos eventuales y contingencias. Identificar interfaces y responsables por proceso.','0-45 días','2026-08-06','Mapa de procesos, procedimientos o flujos aprobados, responsables definidos y control de versiones implementado.','Nicolás Vitale'],
  ['CA-2026-017','Ausencia de un cronograma sistemático de visitas y seguimiento presencial.','Armar y mantener un cronograma trimestral de visitas. Miguel realizará una visita a alguna escala cada 15 días y Nicolás una visita mensual, priorizando criticidad, auditorías próximas, desvíos recurrentes y necesidades operativas. Cada visita deberá generar informe, responsables y seguimiento.','Implementación dentro de 7 días; ejecución permanente','2026-06-29','Cronograma trimestral publicado, informes de visita emitidos y tablero de acciones actualizado.','Miguel Riviere + Nicolás Vitale'],
  ['CA-2026-018','Documentación para auditorías dispersa y sin preparación preventiva.','Armar carpetas maestras de auditoría por escala, en formato físico y/o digital, con la documentación vigente requerida por auditores. Incorporar índice, responsables de actualización, control de vencimientos y revisión periódica.','0-30 días','2026-07-22','Carpetas completas por escala, índice documental, control de vigencias y simulacro de revisión sin faltantes críticos.','Calidad + Miguel Riviere + Nicolás Vitale'],
  ['CA-2026-019','Falta de una metodología estándar para auditar las escalas durante los viajes.','Diseñar una auditoría estándar de viaje que integre aspectos operativos, calidad e inocuidad, seguridad e higiene, documentación, mantenimiento, flota, stock y gestión de personal. Definir criterios de evaluación, ponderación, criticidad, evidencia y plazos de cierre.','0-30 días','2026-07-22','Checklist aprobado, escala de criticidad definida, formato de informe disponible y primera auditoría piloto realizada.','Miguel Riviere + Nicolás Vitale + Calidad + Seguridad e Higiene'],
  ['CA-2026-020','Información incompleta de flota y mantenimiento en la aplicación de gestión.','Iniciar y completar la carga de vehículos, equipos y necesidades de mantenimiento de cada escala en la aplicación. Definir datos obligatorios, responsables de actualización, vencimientos, kilometraje, historial de intervenciones y alertas.','Carga inicial en 15 días; actualización permanente','2026-07-07','Flota y equipos cargados por escala, documentación adjunta, mantenimientos pendientes registrados y responsables de actualización asignados.','Miguel Riviere + Responsable de cada Escala'],
]

const rows = actions.map(([codigo,hallazgo,accion,plazo,fecha,evidencia,responsablesDocumento]) => ({
  codigo,
  tipo:'Correctiva',
  descripcion:`Hallazgo: ${hallazgo} Acción: ${accion}`,
  responsable:'Miguel Riviere',
  fecha_limite:fecha,
  estado:'Pendiente',
  sede_id:null,
  sede_nombre:'Gestión',
  auditoria_codigo:auditoria,
  no_conformidad_id:null,
  notas:`Área: Gestión de Escalas\nResponsables indicados en el documento: ${responsablesDocumento}\nFecha estimada de inicio: 22/06/2026\nPlazo objetivo: ${plazo}\nEvidencia de cierre requerida: ${evidencia}\nFuente: Plan_de_Accion_Gestion_de_Escalas_Miguel_Nicolas.docx`,
}))

const { data, error } = await db.from('capa').upsert(rows, { onConflict:'codigo' })
  .select('id,codigo,sede_nombre,responsable,fecha_limite,estado').order('codigo')
if (error) throw error
const { data:verified, error:verifyError } = await db.from('capa')
  .select('codigo,sede_id,sede_nombre,responsable,descripcion,notas,estado')
  .eq('auditoria_codigo', auditoria).order('codigo')
if (verifyError) throw verifyError
const invalid = verified.filter(row => row.sede_id !== null || row.sede_nombre !== 'Gestión' || row.responsable !== 'Miguel Riviere' || row.descripcion.includes('?') || row.notas.includes('?'))
if (verified.length !== 11 || invalid.length) throw new Error(`Verificación fallida: total=${verified.length}, inválidas=${invalid.length}`)
console.log(JSON.stringify({ updated:data.length, verified:verified.length, first:data[0]?.codigo, last:data.at(-1)?.codigo }, null, 2))
