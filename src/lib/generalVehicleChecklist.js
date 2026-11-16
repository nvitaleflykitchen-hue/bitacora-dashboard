// Controles de la guía diaria de Operaciones, revisión 08/11/2024.
export const GENERAL_VEHICLE_ITEMS = [
  { id:'balizas', label:'Control de balizas', help:'Verificá el funcionamiento de las balizas.' },
  { id:'frenos', label:'Verificación de frenos', help:'Comprobá la respuesta y cualquier ruido o anomalía.' },
  { id:'luces', label:'Verificación de luces', help:'Bajas, altas, giro, stop y marcha atrás.' },
  { id:'tablero', label:'Verificación de tablero', help:'Revisá indicadores y testigos de advertencia.' },
  { id:'aceite', label:'Nivel de aceite', help:'Controlá el nivel según las indicaciones del vehículo.' },
  { id:'rampa', label:'Control de rampa', help:'Estado y funcionamiento. Si la unidad no tiene rampa, indicá No aplica.', optional:true },
  { id:'neumaticos', label:'Control de neumáticos', help:'Estado, presión y daños visibles.' },
  { id:'agua', label:'Control de agua / refrigerante', help:'Revisá el nivel con el motor frío.' },
  { id:'combustible', label:'Nivel de combustible', help:'Verificá que sea suficiente para el recorrido previsto.' },
  { id:'matafuego', label:'Matafuego', help:'Presencia, carga, vencimiento y precinto.' },
]
export const GENERAL_ANSWERS = { ok:'Conforme', observado:'No conforme', critico:'Crítico', na:'No aplica' }
export const emptyGeneralAnswers = () => Object.fromEntries(GENERAL_VEHICLE_ITEMS.map(i=>[i.id,'']))
export function generalChecklistError(form) {
  if (GENERAL_VEHICLE_ITEMS.some(i=>!['ok','observado','critico',...(i.optional?['na']:[])].includes(form.respuestas?.[i.id]))) return 'Respondé los 10 controles antes de guardar.'
  if (form.km !== '' && (!Number.isInteger(Number(form.km)) || Number(form.km)<0)) return 'Ingresá un kilometraje entero, mayor o igual a cero.'
  if (Object.values(form.respuestas).some(v=>['observado','critico'].includes(v)) && !form.observaciones?.trim()) return 'Describí las no conformidades en Observaciones.'
  return ''
}
export function generalChecklistStatus(respuestas) {
  if (Object.values(respuestas).includes('critico')) return 'no_apto'
  if (Object.values(respuestas).includes('observado')) return 'observado'
  if (GENERAL_VEHICLE_ITEMS.some(i=>!respuestas[i.id])) return 'pendiente'
  return 'apto'
}
