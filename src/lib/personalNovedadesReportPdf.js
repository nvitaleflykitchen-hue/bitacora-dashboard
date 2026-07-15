import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { db, supabase } from './supabase'

const PHOSPHOR = [57, 190, 20]
const TEXT = [35, 35, 35]
const MUTED = [105, 105, 105]

const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, ' ').trim()
const nombreCompleto = persona => `${persona.nombre || ''} ${persona.apellido || ''}`.trim().replace(/\s+/g, ' ')

function fecha(value) {
  if (!value) return '—'
  const [y,m,d] = String(value).slice(0,10).split('-')
  return `${d}/${m}/${y}`
}

function slug(value) {
  return String(value || 'sede').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function mencionaPersona(texto, persona) {
  const contenido = ` ${clean(texto)} `
  const nombre = clean(persona.nombre)
  const apellido = clean(persona.apellido)
  const completo = clean(nombreCompleto(persona))
  return Boolean(completo && contenido.includes(` ${completo} `))
    || Boolean(nombre && apellido && contenido.includes(` ${nombre} `) && contenido.includes(` ${apellido} `))
}

export function agruparNovedadesPorPersona({ personas = [], novedades = [], modulos = [], historial = [] }) {
  const grupos = personas.map(persona => ({ persona, items:[] }))
  const asignadosModulo = new Set()

  for (const grupo of grupos) {
    const fullName = clean(nombreCompleto(grupo.persona))
    novedades.filter(item => item.persona_id === grupo.persona.id
      || (fullName && clean(item.persona_nombre) === fullName))
      .forEach(item => grupo.items.push({ ...item, fuente:'Novedad individual', fecha:item.fecha_reporte }))

    modulos.forEach(item => {
      if (!mencionaPersona(item.descripcion, grupo.persona)) return
      asignadosModulo.add(item.id)
      grupo.items.push({
        ...item,
        fuente:'Fly Gestión · Dotación y cobertura del turno',
        categoria:item.modulo_label || 'Dotación y cobertura del turno',
        fecha:item.fecha_reporte,
      })
    })

    historial.filter(item => item.persona_id === grupo.persona.id)
      .filter(item => !(item.tipo === 'otro' && /^\s*\[Registro #/i.test(item.descripcion || '')))
      .forEach(item => grupo.items.push({
        ...item,
        fuente:'Legajo',
        categoria:String(item.tipo || 'otro').replaceAll('_',' '),
        estado:item.dias_suspension ? `${item.dias_suspension} día(s) de suspensión` : 'Registrado',
        reportante:item.registrado_por,
      }))

    const unicos = new Map()
    grupo.items.forEach(item => {
      const key = `${item.registro_id || item.id}|${clean(item.descripcion)}|${item.fuente}`
      if (!unicos.has(key)) unicos.set(key,item)
    })
    grupo.items = [...unicos.values()].sort((a,b) => String(b.fecha || b.created_at).localeCompare(String(a.fecha || a.created_at)))
  }

  return {
    grupos: grupos.filter(grupo => grupo.items.length).sort((a,b) => nombreCompleto(a.persona).localeCompare(nombreCompleto(b.persona),'es')),
    sinAsignar: modulos.filter(item => !asignadosModulo.has(item.id)),
  }
}

export function resumirNovedadesPersonal(items = []) {
  return items.reduce((acc, item) => {
    const categoria = item.categoria || 'Otro'
    const estado = item.estado || 'Sin estado'
    acc.categorias[categoria] = (acc.categorias[categoria] || 0) + 1
    acc.estados[estado] = (acc.estados[estado] || 0) + 1
    if (item.persona_nombre) acc.personas.add(item.persona_nombre)
    return acc
  }, { categorias:{}, estados:{}, personas:new Set() })
}

export async function generarInformeNovedadesPersonalPDF({ sedeId, sedeNombre, desde, hasta }) {
  const [personasResult, novedadesResult, modulosResult] = await Promise.all([
    supabase.from('v_personas').select('id,nombre,apellido,puesto,sede_ids,activo').eq('activo',true),
    db().from('persona_novedades').select('id,registro_id,persona_id,persona_nombre,categoria,descripcion,estado,reportante,fecha_reporte,created_at').eq('sede_id',sedeId).gte('fecha_reporte',desde).lte('fecha_reporte',hasta),
    db().from('modulo_novedades').select('id,registro_id,modulo_key,modulo_label,severidad,descripcion,estado,reportante,fecha_reporte,created_at').eq('sede_id',sedeId).gte('fecha_reporte',desde).lte('fecha_reporte',hasta).or('modulo_key.eq.g,modulo_label.ilike.%Personal%'),
  ])
  if (personasResult.error) throw personasResult.error
  if (novedadesResult.error) throw novedadesResult.error
  if (modulosResult.error) throw modulosResult.error

  const personas = (personasResult.data || []).filter(persona => persona.sede_ids?.includes(sedeId))
  const personaIds = personas.map(persona => persona.id)
  let historial = []
  if (personaIds.length) {
    const { data, error } = await supabase.from('v_historial_personal').select('id,persona_id,tipo,fecha,descripcion,dias_suspension,registrado_por,created_at').in('persona_id',personaIds).gte('fecha',desde).lte('fecha',hasta)
    if (error) throw error
    historial = data || []
  }

  const resultado = agruparNovedadesPorPersona({ personas, novedades:novedadesResult.data || [], modulos:modulosResult.data || [], historial })
  const totalReferencias = resultado.grupos.reduce((sum,grupo)=>sum+grupo.items.length,0)
  const doc = new jsPDF({ unit:'mm', format:'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 15
  const width = pageW - margin * 2
  let y = 17

  const footer = () => { doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text('Información de uso interno y confidencial',margin,pageH-9); doc.text(`Página ${doc.internal.getNumberOfPages()}`,pageW-margin,pageH-9,{align:'right'}) }
  const ensure = needed => { if (y + needed > pageH - 18) { footer(); doc.addPage(); y=17 } }
  const heading = text => { ensure(14); y+=5; doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...TEXT); doc.text(text,margin,y); y+=2; doc.setDrawColor(...PHOSPHOR); doc.line(margin,y,margin+width,y); y+=6 }

  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(...TEXT); doc.text('Informe de novedades del personal',pageW/2,y,{align:'center'}); y+=7
  doc.setFontSize(12); doc.setTextColor(...MUTED); doc.text(sedeNombre,pageW/2,y,{align:'center'}); y+=5
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.text(`Período: ${fecha(desde)} al ${fecha(hasta)} · Generado: ${format(new Date(),'dd/MM/yyyy HH:mm')}`,pageW/2,y,{align:'center'}); y+=10

  const kpis = [['Personas con novedades',resultado.grupos.length],['Referencias',totalReferencias],['Sin individualizar',resultado.sinAsignar.length]]
  const kw=width/kpis.length; doc.setFillColor(242,242,242); doc.rect(margin,y,width,18,'F')
  kpis.forEach(([label,value],i)=>{ const x=margin+kw*i+kw/2; doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...TEXT); doc.text(String(value),x,y+8,{align:'center'}); doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(label.toUpperCase(),x,y+14,{align:'center'}) }); y+=22

  if (!resultado.grupos.length) { heading('Resultado'); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text('No se encontraron novedades asociables a una persona en el período seleccionado.',margin,y); y+=8 }

  resultado.grupos.forEach(grupo => {
    heading(`${nombreCompleto(grupo.persona)}${grupo.persona.puesto ? ` · ${grupo.persona.puesto}` : ''}`)
    grupo.items.forEach((item,index)=>{
      const description=doc.splitTextToSize(item.descripcion || 'Sin descripción',width-8)
      const need=19+description.length*4; ensure(need)
      const shade=index%2?249:244; doc.setFillColor(shade,shade,shade); doc.rect(margin,y-3,width,need-2,'F')
      doc.setFont('helvetica','bold'); doc.setFontSize(8.8); doc.setTextColor(...TEXT); doc.text(`${fecha(item.fecha || item.fecha_reporte)} · ${item.categoria || 'Otro'} · ${item.estado || 'Sin estado'}`,margin+4,y+2)
      doc.setFont('helvetica','normal'); doc.setFontSize(8.2); doc.text(description,margin+4,y+8)
      const metaY=y+10+description.length*4; doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(`${item.fuente} · Reportante: ${item.reportante || 'No informado'}${item.registro_id ? ` · Registro #${item.registro_id}` : ''}`,margin+4,metaY)
      y+=need+2
    })
  })

  if (resultado.sinAsignar.length) { ensure(12); y+=5; doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(`${resultado.sinAsignar.length} novedad(es) generales de dotación no se incluyeron en fichas porque no identifican a una persona.`,margin,y) }
  footer(); doc.save(`novedades_personal_${slug(sedeNombre)}_${desde}_${hasta}.pdf`)
  return totalReferencias
}
