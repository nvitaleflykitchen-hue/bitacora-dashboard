import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { getRequerimientos, createRequerimiento, updateRequerimiento, getSedes, getContactos, getPerfiles, getRegistroById } from '../lib/queries'
import ContactosQuickBtn from '../components/ContactosQuickBtn'
import { Plus, RefreshCw, ShoppingCart, Send, X, ExternalLink, Image, Mail, MessageCircle, Paperclip, Eye, EyeOff, Clock3, Lock, BookOpen, ChevronDown, ChevronUp, Users, Save } from 'lucide-react'
import AdjuntosPanel from '../components/AdjuntosPanel'
import RegistroModal from '../components/RegistroModal'
import { uploadAdjunto } from '../lib/adjuntos'
import { fmtFecha } from '../lib/dateUtils'
import { confirmar, pedirTexto, toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

const ESTADOS   = ['Pendiente','Observado','Aprobado','Enviado','En compra','Recibido','Cumplido','Rechazado','Cancelado']
const KANBAN_ACTIVOS = ['Pendiente','Aprobado','Enviado','En compra','Recibido']
const RESUMEN_ESTADOS = ['Pendiente','Aprobado','Enviado','En compra','Recibido','Cumplido']
const URGENCIAS = ['alta','media','baja']
const TIPOS     = ['reposicion','prueba','unica']
const SLA_DIAS  = { alta:3, media:7, baja:15 }
const ESTADOS_CERRADOS = new Set(['Cumplido','Rechazado','Cancelado'])
const ESTADO_TIMESTAMP = {
  Observado:'observado_at', Aprobado:'aprobado_at', Enviado:'enviado_at',
  'En compra':'compra_iniciada_at', Recibido:'recibido_at', Cumplido:'cumplido_at',
  Rechazado:'rechazado_at', Cancelado:'cancelado_at',
}

const EQUIPO_COMPRAS = [
  {
    nombre:'Ignacio Oyarzabal Indaburu', cargo:'Gerente de Compras', nivel:1,
    telefono:'+54 9 351 200-2939',
    emails:['compras.gerencia@serviciosdrill.com.ar','ioyarzabalcompras@gmail.com'],
    alcance:'Dirección y coordinación general del proceso de compras.',
  },
  {
    nombre:'Leandro Villaruel', cargo:'Analista de Compras', nivel:2,
    telefono:'+54 9 3512 39-7064',
    alcance:'Fly Kitchen Planta: fábricas, hospitales, CCI y líneas aéreas.',
  },
  {
    nombre:'Analía Roberto', cargo:'Analista de Compras', nivel:2,
    telefono:'+54 9 3516 50-5825',
    alcance:'Compras de proveedor Arcor para cocinas in situ.',
  },
  {
    nombre:'Martina Figueroa', cargo:'Soporte Administrativo de Compras', nivel:2,
    alcance:'Carga de facturas al sistema. Contacto directo pendiente de confirmar.',
  },
  {
    nombre:'Diego Ferrarassi', cargo:'Analista de Compras Jr', nivel:3,
    telefono:'+54 9 3513 62-7911',
    alcance:'Fly Kitchen Interior: comedores in situ, hospitales, educación y escalas. Bajo supervisión de Leandro Villaruel.',
  },
]

function whatsappHref(telefono) {
  const digits = String(telefono || '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return ''
  if (digits.startsWith('549')) return `https://wa.me/${digits}`
  if (digits.startsWith('54')) return `https://wa.me/549${digits.slice(2).replace(/^9/, '')}`
  return `https://wa.me/549${digits.replace(/^9/, '')}`
}

function EquipoComprasNode({ persona, accent = '#60A5FA' }) {
  return (
    <article style={{ width:260, minHeight:178, padding:'13px', border:`1px solid ${accent}55`, borderRadius:5, background:'var(--surface)', boxShadow:'0 10px 24px rgba(0,0,0,.2)' }}>
      <p style={{ color:accent, fontSize:'.57rem', letterSpacing:'.08em', fontFamily:'monospace' }}>{persona.cargo.toUpperCase()}</p>
      <h3 style={{ color:'var(--text)', fontSize:'.82rem', fontWeight:750, marginTop:5 }}>{persona.nombre}</h3>
      <p style={{ color:'var(--text-dim)', fontSize:'.62rem', lineHeight:1.45, marginTop:6 }}>{persona.alcance}</p>
      {persona.telefono && <p style={{ color:'rgba(255,255,255,.5)', fontSize:'.59rem', marginTop:7 }}>{persona.telefono}</p>}
      {(persona.emails||[]).map(email=><a key={email} href={`mailto:${email}`} style={{ color:'rgba(96,165,250,.8)', display:'block', fontSize:'.56rem', marginTop:3, overflowWrap:'anywhere' }}>{email}</a>)}
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:9 }}>
        {persona.telefono && <a href={whatsappHref(persona.telefono)} target="_blank" rel="noreferrer" className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.58rem', textDecoration:'none', padding:'4px 7px' }}><MessageCircle size={9}/> WhatsApp</a>}
        {(persona.emails||[]).length>0 && <a href={`mailto:${persona.emails.join(';')}`} className="btn-ghost" style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.58rem', textDecoration:'none', padding:'4px 7px' }}><Mail size={9}/> Email</a>}
      </div>
    </article>
  )
}

function EquipoComprasModal({ onClose }) {
  const gerente = EQUIPO_COMPRAS.find(p=>p.nivel===1)
  const leandro = EQUIPO_COMPRAS.find(p=>p.nombre.startsWith('Leandro'))
  const analia = EQUIPO_COMPRAS.find(p=>p.nombre.startsWith('Analía'))
  const martina = EQUIPO_COMPRAS.find(p=>p.nombre.startsWith('Martina'))
  const diego = EQUIPO_COMPRAS.find(p=>p.nombre.startsWith('Diego'))
  return (
    <div className="modal-overlay" style={{ zIndex:60 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="glass fade-in" style={{ width:'min(1040px,96vw)', maxHeight:'90vh', overflow:'auto', background:'var(--surface)', border:'1px solid rgba(57,255,20,.2)', borderRadius:5 }}>
        <div style={{ padding:'1rem 1.2rem', display:'flex', justifyContent:'space-between', gap:12, borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <div>
            <h2 style={{ color:'var(--text)', fontWeight:800, fontSize:'1rem' }}>Equipo de Compras</h2>
            <p style={{ color:'var(--text-dim)', fontSize:'.62rem', marginTop:3 }}>Directorio y alcance operativo · referencia recibida 21/05/2026</p>
          </div>
          <button className="btn-ghost" onClick={onClose}><X size={14}/></button>
        </div>
        <div style={{ padding:'1.2rem', minWidth:900 }}>
          <div style={{ display:'flex', justifyContent:'center' }}><EquipoComprasNode persona={gerente} accent="var(--phosphor)"/></div>
          <div style={{ height:28, width:1, background:'rgba(57,255,20,.45)', margin:'0 auto' }}/>
          <div style={{ position:'relative', display:'grid', gridTemplateColumns:'repeat(3,260px)', justifyContent:'center', gap:42 }}>
            <div style={{ position:'absolute', height:1, background:'rgba(57,255,20,.35)', top:0, left:'calc(50% - 302px)', right:'calc(50% - 302px)' }}/>
            {[leandro, analia, martina].map(persona=>(
              <div key={persona.nombre} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div style={{ height:24, width:1, background:'rgba(57,255,20,.35)' }}/>
                <EquipoComprasNode persona={persona}/>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,260px)', justifyContent:'center', gap:42 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{ height:28, width:1, background:'rgba(96,165,250,.4)' }}/>
              <EquipoComprasNode persona={diego} accent="#2DD4BF"/>
            </div>
            <div/><div/>
          </div>
        </div>
      </div>
    </div>
  )
}
const TRANSICIONES = {
  Pendiente:['Observado','Aprobado','Rechazado','Cancelado'],
  Observado:['Pendiente','Rechazado','Cancelado'],
  Aprobado:['Enviado','Observado','Rechazado','Cancelado'],
  Enviado:['En compra','Recibido','Cancelado'],
  'En compra':['Recibido','Cancelado'],
  Recibido:['En compra','Cumplido'],
  Cumplido:[], Rechazado:[], Cancelado:[],
}

function estadosDisponibles(req) {
  if (!req?.estado) return ESTADOS
  return [req.estado, ...(TRANSICIONES[req.estado] || [])]
}

const URG_COLOR = { alta:'#FF2A2A', media:'#F59E0B', baja:'#39FF14' }
const EST_COLOR = {
  Pendiente:'rgba(255,255,255,0.5)', Observado:'#FB923C', Aprobado:'#60A5FA',
  Enviado:'#F59E0B', 'En compra':'#A78BFA', Recibido:'#2DD4BF', Cumplido:'#39FF14',
  Rechazado:'#F87171', Cancelado:'rgba(107,114,128,0.5)'
}

const colHeader = {
  Pendiente: { color:'rgba(255,255,255,0.35)', bg:'rgba(107,114,128,0.08)' },
  Observado: { color:'#FB923C',                    bg:'rgba(251,146,60,0.08)' },
  Aprobado:  { color:'#60A5FA',               bg:'rgba(59,130,246,0.08)' },
  Enviado:   { color:'#F59E0B',               bg:'rgba(245,158,11,0.07)' },
  'En compra':{ color:'#A78BFA',              bg:'rgba(167,139,250,0.08)' },
  Recibido:  { color:'#2DD4BF',               bg:'rgba(45,212,191,0.08)' },
  Cumplido:  { color:'#39FF14',               bg:'rgba(57,255,20,0.07)' },
  Rechazado: { color:'#F87171',               bg:'rgba(248,113,113,0.08)' },
  Cancelado: { color:'rgba(107,114,128,0.4)', bg:'rgba(107,114,128,0.04)' },
}

function diasHabilesEntre(inicio, fin = new Date()) {
  if (!inicio) return null
  const start = new Date(inicio)
  const end = new Date(fin)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  start.setHours(0,0,0,0); end.setHours(0,0,0,0)
  let dias = 0
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) dias++
  }
  return dias
}

function promedio(valores) {
  const validos = valores.filter(v=>Number.isFinite(v))
  return validos.length ? validos.reduce((a,b)=>a+b,0) / validos.length : null
}

function mediana(valores) {
  const validos = valores.filter(v=>Number.isFinite(v)).sort((a,b)=>a-b)
  if (!validos.length) return null
  const mitad = Math.floor(validos.length / 2)
  return validos.length % 2 ? validos[mitad] : (validos[mitad - 1] + validos[mitad]) / 2
}

function buildTransitionPayload(req, nuevoEstado, perfil, comentario = '') {
  if (!req || req.estado === nuevoEstado) return { estado:nuevoEstado }
  const now = new Date().toISOString()
  const evento = {
    de:req.estado || null, a:nuevoEstado, comentario:comentario || null,
    actor_id:perfil?.id || null, actor:perfil?.nombre || perfil?.email || 'Usuario', fecha:now,
  }
  const payload = {
    estado:nuevoEstado,
    historial_estados:[...(Array.isArray(req.historial_estados) ? req.historial_estados : []), evento],
  }
  const timestamp = ESTADO_TIMESTAMP[nuevoEstado]
  if (timestamp) payload[timestamp] = now
  if (nuevoEstado === 'Enviado') payload.sla_dias = SLA_DIAS[req.urgencia] || SLA_DIAS.media
  if (nuevoEstado === 'Observado' || nuevoEstado === 'Rechazado') payload.observacion_aprobacion = comentario
  return payload
}

function inicioEtapa(req) {
  const field = ESTADO_TIMESTAMP[req.estado]
  return (field && req[field]) || req.updated_at || req.created_at
}

function buildEmailBody(req, sedes) {
  const sede = req.sedes?.nombre || req.sede_nombre || 'General'
  const vence = req.fecha_necesidad ? `\nFecha necesidad: ${fmtFecha(req.fecha_necesidad)}` : ''
  return encodeURIComponent(
    `REQUERIMIENTO DE COMPRA #${req.numero || req.id}\n` +
    `========================================\n\n` +
    `Sede: ${sede}\n` +
    `Solicitante: ${req.solicitante || '—'}\n` +
    `Urgencia: ${req.urgencia?.toUpperCase()}\n${vence}\n\n` +
    `DESCRIPCIÓN: ${req.descripcion}\n` +
    (req.cantidad ? `Cantidad: ${req.cantidad} ${req.unidad_medida || ''}\n` : '') +
    (req.sector_maquina ? `Sector/Máquina: ${req.sector_maquina}\n` : '') +
    (req.tipo_compra ? `Tipo: ${req.tipo_compra}\n` : '') +
    (req.periodo_consumo ? `Período consumo: ${req.periodo_consumo}\n` : '') +
    `\nJUSTIFICACIÓN:\n${req.justificacion || '—'}\n\n` +
    (req.funcion ? `FUNCIÓN: ${req.funcion}\n\n` : '') +
    (req.proveedor_sugerido ? `Proveedor sugerido: ${req.proveedor_sugerido}\n\n` : '') +
    (req.fecha_compromiso ? `Fecha compromiso: ${fmtFecha(req.fecha_compromiso)}\n\n` : '') +
    (req.observacion_aprobacion ? `OBSERVACIÓN / CONSULTA:\n${req.observacion_aprobacion}\n\n` : '') +
    (req.imagen_url ? `Imagen/Evidencia: ${req.imagen_url}\n\n` : '') +
    (req.comentarios ? `Comentarios: ${req.comentarios}\n\n` : '') +
    `----------------------------------------\n` +
    `Fly Kitchen — Kitchen OS`
  )
}

function buildObservationEmail(req, comentario, autorizante, sedes) {
  const detalle = decodeURIComponent(buildEmailBody({ ...req, observacion_aprobacion:null }, sedes))
  return encodeURIComponent(
    `REQUERIMIENTO OBSERVADO — ACCIÓN REQUERIDA\n` +
    `========================================\n\n` +
    `Autorizante: ${autorizante || 'No informado'}\n` +
    `Observación:\n${comentario}\n\n` +
    `Por favor, corregí o completá la información solicitada y reenviá el requerimiento para aprobación.\n\n` +
    `----------------------------------------\n\n${detalle}`
  )
}

function shareRequerimiento(req, sedes, channel) {
  const subject = encodeURIComponent(`[Requerimiento #${req.numero || req.id || 'nuevo'}] ${req.descripcion?.substring(0, 50) || 'Compra'}`)
  const body = buildEmailBody(req, sedes)
  if (channel === 'whatsapp') {
    window.open(`https://wa.me/?text=${body}`, '_blank', 'noopener,noreferrer')
    return
  }
  window.open(`mailto:${req.enviado_a || ''}?subject=${subject}&body=${body}`, '_blank')
}

// ─── Modal Form ────────────────────────────────────────────
function RequerimientoForm({ req, sedes, solicitantes, perfil, emailCompras, onClose, onSaved }) {
  const [savedReq, setSavedReq] = useState(req || null)
  const activeReq = savedReq || req
  const editing = !!activeReq?.id
  const contenidoBloqueado = editing && (!!activeReq?.enviado_at || ['Enviado','En compra','Recibido','Cumplido','Rechazado','Cancelado'].includes(activeReq?.estado))
  const [form, setForm] = useState({
    sede_id:           req?.sede_id           || '',
    sede_nombre:       req?.sede_nombre        || '',
    solicitante:       req?.solicitante        || '',
    cantidad:          req?.cantidad           || '',
    unidad_medida:     req?.unidad_medida      || '',
    descripcion:       req?.descripcion        || '',
    periodo_consumo:   req?.periodo_consumo    || '',
    justificacion:     req?.justificacion      || '',
    funcion:           req?.funcion            || '',
    sector_maquina:    req?.sector_maquina     || '',
    proveedor_sugerido:req?.proveedor_sugerido || '',
    tipo_compra:       req?.tipo_compra        || 'reposicion',
    comentarios:       req?.comentarios        || '',
    imagen_url:        req?.imagen_url         || '',
    urgencia:          req?.urgencia           || 'media',
    estado:            req?.estado             || 'Pendiente',
    fecha_necesidad:   req?.fecha_necesidad    || '',
    fecha_compromiso:  req?.fecha_compromiso   || '',
    observacion_aprobacion:req?.observacion_aprobacion || '',
    enviado_a:         req?.enviado_a          || emailCompras || '',
  })
  const [saving, setSaving] = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const [archivos, setArchivos] = useState([])
  const [showOrigen, setShowOrigen] = useState(false)
  const [origenData, setOrigenData] = useState(null)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleVerOrigen = async () => {
    if (!activeReq?.origen_registro_id) return
    try {
      const data = await getRegistroById(activeReq.origen_registro_id)
      setOrigenData(data)
      setShowOrigen(true)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.descripcion.trim()) return
    if (editing && ['Observado','Rechazado'].includes(form.estado) && form.estado !== activeReq.estado && !form.observacion_aprobacion.trim()) {
      toast.warn('Escribí el motivo de la observación o rechazo antes de cambiar el estado.')
      return
    }
    setSaving(true)
    try {
      let payload = {
        ...form,
        sede_id: form.sede_id || null,
        sede_nombre: sedes.find(s=>String(s.id)===String(form.sede_id))?.nombre || form.sede_nombre || null,
        cantidad: form.cantidad ? Number(form.cantidad) : null,
        fecha_necesidad: form.fecha_necesidad || null,
        fecha_compromiso: form.fecha_compromiso || null,
      }
      if (editing && form.estado !== activeReq.estado) {
        payload = { ...payload, ...buildTransitionPayload(activeReq, form.estado, perfil, form.observacion_aprobacion.trim()) }
      }
      const saved = editing
        ? await updateRequerimiento(activeReq.id, payload)
        : await createRequerimiento(payload)
      if (!editing && archivos.length > 0 && saved?.id) {
        await Promise.all(archivos.map(f => uploadAdjunto('requerimiento', saved.id, f)))
      }
      setSavedReq(saved)
      setJustCreated(!editing)
      await onSaved()
    } catch(err) { toast.error('Error: ' + mensajeError(err)) }
    finally { setSaving(false) }
  }

  const L = { color:'var(--text-dim)', fontSize:'0.62rem', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:'monospace', display:'block', marginBottom:4 }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="glass hud-corner fade-in rounded" style={{ borderRadius:3, width:'100%', maxWidth:640, maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.9rem 1.25rem', borderBottom:'1px solid rgba(57,255,20,0.1)', position:'sticky', top:0, background:'var(--surface)', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <ShoppingCart size={14} style={{ color:'var(--phosphor)' }}/>
            <h2 className="font-title font-bold" style={{ color:'var(--text)', fontSize:'0.95rem' }}>
              {editing ? `Requerimiento #${activeReq.numero||activeReq.id}` : 'Nuevo Requerimiento de Compra'}
            </h2>
            {editing && activeReq?.origen_registro_id && (
              <button type="button" onClick={handleVerOrigen} className="btn-ghost" style={{ fontSize:'0.7rem', padding:'0.2rem 0.5rem' }}>
                👁 Ver reporte origen
              </button>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding:'0.3rem' }}><X size={14}/></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding:'1rem 1.25rem', display:'flex', flexDirection:'column', gap:12 }}>
          {contenidoBloqueado && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', border:'1px solid rgba(245,158,11,0.3)', background:'rgba(245,158,11,0.07)', color:'#F59E0B', borderRadius:3, fontSize:'0.68rem' }}>
              <Lock size={13}/>
              Requerimiento enviado: los datos originales están bloqueados. Sólo podés avanzar el proceso, actualizar el compromiso y agregar documentación.
            </div>
          )}
          {/* Sede + Solicitante */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={L}>Sede</label>
              <select disabled={contenidoBloqueado} className="input-dark" value={form.sede_id} onChange={e=>set('sede_id',e.target.value)}>
                <option value="">— General —</option>
                {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={L}>Solicitante</label>
              <select disabled={contenidoBloqueado} className="input-dark" value={form.solicitante} onChange={e=>set('solicitante',e.target.value)}>
                <option value="">— Seleccionar solicitante —</option>
                {form.solicitante && !solicitantes.some(s=>s.nombre===form.solicitante) && (
                  <option value={form.solicitante}>{form.solicitante} (registrado)</option>
                )}
                {solicitantes.map(s=>(
                  <option key={s.key} value={s.nombre}>{s.nombre}{s.cargo ? ` — ${s.cargo}` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label style={L}>Descripción / Código del artículo *</label>
            <textarea disabled={contenidoBloqueado} required rows={2} className="input-dark" value={form.descripcion}
              onChange={e=>set('descripcion',e.target.value)}
              placeholder="Descripción del repuesto, pieza, máquina, herramienta, insumo, etc."
              style={{ resize:'vertical' }}/>
          </div>

          {/* Cantidad + Unidad + Tipo */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div>
              <label style={L}>Cantidad</label>
              <input disabled={contenidoBloqueado} type="number" min="0" step="any" className="input-dark" value={form.cantidad}
                onChange={e=>set('cantidad',e.target.value)} placeholder="Ej: 5"/>
            </div>
            <div>
              <label style={L}>Unidad</label>
              <input disabled={contenidoBloqueado} className="input-dark" value={form.unidad_medida} onChange={e=>set('unidad_medida',e.target.value)} placeholder="Ej: kg, unidades, litros"/>
            </div>
            <div>
              <label style={L}>Tipo de compra</label>
              <select disabled={contenidoBloqueado} className="input-dark" value={form.tipo_compra} onChange={e=>set('tipo_compra',e.target.value)}>
                <option value="reposicion">Reposición</option>
                <option value="prueba">Prueba</option>
                <option value="unica">Única</option>
              </select>
            </div>
          </div>

          {/* Período consumo + Sector/máquina */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={L}>Período consumo (meses)</label>
              <input disabled={contenidoBloqueado} className="input-dark" value={form.periodo_consumo}
                onChange={e=>set('periodo_consumo',e.target.value)} placeholder="Ej: 3 meses"/>
            </div>
            <div>
              <label style={L}>Sector / Máquina</label>
              <input disabled={contenidoBloqueado} className="input-dark" value={form.sector_maquina}
                onChange={e=>set('sector_maquina',e.target.value)} placeholder="Ej: Cocina central, Cámara de frío 2"/>
            </div>
          </div>

          {/* Justificación */}
          <div>
            <label style={L}>Justificación (¿por qué lo necesito? ¿qué pasa si no lo tengo?)</label>
            <textarea disabled={contenidoBloqueado} rows={2} className="input-dark" value={form.justificacion}
              onChange={e=>set('justificacion',e.target.value)}
              placeholder="Explique la necesidad y el impacto de no tenerlo..."
              style={{ resize:'vertical' }}/>
          </div>

          {/* Función */}
          <div>
            <label style={L}>Función (¿para qué sirve?)</label>
            <input disabled={contenidoBloqueado} className="input-dark" value={form.funcion} onChange={e=>set('funcion',e.target.value)}
              placeholder="Describe para qué se va a utilizar..."/>
          </div>

          {/* Proveedor + Urgencia + Fecha */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            <div>
              <label style={L}>Proveedor sugerido</label>
              <input disabled={contenidoBloqueado} className="input-dark" value={form.proveedor_sugerido}
                onChange={e=>set('proveedor_sugerido',e.target.value)} placeholder="Ej: Distribuidora Sur SRL"/>
            </div>
            <div>
              <label style={L}>Urgencia</label>
              <select disabled={contenidoBloqueado} className="input-dark" value={form.urgencia} onChange={e=>set('urgencia',e.target.value)}>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label style={L}>Fecha necesidad</label>
              <input disabled={contenidoBloqueado} type="date" className="input-dark" value={form.fecha_necesidad}
                onChange={e=>set('fecha_necesidad',e.target.value)}/>
            </div>
          </div>

          {/* Imagen/Link evidencia */}
          <div>
            <label style={L}>
              <Image size={10} style={{ display:'inline', marginRight:4 }}/>
              Link imagen / presupuesto (Drive, foto, PDF)
            </label>
            <input disabled={contenidoBloqueado} className="input-dark" value={form.imagen_url}
              onChange={e=>set('imagen_url',e.target.value)}
              placeholder="Ej: https://drive.google.com/file/d/..."/>
          </div>

          {/* Estado + enviado a (solo editando) */}
          {editing && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
              <div>
                <label style={L}>Estado</label>
                <select className="input-dark" value={form.estado} onChange={e=>set('estado',e.target.value)}>
                  {estadosDisponibles(activeReq).map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={L}>Enviado a (email compras)</label>
                <input className="input-dark" value={form.enviado_a}
                  onChange={e=>set('enviado_a',e.target.value)} placeholder="Ej: compras@flykitchen.com"/>
              </div>
              <div>
                <label style={L}>Fecha compromiso</label>
                <input type="date" className="input-dark" value={form.fecha_compromiso}
                  onChange={e=>set('fecha_compromiso',e.target.value)}/>
              </div>
            </div>
          )}

          {editing && ['Observado','Rechazado'].includes(form.estado) && (
            <div>
              <label style={L}>Motivo / consulta al solicitante *</label>
              <textarea rows={2} className="input-dark" value={form.observacion_aprobacion}
                onChange={e=>set('observacion_aprobacion',e.target.value)}
                placeholder="Indicá qué información debe corregirse o el motivo del rechazo..."
                style={{ resize:'vertical' }}/>
            </div>
          )}

          {/* Comentarios */}
          <div>
            <label style={L}>Comentarios adicionales</label>
            <textarea disabled={contenidoBloqueado} rows={2} className="input-dark" value={form.comentarios}
              onChange={e=>set('comentarios',e.target.value)}
              placeholder="Cualquier observación adicional..." style={{ resize:'vertical' }}/>
          </div>

          {!editing && (
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Evidencias (Fotos/Archivos)</label>
              <input type="file" multiple className="input-dark" style={{ padding:'0.4rem' }} onChange={e => setArchivos(Array.from(e.target.files || []))} />
            </div>
          )}

          {/* Adjuntos — disponibles apenas se crea el requerimiento */}
          {editing && activeReq?.id && (
            <div style={{ paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              {justCreated && (
                <p style={{ color:'var(--phosphor)', fontSize:'0.68rem', marginBottom:8 }}>
                  Requerimiento creado. Ya podés agregar fotos, archivos o links.
                </p>
              )}
              <AdjuntosPanel entityType="requerimiento" entityId={activeReq.id} />
            </div>
          )}

          {editing && Array.isArray(activeReq.historial_estados) && activeReq.historial_estados.length > 0 && (
            <div style={{ paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <label style={L}>Historial del proceso</label>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {[...activeReq.historial_estados].reverse().map((evento, i)=>(
                  <div key={`${evento.fecha}-${i}`} style={{ padding:'6px 8px', background:'rgba(255,255,255,0.025)', borderLeft:`2px solid ${EST_COLOR[evento.a] || '#64748B'}`, fontSize:'0.66rem' }}>
                    <span style={{ color:'var(--text)' }}>{evento.de || 'Inicio'} → {evento.a}</span>
                    <span style={{ color:'var(--text-dim)' }}> · {evento.actor || 'Usuario'} · {new Date(evento.fecha).toLocaleString('es-AR')}</span>
                    {evento.comentario && <p style={{ color:'#FB923C', marginTop:3 }}>{evento.comentario}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ ...L, marginBottom:0 }}>Compartir requerimiento</span>
            <div style={{ display:'flex', gap:6 }}>
              <button type="button" onClick={()=>shareRequerimiento({...activeReq, ...form}, sedes, 'whatsapp')}
                style={{ background:'rgba(37,211,102,0.12)', border:'1px solid rgba(37,211,102,0.3)', color:'#25D366', borderRadius:3, padding:'0.35rem 0.6rem', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:'0.68rem' }}>
                <MessageCircle size={12}/> WhatsApp
              </button>
              <button type="button" onClick={()=>shareRequerimiento({...activeReq, ...form}, sedes, 'email')}
                style={{ background:'rgba(99,179,237,0.1)', border:'1px solid rgba(99,179,237,0.25)', color:'#63B3ED', borderRadius:3, padding:'0.35rem 0.6rem', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:'0.68rem' }}>
                <Mail size={12}/> Email
              </button>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:6, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <button type="button" onClick={onClose} className="btn-ghost">{editing ? 'Cerrar' : 'Cancelar'}</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-1.5 flex-1" style={{ padding:'0.6rem' }}>
              <Save size={14}/> {saving ? 'Guardando...' : (editing ? 'Guardar Cambios' : 'Crear y solicitar')}
            </button>
          </div>
        </form>
      </div>

      {showOrigen && origenData && (
        <RegistroModal registro={origenData} onClose={() => setShowOrigen(false)} />
      )}
    </div>
  )
}

// ─── Tarjeta en kanban ─────────────────────────────────────
function ReqCard({ req, onEdit, onUpdateEstado, onEnviar, readOnly = false }) {
  const urg = URG_COLOR[req.urgencia] || '#aaa'
  const diasEtapa = diasHabilesEntre(inicioEtapa(req))
  const diasCompra = req.enviado_at ? diasHabilesEntre(req.enviado_at, req.cumplido_at ? new Date(req.cumplido_at) : new Date()) : null
  const sla = req.sla_dias || SLA_DIAS[req.urgencia] || SLA_DIAS.media
  const vencido = diasCompra !== null && !ESTADOS_CERRADOS.has(req.estado) && diasCompra > sla
  const observado = req.estado === 'Observado'
  return (
    <div className="rounded p-3 fade-in" style={{ background:observado?'rgba(251,146,60,0.055)':'var(--surface)', border:`1px solid ${observado?'rgba(251,146,60,0.5)':'rgba(255,255,255,0.05)'}`, borderLeft:observado?'3px solid #FB923C':undefined, cursor:'pointer' }}
      onClick={()=>{ if (!readOnly) onEdit(req) }}>
      {observado && (
        <div style={{ color:'#FB923C', fontSize:'0.58rem', fontWeight:800, letterSpacing:'0.06em', marginBottom:6 }}>
          OBSERVADO · REQUIERE CORRECCIÓN
        </div>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6, marginBottom:6 }}>
        <p style={{ color:'var(--text)', fontSize:'0.72rem', fontWeight:600, lineHeight:1.35 }}>
          {req.descripcion?.substring(0,70)}{req.descripcion?.length>70?'…':''}
        </p>
        <span style={{ fontSize:'0.55rem', padding:'1px 5px', borderRadius:3, fontWeight:700, background:`${urg}22`, color:urg, border:`1px solid ${urg}44`, flexShrink:0 }}>
          {req.urgencia}
        </span>
      </div>
      <div style={{
        display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:7,
        padding:'5px 7px', borderRadius:3,
        background:vencido?'rgba(255,42,42,0.1)':'rgba(96,165,250,0.07)',
        border:`1px solid ${vencido?'rgba(255,42,42,0.35)':'rgba(96,165,250,0.18)'}`,
        color:vencido?'#FF4D4D':'#93C5FD', fontSize:'0.62rem', fontFamily:'monospace', fontWeight:700,
      }}>
        <Clock3 size={12}/>
        <span>{diasEtapa ?? 0} d en etapa</span>
        {diasCompra !== null && (
          <span style={{ marginLeft:'auto', color:vencido?'#FF4D4D':(diasCompra >= sla * 0.8 ? '#F59E0B':'#39FF14') }}>
            COMPRA {diasCompra}/{sla} d SLA
          </span>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:8 }}>
        {req.sedes?.nombre && <p style={{ color:'var(--text-dim)', fontSize:'0.63rem' }}>{req.sedes.nombre}</p>}
        {req.cantidad && <p style={{ color:'var(--text-dim)', fontSize:'0.63rem' }}>{req.cantidad} {req.unidad_medida}</p>}
        {req.fecha_necesidad && <p style={{ color:'var(--text-dim)', fontSize:'0.63rem' }}>Necesidad: {fmtFecha(req.fecha_necesidad)}</p>}
        {req.imagen_url && (
          <a href={req.imagen_url} target="_blank" rel="noopener noreferrer"
            onClick={e=>e.stopPropagation()}
            style={{ color:'rgba(57,255,20,0.6)', fontSize:'0.6rem', display:'flex', alignItems:'center', gap:3 }}>
            <ExternalLink size={9}/> Ver imagen/presupuesto
          </a>
        )}
      </div>
      {!readOnly && <div style={{ display:'flex', gap:5 }} onClick={e=>e.stopPropagation()}>
        <select value={req.estado}
          onChange={e=>onUpdateEstado(req.id, e.target.value)}
          style={{ flex:1, background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.15)', color:'#e2e8f0', borderRadius:4, padding:'3px 6px', fontSize:'0.65rem', fontFamily:'inherit' }}>
          {estadosDisponibles(req).map(s=><option key={s} value={s} style={{ background:'#1a1a2e', color:'#e2e8f0' }}>{s}</option>)}
        </select>
        {req.estado === 'Aprobado' && (
          <button onClick={()=>onEnviar(req)} title="Enviar a compras"
            style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', color:'#F59E0B', borderRadius:4, padding:'3px 7px', cursor:'pointer', display:'flex', alignItems:'center', gap:3, fontSize:'0.62rem' }}>
            <Send size={10}/> Enviar
          </button>
        )}
      </div>}
    </div>
  )
}

// ─── Vista principal ───────────────────────────────────────
export default function Requerimientos({ focusId }) {
  const { allowedSedeIds, perfil, can } = useAuth()
  const canManage = can('compras', 'manage')
  const canRequest = can('compras', 'request') || canManage
  const [reqs, setReqs]       = useState([])
  const [sedes, setSedes]     = useState([])
  const [contactos, setContactos] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editReq, setEditReq]  = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroUrgencia, setFiltroUrgencia] = useState('')
  const [filtroSede, setFiltroSede] = useState('')
  const [emailCompras, setEmailCompras] = useState('compras.gerencia@serviciosdrill.com.ar;compras@flykitchen.com.ar')
  const [showClosed, setShowClosed] = useState(false)
  const [showKpis, setShowKpis] = useState(false)
  const [showProcess, setShowProcess] = useState(false)
  const [showEquipoCompras, setShowEquipoCompras] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, s, c, p] = await Promise.all([
        getRequerimientos({ estado: filtroEstado||undefined, urgencia: filtroUrgencia||undefined, sedeIds: allowedSedeIds||undefined, sedeId: filtroSede||undefined }),
        getSedes(allowedSedeIds), getContactos(), getPerfiles()
      ])
      setReqs(r); setSedes(s); setContactos(c); setPerfiles(p)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [filtroEstado, filtroUrgencia, filtroSede])

  useEffect(()=>{ load() }, [load])
  useEffect(() => {
    if (!focusId || loading) return
    const target = reqs.find(req => String(req.id) === String(focusId))
    if (target) {
      setEditReq(target)
      setShowForm(true)
    }
  }, [focusId, loading, reqs])

  // Si el usuario tiene una sola sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (allowedSedeIds?.length === 1) setFiltroSede(String(allowedSedeIds[0])) }, [allowedSedeIds])

  const handleUpdateEstado = async (id, estado) => {
    if (!canManage) return
    const req = reqs.find(r=>r.id===id)
    if (!req || req.estado === estado) return
    let comentario = ''
    if (['Observado','Rechazado'].includes(estado)) {
      comentario = (await pedirTexto({
        titulo: estado === 'Observado' ? 'Observar requerimiento' : 'Rechazar requerimiento',
        mensaje: estado === 'Observado'
          ? '¿Qué debe corregir o responder el solicitante?'
          : 'Indicá el motivo del rechazo:',
        confirmText: estado,
      })) || ''
      if (!comentario) return
    }
    try {
      const payload = buildTransitionPayload(req, estado, perfil, comentario)
      const updated = await updateRequerimiento(id, payload)
      setReqs(prev=>prev.map(r=>r.id===id?{...r,...updated}:r))
      if (estado === 'Observado') {
        const solicitante = solicitantes.find(s=>s.nombre===req.solicitante)
        const destino = solicitante?.email || ''
        const subject = encodeURIComponent(`[ACCIÓN REQUERIDA] Requerimiento #${req.numero||req.id} observado`)
        const body = buildObservationEmail({ ...req, ...payload }, comentario, perfil?.nombre || perfil?.email, sedes)
        window.open(`mailto:${destino}?subject=${subject}&body=${body}`, '_blank')
        if (!destino) toast.ok('Se abrió el correo, pero el solicitante no tiene un email registrado. Completá el destinatario manualmente.')
      }
    } catch (e) {
      toast.error('No se pudo actualizar el estado: ' + mensajeError(e))
      await load()
    }
  }

  const handleEnviar = async (req) => {
    if (!canManage) return
    const dest = emailCompras || req.enviado_a || ''
    const subject = encodeURIComponent(`[Requerimiento #${req.numero||req.id}] ${req.descripcion?.substring(0,50)}`)
    const body = buildEmailBody(req, sedes)
    window.open(`mailto:${dest}?subject=${subject}&body=${body}`, '_blank')
    if (!await confirmar({ titulo: 'Envío a Compras', mensaje: '¿Confirmás que el correo fue enviado a Compras? Recién entonces comenzará el reloj del SLA.', confirmText: 'Sí, enviado' })) return
    try {
      const payload = { ...buildTransitionPayload(req, 'Enviado', perfil), enviado_a:dest || null }
      const updated = await updateRequerimiento(req.id, payload)
      setReqs(prev=>prev.map(r=>r.id===req.id?{...r,...updated}:r))
    } catch (e) { toast.error('No se pudo registrar el envío: ' + mensajeError(e)) }
  }

  const byEstado = ESTADOS.reduce((acc, e) => {
    acc[e] = reqs.filter(r=>r.estado===e)
    return acc
  }, {})
  const kanbanEstados = showClosed ? [...KANBAN_ACTIVOS, 'Cumplido','Rechazado','Cancelado'] : KANBAN_ACTIVOS
  const itemsKanban = (estado) => estado === 'Pendiente'
    ? reqs.filter(r=>r.estado === 'Pendiente' || r.estado === 'Observado')
    : (byEstado[estado] || [])

  const alta       = reqs.filter(r=>r.urgencia==='alta'&&!ESTADOS_CERRADOS.has(r.estado)).length
  const cumplidosMedibles = reqs.filter(r=>r.enviado_at && r.cumplido_at)
  const tiemposCumplimiento = cumplidosMedibles.map(r=>diasHabilesEntre(r.enviado_at, new Date(r.cumplido_at)))
  const tiempoPromedio = promedio(tiemposCumplimiento)
  const tiempoMediano = mediana(tiemposCumplimiento)
  const dentroSla = cumplidosMedibles.filter(r=>diasHabilesEntre(r.enviado_at, new Date(r.cumplido_at)) <= (r.sla_dias || SLA_DIAS[r.urgencia] || SLA_DIAS.media)).length
  const slaCumplido = cumplidosMedibles.length ? Math.round(dentroSla / cumplidosMedibles.length * 100) : null
  const vencidos = reqs.filter(r=>r.enviado_at && !ESTADOS_CERRADOS.has(r.estado) && diasHabilesEntre(r.enviado_at) > (r.sla_dias || SLA_DIAS[r.urgencia] || SLA_DIAS.media)).length
  const tiemposAprobacion = reqs.filter(r=>r.created_at && r.aprobado_at).map(r=>diasHabilesEntre(r.created_at, new Date(r.aprobado_at)))
  const observados = reqs.filter(r=>r.observado_at || (r.historial_estados || []).some(e=>e.a==='Observado')).length
  const tasaObservados = reqs.length ? Math.round(observados / reqs.length * 100) : 0
  const abiertos = reqs.filter(r=>!ESTADOS_CERRADOS.has(r.estado))
  const mayorAntiguedad = abiertos.length ? Math.max(...abiertos.map(r=>diasHabilesEntre(r.created_at) || 0)) : 0
  const ahora = new Date()
  const cumplidosMes = reqs.filter(r=>r.cumplido_at && new Date(r.cumplido_at).getMonth()===ahora.getMonth() && new Date(r.cumplido_at).getFullYear()===ahora.getFullYear()).length

  const SEL = { background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.15)', color:'#e2e8f0', borderRadius:5, padding:'5px 10px', fontSize:'0.65rem', fontFamily:'inherit' }
  const solicitantes = Array.from(
    new Map(
      [...perfiles.map(p=>({...p, key:`perfil-${p.id}`})), ...contactos.map(c=>({...c, key:`contacto-${c.id}`}))]
        .filter(persona=>persona.nombre)
        .map(persona=>[persona.nombre.trim().toLocaleLowerCase(), persona])
    ).values()
  ).sort((a,b)=>a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'1.5rem 2rem', display:'flex', flexDirection:'column', gap:16 }}>
      {showEquipoCompras && <EquipoComprasModal onClose={()=>setShowEquipoCompras(false)}/>} 
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ color:'var(--text)', fontWeight:800, fontSize:'1.4rem' }}>Requerimientos de Compra</h1>
          <p style={{ fontSize:'0.62rem', color:'rgba(57,255,20,0.5)', fontFamily:'monospace', letterSpacing:'0.1em' }}>
            GESTIÓN · SEGUIMIENTO · ISO 9001 CL. 7.4
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <ContactosQuickBtn modulo="compras" />
          <button onClick={()=>setShowEquipoCompras(true)} className="btn-ghost"
            title="Ver responsables y alcance del equipo de compras"
            style={{ padding:'0.4rem 0.65rem', display:'flex', alignItems:'center', gap:5, fontSize:'0.65rem' }}>
            <Users size={12}/> Equipo de compras
          </button>
          <button onClick={()=>setShowProcess(v=>!v)} className="btn-ghost"
            title="Ver flujo y condiciones del proceso"
            style={{ padding:'0.4rem 0.65rem', display:'flex', alignItems:'center', gap:5, fontSize:'0.65rem' }}>
            <BookOpen size={12}/>
            {showProcess ? 'Ocultar proceso' : 'Ver proceso'}
            {showProcess ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
          </button>
          <button onClick={()=>setShowKpis(v=>!v)} className="btn-ghost"
            title={showKpis?'Ocultar indicadores':'Mostrar indicadores'}
            style={{ padding:'0.4rem 0.65rem', display:'flex', alignItems:'center', gap:5, fontSize:'0.65rem' }}>
            {showKpis ? <EyeOff size={12}/> : <Eye size={12}/>}
            {showKpis ? 'Ocultar KPIs' : 'Mostrar KPIs'}
          </button>
          <button onClick={load} className="btn-ghost" style={{ padding:'0.4rem 0.5rem' }}><RefreshCw size={12}/></button>
          {canRequest && <button onClick={()=>{ setEditReq(null); setShowForm(true) }} className="btn-primary"
            style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Plus size={12}/> Nuevo requerimiento
          </button>}
        </div>
      </div>

      {showProcess && (
        <div className="glass rounded fade-in" style={{ borderRadius:3, padding:'12px 14px', border:'1px solid rgba(96,165,250,0.18)' }}>
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:6, marginBottom:10 }}>
            {['Pendiente','Aprobado','Enviado','En compra','Recibido','Cumplido'].map((estado, i, arr)=>(
              <div key={estado} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ padding:'5px 8px', borderRadius:3, border:`1px solid ${EST_COLOR[estado]}55`, color:EST_COLOR[estado], background:`${EST_COLOR[estado]}12`, fontSize:'0.62rem', fontWeight:700 }}>
                  {i + 1}. {estado}
                </span>
                {i < arr.length - 1 && <span style={{ color:'var(--text-dim)', fontSize:'0.7rem' }}>→</span>}
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))', gap:'6px 16px', color:'var(--text-dim)', fontSize:'0.65rem', lineHeight:1.5 }}>
            <p><strong style={{ color:'#FB923C' }}>Observado:</strong> vuelve al solicitante con un motivo obligatorio y puede corregirse.</p>
            <p><strong style={{ color:'#F87171' }}>Rechazado:</strong> cierre definitivo; Cancelado queda para retiros o duplicados.</p>
            <p><strong style={{ color:'#F59E0B' }}>Enviado:</strong> inicia el SLA y bloquea los datos originales del pedido.</p>
            <p><strong style={{ color:'#A78BFA' }}>En compra:</strong> Compras ya inició la gestión con proveedor.</p>
            <p><strong style={{ color:'#2DD4BF' }}>Recibido:</strong> el artículo llegó, pero todavía debe validarse o entregarse.</p>
            <p><strong style={{ color:'#39FF14' }}>Cumplido:</strong> entrega validada por la sede; detiene el reloj principal.</p>
          </div>
          <p style={{ marginTop:9, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)', color:'rgba(57,255,20,0.65)', fontSize:'0.62rem', fontFamily:'monospace' }}>
            SLA: ALTA 3 DÍAS · MEDIA 7 DÍAS · BAJA 15 DÍAS HÁBILES
          </p>
        </div>
      )}

      {/* Contadores por fase */}
      {!loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(115px,1fr))', gap:7 }}>
          {RESUMEN_ESTADOS.map(estado=>(
            <div key={estado} className="glass rounded" style={{ padding:'8px 10px', borderRadius:3, borderLeft:`2px solid ${EST_COLOR[estado]}` }}>
              <p style={{ color:EST_COLOR[estado], fontSize:'1rem', fontWeight:800 }}>
                {estado === 'Pendiente' ? byEstado.Pendiente.length + byEstado.Observado.length : byEstado[estado].length}
              </p>
              <p style={{ color:'var(--text-dim)', fontSize:'0.56rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{estado}</p>
              {estado === 'Pendiente' && byEstado.Observado.length > 0 && (
                <p style={{ color:'#FB923C', fontSize:'0.54rem', marginTop:2 }}>{byEstado.Observado.length} observado{byEstado.Observado.length===1?'':'s'}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      {!loading && showKpis && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
          {[
            { label:'Promedio enviado → cumplido', val:tiempoPromedio===null?'—':`${tiempoPromedio.toFixed(1)} d`, color:'#39FF14' },
            { label:'Mediana de cumplimiento', val:tiempoMediano===null?'—':`${tiempoMediano.toFixed(1)} d`, color:'#2DD4BF' },
            { label:'Cumplimiento de SLA', val:slaCumplido===null?'—':`${slaCumplido}%`, color:slaCumplido!==null&&slaCumplido<80?'#FF2A2A':'#39FF14' },
            { label:'Fuera de SLA activos', val:vencidos, color:vencidos?'#FF2A2A':'#39FF14' },
            { label:'Tiempo medio aprobación', val:tiemposAprobacion.length?`${promedio(tiemposAprobacion).toFixed(1)} d`:'—', color:'#60A5FA' },
            { label:'Tasa de observados', val:`${tasaObservados}%`, color:'#FB923C' },
            { label:'Mayor antigüedad abierta', val:`${mayorAntiguedad} d`, color:mayorAntiguedad>15?'#FF2A2A':'#F59E0B' },
            { label:'Cumplidos este mes', val:cumplidosMes, color:'#39FF14' },
            { label:'Urgencia alta activos', val:alta, color:'#FF2A2A' },
          ].map(k=>(
            <div key={k.label} className="kpi-card">
              <p className="kpi-value" style={{ color:k.color }}>{k.val}</p>
              <p className="kpi-label">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros + email compras */}
      <div className="glass rounded p-3" style={{ borderRadius:3, display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
        <div>
          <label style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em', display:'block', marginBottom:3 }}>ESTADO</label>
          <select style={SEL} value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em', display:'block', marginBottom:3 }}>URGENCIA</label>
          <select style={SEL} value={filtroUrgencia} onChange={e=>setFiltroUrgencia(e.target.value)}>
            <option value="">Todas</option>
            {URGENCIAS.map(u=><option key={u} value={u}>{u.charAt(0).toUpperCase()+u.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em', display:'block', marginBottom:3 }}>SEDE</label>
          <select style={SEL} value={filtroSede} onChange={e=>setFiltroSede(e.target.value)}>
            <option value="">Todas</option>
            {sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          <label style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em', display:'block', marginBottom:3 }}>EMAIL DE COMPRAS (para envíos)</label>
          <input style={{ ...SEL, width:'100%' }} value={emailCompras}
            onChange={e=>setEmailCompras(e.target.value)} placeholder="compras@flyktichen.com"/>
        </div>
        <button onClick={()=>{ setFiltroEstado(''); setFiltroUrgencia(''); setFiltroSede('') }} className="btn-ghost" style={{ fontSize:'0.65rem' }}>
          Limpiar
        </button>
      </div>

      {/* Kanban */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:-8 }}>
        <button onClick={()=>setShowClosed(v=>!v)} className="btn-ghost"
          style={{ padding:'0.35rem 0.6rem', display:'flex', alignItems:'center', gap:5, fontSize:'0.63rem' }}>
          {showClosed ? <EyeOff size={11}/> : <Eye size={11}/>}
          {showClosed ? 'Ocultar cierres' : `Mostrar cierres (${ESTADOS_CERRADOS.size})`}
        </button>
      </div>
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }}/>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${kanbanEstados.length}, minmax(235px,1fr))`, gap:12, flex:1, overflowX:'auto', paddingBottom:8 }}>
          {kanbanEstados.map(estado=>{
            const { color, bg } = colHeader[estado]
            const items = itemsKanban(estado)
            return (
              <div key={estado} style={{ display:'flex', flexDirection:'column', gap:8, minWidth:160 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', borderRadius:5, background:bg, border:`1px solid ${bg.replace('0.0','0.2')}` }}>
                  <span style={{ color, fontSize:'0.62rem', fontFamily:'monospace', fontWeight:700, letterSpacing:'0.08em' }}>{estado.toUpperCase()}</span>
                  <span style={{ color, fontSize:'0.62rem', fontWeight:700 }}>{items.length}</span>
                </div>
                {items.map(r=>(
                  <ReqCard key={r.id} req={r}
                    onEdit={r=>{ setEditReq(r); setShowForm(true) }}
                    onUpdateEstado={handleUpdateEstado}
                    onEnviar={handleEnviar}
                    readOnly={!canManage && !(canRequest && ['Pendiente','Observado'].includes(r.estado))}/>
                ))}
                {items.length===0 && (
                  <div style={{ textAlign:'center', padding:'1.5rem 0', color:'rgba(107,114,128,0.3)', fontSize:'0.62rem', border:'1px dashed rgba(107,114,128,0.15)', borderRadius:5 }}>
                    Sin requerimientos
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <RequerimientoForm
          req={editReq}
          sedes={sedes}
          solicitantes={solicitantes}
          perfil={perfil}
          emailCompras={emailCompras}
          onClose={()=>{ setShowForm(false); setEditReq(null) }}
          onSaved={load}/>
      )}
    </div>
  )
}
