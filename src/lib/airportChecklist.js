export const AIRPORT_VEHICLES = [
  { id:'57bd3777-dc2e-4282-b5c7-d4dc4e5e618a', plate:'JDN192', model:'Hyundai' },
  { id:'ec3d01cb-8f3f-4d22-a543-ce5308201875', plate:'JDN191', model:'Hyundai HD 78 Euro III' },
  { id:'71660e05-bc42-41ba-98e9-3f5275c0fb72', plate:'AH213XP', model:'Mercedes ATEGO' },
  { id:'04f0921e-903d-407b-a0a7-7e18cc953e7b', plate:'AH172MY', model:'Mercedes ATEGO' },
]
export const isAirportVehicle = id => AIRPORT_VEHICLES.some(v => v.id === id)
export const airportVehicleUrl = id => `https://bitacora-dashboard.vercel.app/?scan=activo&id=${encodeURIComponent(id)}`
export const AIRPORT_ITEMS = [
  ['cabina','Cabina limpia','Limpieza y documentación'],
  ['caja_limpia','Caja limpia','Limpieza y documentación'],
  ['seguro','Seguro del vehículo','Limpieza y documentación'],
  ['tarjeta_verde','Tarjeta verde','Limpieza y documentación'],
  ['parking','Tarjeta de parking','Limpieza y documentación'],
  ['cubiertas','Estado de cubiertas','Limpieza y documentación'],
  ['urea','Urea','Elementos y funcionamiento',true],
  ['luces','Luces','Elementos y funcionamiento'],
  ['conos','Conos','Elementos y funcionamiento'],
  ['calzas','Calzas','Elementos y funcionamiento'],
  ['matafuego','Matafuego','Elementos y funcionamiento'],
  ['hidraulico','Sistema hidráulico','Elementos y funcionamiento',true],
  ['caja','Estado de la caja','Elementos y funcionamiento'],
  ['rampa','Rampa','Elementos y funcionamiento',true],
  ['patas','Patas estabilizadoras','Elementos y funcionamiento',true],
  ['grasa','Lubricación / engrase','Elementos y funcionamiento',true],
].map(([id,label,group,allowNa=false])=>({id,label,group,allowNa}))
export const AIRPORT_SHIFTS = ['mañana','tarde','noche']
export const AIRPORT_FUEL = ['completo','3/4','1/2','1/4','reserva']
export const airportToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Cordoba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export function validateAirportChecklist(form) {
  if (form.km === '' || !Number.isSafeInteger(Number(form.km)) || Number(form.km)<0 || Number(form.km)>2147483647) return 'Ingresá un kilometraje entero válido.'
  if (!AIRPORT_FUEL.includes(form.combustible)) return 'Seleccioná el nivel de combustible.'
  if (AIRPORT_ITEMS.some(i=>!(i.allowNa?['ok','nc','na']:['ok','nc']).includes(form.respuestas?.[i.id]))) return 'Respondé todos los puntos del control.'
  const needsNote=Object.values(form.respuestas).some(v=>v==='nc')
  if (needsNote && String(form.observaciones||'').trim().length<5) return 'Describí las no conformidades.'
  if (String(form.observaciones||'').length>4000) return 'Las observaciones no pueden superar 4000 caracteres.'
  return null
}
