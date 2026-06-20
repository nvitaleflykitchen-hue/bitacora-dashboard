import { useState, useEffect } from 'react'
import { getSedes, createRegistro, createEscalamientoItem, createRequerimiento } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { db } from '../lib/supabase'
import { ChevronLeft, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Plus, X } from 'lucide-react'

const TURNOS = ['Mañana', 'Tarde', 'Noche']
const NIVELES = ['Bajo', 'Normal', 'Alto', 'Muy alto']
const ESTADOS_GENERALES = [
  { val: 'Sin novedades',        color: '#39FF14', bg: 'rgba(57,255,20,0.12)',  label: 'Sin novedades' },
  { val: 'Hay novedades',        color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Hay novedades' },
  { val: 'Operación condicionada', color: '#FF2A2A', bg: 'rgba(255,42,42,0.12)', label: 'Operación condicionada' },
]
const MOD_ESTADOS = ['Sin novedad', 'Hay novedades', 'Crítico']
const MOD_COLORS  = { 'Sin novedad': '#39FF14', 'Hay novedades': '#F59E0B', 'Crítico': '#FF2A2A' }

const MODULOS = [
  { key: 'a', label: 'Producción / Servicio del turno', ejemplo: 'Ej: faltó personal en el turno, se sirvió 15 min tarde' },
  { key: 'b', label: 'Cadena de frío y conservación', ejemplo: 'Ej: heladera de carnes a 9°C, ya se avisó a mantenimiento' },
  { key: 'c', label: 'Recepción / Abastecimiento', ejemplo: 'Ej: el proveedor de verdura no llegó, falta tomate' },
  { key: 'd', label: 'Stock crítico', ejemplo: 'Ej: quedan 2 días de aceite, pedir reposición urgente' },
  { key: 'e', label: 'Equipos / Mantenimiento', ejemplo: 'Ej: el horno industrial no calienta, ya se generó ticket' },
  { key: 'f', label: 'Higiene / BPM', ejemplo: 'Ej: falta jabón en el lavamanos de cocina' },
  { key: 'g', label: 'Personal / Dotación', ejemplo: 'Ej: ausencia sin aviso de un cocinero, se cubrió con suplente' },
  { key: 'h', label: 'Cliente / Usuario / Incidentes', ejemplo: 'Ej: reclamo de un comensal por demora, ya resuelto' },
]

const TIPOS_ESCALAMIENTO = [
  { val: 'Compras',       color: '#50b4ff' },
  { val: 'Mantenimiento', color: '#F59E0B' },
  { val: 'RRHH',          color: '#a78bfa' },
  { val: 'Logística',     color: '#34d399' },
  { val: 'Calidad',       color: '#fb923c' },
  { val: 'Coordinación',  color: '#f472b6' },
  { val: 'Dirección',     color: '#FF2A2A' },
  { val: 'Otro',          color: '#9ca3af' },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function Chip({ label, active, color, bg, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.45rem 0.85rem', borderRadius: 20, fontSize: '0.78rem',
      fontWeight: active ? 700 : 400, cursor: 'pointer',
      background: active ? bg : 'var(--surface)',
      border: active ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.08)',
      color: active ? color : 'var(--text-dim)', transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      color: 'var(--text-dim)', fontSize: '0.62rem',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      marginBottom: '0.5rem',
    }}>{children}</p>
  )
}

// ── Módulo card ───────────────────────────────────────────────────────────────

function ModuloCard({ mod, estado, detalle, onEstado, onDetalle, ejemplo }) {
  const [open, setOpen] = useState(false)
  const color = MOD_COLORS[estado] || 'var(--text-dim)'
  const tieneNovedad = estado && estado !== 'Sin novedad'

  return (
    <div style={{
      borderRadius: 8, marginBottom: '0.5rem',
      background: 'var(--surface)',
      border: tieneNovedad ? `1.5px solid ${color}44` : '1.5px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            width: 22, height: 22, borderRadius: 4, fontSize: '0.65rem', fontWeight: 800,
            background: tieneNovedad ? `${color}22` : 'rgba(255,255,255,0.05)',
            color: tieneNovedad ? color : 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{mod.key.toUpperCase()}</span>
          <span style={{ color: 'var(--text)', fontSize: '0.85rem', textAlign: 'left' }}>{mod.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          {estado && (
            <span style={{ fontSize: '0.6rem', color, fontWeight: 700 }}>
              {estado === 'Sin novedad' ? 'OK' : estado === 'Crítico' ? '⚠' : '!'}
            </span>
          )}
          {open ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 1rem 0.9rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {MOD_ESTADOS.map(e => (
              <Chip key={e} label={e} active={estado === e}
                color={MOD_COLORS[e]} bg={`${MOD_COLORS[e]}22`}
                onClick={() => { onEstado(e); if (e === 'Sin novedad') onDetalle('') }} />
            ))}
          </div>
          {tieneNovedad && (
            <textarea
              value={detalle} onChange={ev => onDetalle(ev.target.value)}
              rows={3} placeholder={ejemplo || 'Describí la novedad...'}
              style={{
                width: '100%', padding: '0.65rem 0.75rem', borderRadius: 6, resize: 'none',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Escalamiento item card ────────────────────────────────────────────────────

function EscalamientoCard({ item, index, onChange, onRemove }) {
  const tipoSel = TIPOS_ESCALAMIENTO.find(t => t.val === item.tipo)
  const color = tipoSel?.color || '#FF2A2A'

  return (
    <div style={{
      borderRadius: 8, marginBottom: '0.6rem',
      background: 'rgba(255,42,42,0.05)',
      border: `1.5px solid ${color}44`,
      padding: '0.85rem 0.9rem',
    }}>
      {/* Header con número y remove */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Escalamiento #{index + 1}
        </span>
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', padding: '0.1rem', display: 'flex',
        }}>
          <X size={14} />
        </button>
      </div>

      {/* Selector de tipo */}
      <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginBottom: '0.4rem' }}>
        ¿A qué área corresponde? (opcional, ayuda a derivarlo más rápido)
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
        {TIPOS_ESCALAMIENTO.map(t => (
          <button key={t.val} onClick={() => onChange({ ...item, tipo: t.val })} style={{
            padding: '0.35rem 0.7rem', borderRadius: 20, fontSize: '0.72rem',
            fontWeight: item.tipo === t.val ? 700 : 400, cursor: 'pointer',
            background: item.tipo === t.val ? `${t.color}22` : 'var(--surface)',
            border: item.tipo === t.val ? `1.5px solid ${t.color}` : '1.5px solid rgba(255,255,255,0.08)',
            color: item.tipo === t.val ? t.color : 'var(--text-dim)', transition: 'all 0.12s',
          }}>{t.val}</button>
        ))}
      </div>

      {/* Descripción */}
      <textarea
        value={item.descripcion}
        onChange={e => onChange({ ...item, descripcion: e.target.value })}
        rows={2}
        placeholder="Describí el escalamiento..."
        style={{
          width: '100%', padding: '0.65rem 0.75rem', borderRadius: 6, resize: 'none',
          background: 'var(--surface)', border: `1px solid ${color}33`,
          color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MobileReporte({ onBack, onSuccess }) {
  const { perfil, allowedSedeIds } = useAuth()
  const [sedes,    setSedes]    = useState([])
  const [sedeId,   setSedeId]   = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [enviado,      setEnviado]      = useState(false)
  const [escCompras,   setEscCompras]   = useState([])   // escalamientos de tipo Compras post-submit
  const [reqForm,      setReqForm]      = useState(null) // null | { descripcion, sede_id, sede_nombre }
  const [reqLoading,   setReqLoading]   = useState(false)
  const [reqOk,        setReqOk]        = useState(false)

  // Campos
  const [turno,          setTurno]          = useState('')
  const [nivelActividad, setNivelActividad] = useState('Normal')
  const [estadoGeneral,  setEstadoGeneral]  = useState('Sin novedades')
  const [modulos,        setModulos]        = useState(() =>
    Object.fromEntries(MODULOS.map(m => [m.key, { estado: 'Sin novedad', detalle: '' }]))
  )
  // Escalamientos: array de { tipo, descripcion }
  const [escalamientos, setEscalamientos] = useState([])

  // Raciones (solo Comedores)
  const [op1Prod,      setOp1Prod]      = useState('')
  const [op1Serv,      setOp1Serv]      = useState('')
  const [vegProd,      setVegProd]      = useState('')
  const [vegServ,      setVegServ]      = useState('')
  const [ensaladaProd, setEnsaladaProd] = useState('')
  const [postreProd,   setPostreProd]   = useState('')

  // Cargar sedes
  useEffect(() => {
    getSedes(allowedSedeIds?.length ? allowedSedeIds : null).then(list => {
      setSedes(list)
      if (list.length === 1) setSedeId(list[0].id)
      else if (list.length > 0) setSedeId(list[0].id)
    }).catch(console.error)
  }, [allowedSedeIds])

  const sedeSel = sedes.find(s => s.id === sedeId)

  const setMod = (key, field, val) =>
    setModulos(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }))

  const agregarEscalamiento = () =>
    setEscalamientos(prev => [...prev, { tipo: '', descripcion: '' }])

  const actualizarEscalamiento = (i, val) =>
    setEscalamientos(prev => prev.map((e, idx) => idx === i ? val : e))

  const quitarEscalamiento = (i) =>
    setEscalamientos(prev => prev.filter((_, idx) => idx !== i))

  const checkDuplicado = async () => {
    if (!sedeId || !turno) return false
    const hoy = new Date().toISOString().slice(0, 10)
    const { data } = await db()
      .from('registros')
      .select('id')
      .eq('sede_id', sedeId)
      .eq('turno', turno)
      .gte('fecha_reporte', `${hoy}T00:00:00-03:00`)
      .lte('fecha_reporte', `${hoy}T23:59:59-03:00`)
      .limit(1)
    return (data?.length ?? 0) > 0
  }

  const handleSubmit = async (forzar = false) => {
    if (!sedeId)  { setError('Seleccioná una sede'); return }
    if (!turno)   { setError('Seleccioná el turno'); return }
    // Validar escalamientos
    for (const e of escalamientos) {
      if (!e.descripcion.trim()) { setError('Completá la descripción de cada escalamiento'); return }
    }
    setLoading(true); setError(null)
    try {
      if (!forzar) {
        const esDup = await checkDuplicado()
        if (esDup) {
          setError('DUPLICADO')
          setLoading(false)
          return
        }
      }
      const payload = {
        sede_id:              sedeId,
        sede_nombre:          sedeSel?.nombre || '',
        reportante:           perfil?.nombre  || '',
        email_reportante:     perfil?.email   || '',
        turno,
        nivel_actividad:      nivelActividad,
        estado_general:       estadoGeneral,
        requiere_escalamiento: escalamientos.length > 0 || estadoGeneral === 'Operación condicionada',
        motivo_escalamiento:  escalamientos.length > 0 ? escalamientos.map(e => `[${e.tipo || 'General'}] ${e.descripcion}`).join(' | ') : null,
        escalado_a:           escalamientos.length > 0 ? [...new Set(escalamientos.map(e => e.tipo).filter(Boolean))].join(', ') : null,
        origen_form:          'app',
        tipo:                 sedeSel?.tipo || null,
        fecha_reporte:        new Date().toISOString(),
      }
      // Módulos A-H
      for (const m of MODULOS) {
        payload[`estado_${m.key}`]  = modulos[m.key].estado  || 'Sin novedad'
        payload[`detalle_${m.key}`] = modulos[m.key].detalle || null
      }
      // Raciones (solo Comedores)
      if (sedeSel?.tipo === 'Comedor') {
        payload.op1_producidos          = op1Prod      ? parseInt(op1Prod)      : null
        payload.op1_servidos            = op1Serv      ? parseInt(op1Serv)      : null
        payload.vegetariano_producidos  = vegProd      ? parseInt(vegProd)      : null
        payload.vegetariano_servidos    = vegServ      ? parseInt(vegServ)      : null
        payload.ensalada_producidos     = ensaladaProd ? parseInt(ensaladaProd) : null
        payload.postre_producidos       = postreProd   ? parseInt(postreProd)   : null
      }
      const registro = await createRegistro(payload)
      const registroId = registro?.id ?? registro?.[0]?.id ?? null

      // Insertar escalamientos individuales
      if (escalamientos.length > 0 && registroId) {
        const fechaHoy = new Date().toISOString().slice(0, 10)
        await Promise.all(escalamientos.map(e =>
          createEscalamientoItem({
            registro_id:  registroId,
            tipo:         e.tipo || 'Otro',
            descripcion:  e.descripcion,
            sede_id:      sedeId,
            sede_nombre:  sedeSel?.nombre || '',
            reportante:   perfil?.nombre  || '',
            fecha_reporte: fechaHoy,
            estado:       'Pendiente',
          })
        ))
      }

      // Detectar escalamientos de Compras para ofrecer requerimiento
      const compras = escalamientos.filter(e => e.tipo === 'Compras')
      if (compras.length > 0) {
        setEscCompras(compras)
        setReqForm({
          descripcion: compras.map(e => e.descripcion).join('\n'),
          sede_id:     sedeId,
          sede_nombre: sedeSel?.nombre || '',
        })
      }
      setEnviado(true)
      if (compras.length === 0) setTimeout(() => onSuccess(), 1500)
    } catch (err) {
      if (err.message?.includes('registros_sede_turno_dia_uq')) {
        setError('DUPLICADO')
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('SIN_RED')
      } else {
        setError(err.message || 'Error desconocido')
      }
    } finally {
      setLoading(false)
    }
  }


  const generarPDF = () => {
    const fecha    = new Date()
    const fechaStr = fecha.toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    const horaStr  = fecha.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
    const modulosConNovedad = MODULOS.filter(m => modulos[m.key].estado && modulos[m.key].estado !== 'Sin novedad')
    const estadoClass = estadoGeneral === 'Sin novedades' ? 'ok' : estadoGeneral === 'Hay novedades' ? 'warn' : 'crit'

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Turno — ${sedeSel?.nombre || ''}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; color: #111; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  .sub { color: #666; font-size: 0.85rem; margin-bottom: 20px; }
  .badge { display:inline-block; padding:4px 14px; border-radius:20px; font-weight:700; font-size:0.85rem; margin-bottom:18px; }
  .ok   { background:#e6ffe6; color:#1a7a1a; border:1px solid #4caf50; }
  .warn { background:#fff8e1; color:#b45309; border:1px solid #f59e0b; }
  .crit { background:#ffe6e6; color:#c00;    border:1px solid #f00; }
  table { width:100%; border-collapse:collapse; margin:12px 0; }
  th { text-align:left; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.06em; color:#888; padding:4px 8px; border-bottom:2px solid #ddd; }
  td { padding:7px 8px; font-size:0.87rem; border-bottom:1px solid #eee; vertical-align:top; }
  .esc { background:#fff4f4; border:1px solid #fcc; border-radius:6px; padding:8px 12px; margin:4px 0; font-size:0.85rem; }
  .footer { margin-top:32px; padding-top:10px; border-top:1px solid #ddd; font-size:0.7rem; color:#aaa; }
  @media print { body { padding:10px } }
</style>
</head>
<body>
<h1>Fly Kitchen — Reporte de Turno</h1>
<div class="sub">${sedeSel?.nombre || '—'} · Turno ${turno} · ${fechaStr}, ${horaStr} hs</div>
<div class="badge ${estadoClass}">${estadoGeneral}</div>
<table>
  <tr><th>Reportante</th><th>Nivel de actividad</th></tr>
  <tr><td>${perfil?.nombre || '—'}</td><td>${nivelActividad}</td></tr>
</table>
${modulosConNovedad.length > 0 ? `
<h3 style="font-size:0.9rem;margin:18px 0 6px">Módulos con novedades</h3>
<table>
  <tr><th>Módulo</th><th>Estado</th><th>Detalle</th></tr>
  ${modulosConNovedad.map(m => `
  <tr><td>${m.label}</td><td>${modulos[m.key].estado}</td><td>${modulos[m.key].detalle || '—'}</td></tr>`).join('')}
</table>` : '<p style="color:#2a7a2a;font-size:0.85rem;margin:12px 0">✓ Todos los módulos sin novedades</p>'}
${escalamientos.length > 0 ? `
<h3 style="font-size:0.9rem;margin:18px 0 6px">Escalamientos</h3>
${escalamientos.map((e, i) => `<div class="esc"><strong>${i+1}. [${e.tipo || 'General'}]</strong> — ${e.descripcion}</div>`).join('')}` : ''}
<div class="footer">Fly Kitchen Operations · ${fecha.toISOString()} · origen: app</div>
</body>
</html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
  }

  // ── Pantalla de éxito ──
  if (enviado) {
    const handleCrearReq = async () => {
      if (!reqForm) return
      setReqLoading(true)
      try {
        await createRequerimiento({
          sede_id:     reqForm.sede_id,
          sede_nombre: reqForm.sede_nombre,
          solicitante: perfil?.nombre || '',
          descripcion: reqForm.descripcion,
          urgencia:    'alta',
          estado:      'Pendiente',
        })
        setReqOk(true)
        setTimeout(() => onSuccess(), 1500)
      } catch (e) {
        console.error(e)
      } finally {
        setReqLoading(false)
      }
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.5rem' }}>
        <div style={{ fontSize: '3rem' }}>✓</div>
        <p style={{ color: 'var(--phosphor)', fontWeight: 700, fontSize: '1.1rem' }}>Reporte enviado</p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Gracias {perfil?.nombre?.split(' ')[0]}</p>
        <button onClick={generarPDF} style={{
          marginTop: '0.25rem', padding: '0.6rem 1.4rem', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
          color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 600,
        }}>
          📄 Descargar reporte
        </button>

        {escCompras.length > 0 && !reqOk && (
          <div style={{
            width: '100%', marginTop: '0.5rem', borderRadius: 10,
            background: 'rgba(80,180,255,0.07)', border: '1.5px solid rgba(80,180,255,0.25)',
            padding: '1rem',
          }}>
            <p style={{ color: '#50b4ff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              📦 Escalamiento a Compras detectado
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginBottom: '0.9rem', lineHeight: 1.4 }}>
              {escCompras.map(e => e.descripcion).join(' · ')}
            </p>
            <button
              onClick={handleCrearReq}
              disabled={reqLoading}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 8,
                background: reqLoading ? 'rgba(80,180,255,0.3)' : 'rgba(80,180,255,0.15)',
                border: '1.5px solid rgba(80,180,255,0.4)',
                color: '#50b4ff', fontWeight: 700, fontSize: '0.88rem',
                cursor: reqLoading ? 'wait' : 'pointer',
              }}>
              {reqLoading ? 'Creando...' : '+ Crear requerimiento de compras'}
            </button>
            <button onClick={() => onSuccess()}
              style={{
                width: '100%', marginTop: '0.5rem', padding: '0.5rem',
                background: 'none', border: 'none', color: 'var(--text-dim)',
                fontSize: '0.75rem', cursor: 'pointer',
              }}>
              Omitir
            </button>
          </div>
        )}

        {reqOk && (
          <p style={{ color: 'var(--phosphor)', fontSize: '0.82rem' }}>Requerimiento creado ✓</p>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.2rem' }}>
          <ChevronLeft size={22} />
        </button>
        <div>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', margin: 0 }}>Nuevo Reporte</h2>
          <p style={{ color: 'rgba(57,255,20,0.5)', fontSize: '0.65rem', margin: 0, marginTop: 1 }}>
            {perfil?.nombre || '—'}
          </p>
        </div>
      </div>

      {/* Body scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.1rem 1rem' }}>

        {/* Sede */}
        <div style={{ marginBottom: '1.1rem' }}>
          <SectionLabel>Sede *</SectionLabel>
          {sedes.length === 1 ? (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: 8, fontWeight: 600,
              background: 'rgba(57,255,20,0.07)', border: '1.5px solid rgba(57,255,20,0.2)',
              color: 'var(--phosphor)', fontSize: '0.9rem',
            }}>{sedeSel?.nombre}</div>
          ) : (
            <select value={sedeId || ''} onChange={e => setSedeId(Number(e.target.value))}
              style={{
                width: '100%', padding: '0.8rem 1rem', borderRadius: 8,
                background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text)', fontSize: '0.9rem', appearance: 'none',
              }}>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          )}
        </div>

        {/* Turno */}
        <div style={{ marginBottom: '1.1rem' }}>
          <SectionLabel>Turno *</SectionLabel>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {TURNOS.map(t => (
              <button key={t} onClick={() => setTurno(t)} style={{
                flex: 1, padding: '0.75rem 0', borderRadius: 8, cursor: 'pointer',
                fontWeight: turno === t ? 700 : 400, fontSize: '0.85rem',
                background: turno === t ? 'rgba(57,255,20,0.12)' : 'var(--surface)',
                border: turno === t ? '1.5px solid #39FF14' : '1.5px solid rgba(255,255,255,0.08)',
                color: turno === t ? '#39FF14' : 'var(--text-dim)', transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Nivel actividad */}
        <div style={{ marginBottom: '1.1rem' }}>
          <SectionLabel>Nivel de actividad</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {NIVELES.map(n => (
              <Chip key={n} label={n} active={nivelActividad === n}
                color="#50b4ff" bg="rgba(80,180,255,0.12)"
                onClick={() => setNivelActividad(n)} />
            ))}
          </div>
        </div>

        {/* Estado general */}
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionLabel>Estado general *</SectionLabel>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', lineHeight: 1.4, marginTop: '-0.3rem', marginBottom: '0.6rem' }}>
            Sin novedades: turno normal. Hay novedades: pasó algo pero no afecta el servicio. Operación condicionada: no se puede prestar el servicio con normalidad.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {ESTADOS_GENERALES.map(e => (
              <button key={e.val} onClick={() => {
                setEstadoGeneral(e.val)
                if (e.val === 'Operación condicionada' && escalamientos.length === 0) {
                  setEscalamientos([{ tipo: '', descripcion: '' }])
                }
              }} style={{
                padding: '0.8rem 1rem', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                background: estadoGeneral === e.val ? e.bg : 'var(--surface)',
                border: estadoGeneral === e.val ? `1.5px solid ${e.color}` : '1.5px solid rgba(255,255,255,0.06)',
                color: estadoGeneral === e.val ? e.color : 'var(--text)', fontWeight: estadoGeneral === e.val ? 700 : 400,
                fontSize: '0.9rem', transition: 'all 0.15s',
              }}>{e.label}</button>
            ))}
          </div>
        </div>

        {/* Raciones — solo Comedores */}
        {sedeSel?.tipo === 'Comedor' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <SectionLabel>Raciones del turno (opcional)</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {[
                { label: 'Op.1 producidas', val: op1Prod,      set: setOp1Prod },
                { label: 'Op.1 servidas',   val: op1Serv,      set: setOp1Serv },
                { label: 'Veg. producidas', val: vegProd,      set: setVegProd },
                { label: 'Veg. servidas',   val: vegServ,      set: setVegServ },
                { label: 'Ensalada prod.',  val: ensaladaProd, set: setEnsaladaProd },
                { label: 'Postre prod.',    val: postreProd,   set: setPostreProd },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                  <input
                    type="number" inputMode="numeric" value={val}
                    onChange={e => set(e.target.value)} placeholder="0"
                    style={{
                      width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, boxSizing: 'border-box',
                      background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text)', fontSize: '1rem', textAlign: 'center',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Módulos A-H */}
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionLabel>Módulos</SectionLabel>
          {MODULOS.map(m => (
            <ModuloCard key={m.key} mod={m}
              estado={modulos[m.key].estado}
              detalle={modulos[m.key].detalle}
              onEstado={val => setMod(m.key, 'estado', val)}
              onDetalle={val => setMod(m.key, 'detalle', val)}
              ejemplo={m.ejemplo}
            />
          ))}
        </div>

        {/* Escalamientos */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <SectionLabel>Escalamientos{escalamientos.length > 0 ? ` (${escalamientos.length})` : ''}</SectionLabel>
            <button onClick={agregarEscalamiento} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.3rem 0.7rem', borderRadius: 6, cursor: 'pointer',
              background: 'rgba(255,42,42,0.08)', border: '1px solid rgba(255,42,42,0.3)',
              color: '#FF2A2A', fontSize: '0.72rem', fontWeight: 700,
            }}>
              <Plus size={12} /> Agregar
            </button>
          </div>

          {escalamientos.length === 0 ? (
            <div style={{
              padding: '0.85rem 1rem', borderRadius: 8, textAlign: 'center',
              background: 'var(--surface)', border: '1.5px dashed rgba(255,255,255,0.08)',
              color: 'var(--text-dim)', fontSize: '0.8rem',
            }}>
              Sin escalamientos — tocá "Agregar" si hay algo que derivar
            </div>
          ) : (
            escalamientos.map((item, i) => (
              <EscalamientoCard
                key={i}
                item={item}
                index={i}
                onChange={val => actualizarEscalamiento(i, val)}
                onRemove={() => quitarEscalamiento(i)}
              />
            ))
          )}
        </div>

        {/* Mensajes de error con acción */}
        {error === 'DUPLICADO' && (
          <div style={{
            padding: '1rem', borderRadius: 8, marginBottom: '1rem',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <AlertTriangle size={16} color="#F59E0B" />
              <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.85rem' }}>Ya existe un reporte para este turno</span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '0.8rem' }}>
              Ya se registró un reporte para <strong>{sedeSel?.nombre}</strong>, turno <strong>{turno}</strong> hoy.
              ¿Querés enviarlo igualmente?
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => { setError(null) }}
                style={{
                  flex: 1, padding: '0.65rem', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 600,
                }}>
                Cancelar
              </button>
              <button
                onClick={() => { setError(null); handleSubmit(true) }}
                disabled={loading}
                style={{
                  flex: 1, padding: '0.65rem', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                  color: '#F59E0B', fontSize: '0.82rem', fontWeight: 700,
                }}>
                Enviar igual
              </button>
            </div>
          </div>
        )}

        {error && error !== 'DUPLICADO' && (
          <div style={{
            padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '1rem',
            background: 'rgba(255,42,42,0.08)', border: '1px solid rgba(255,42,42,0.3)',
          }}>
            <p style={{ color: '#FF2A2A', fontSize: '0.82rem', margin: 0 }}>
              {error === 'SIN_RED'
                ? '⚠ Sin conexión — revisá tu red e intentá de nuevo'
                : `Error: ${error}`}
            </p>
            {error === 'SIN_RED' && (
              <button
                onClick={() => handleSubmit()}
                style={{
                  marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                  background: 'none', border: 'none', color: '#F59E0B',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0,
                }}>
                <RefreshCw size={13} /> Reintentar
              </button>
            )}
          </div>
        )}

        {/* Nota de obligatoriedad */}
        <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', textAlign: 'center', marginBottom: '0.6rem' }}>
          * Campos obligatorios para poder enviar el reporte
        </p>

        {/* Botón submit */}
        <button
          onClick={() => handleSubmit()}
          disabled={loading || !sedeId || !turno}
          style={{
            width: '100%', padding: '1rem', borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
            background: loading || !sedeId || !turno
              ? 'rgba(57,255,20,0.15)'
              : 'var(--phosphor)',
            color: loading || !sedeId || !turno ? 'rgba(57,255,20,0.4)' : '#0A0A0E',
            fontWeight: 800, fontSize: '1rem', border: 'none',
            transition: 'all 0.2s',
          }}>
          {loading ? 'Enviando...' : 'Enviar Reporte'}
        </button>

        <div style={{ height: '2rem' }} />
      </div>
    </div>
  )
}
