import { useMemo, useState } from 'react'
import { BarChart3, CheckSquare, Download, Loader2, Square, X } from 'lucide-react'
import { GESTION_REPORT_SECTIONS, generarInformeGestionGeneralPDF } from '../lib/gestionGeneralReportPdf'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

function localIso(date) {
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function initialRange() {
  const today = new Date()
  return { desde: localIso(new Date(today.getFullYear(), today.getMonth(), 1)), hasta: localIso(today) }
}

export default function GestionGeneralReportModal({ sedes, onClose }) {
  const range = useMemo(initialRange, [])
  const [desde, setDesde] = useState(range.desde)
  const [hasta, setHasta] = useState(range.hasta)
  const [sedeIds, setSedeIds] = useState(() => sedes.map(sede => String(sede.id)))
  const [sections, setSections] = useState(() => GESTION_REPORT_SECTIONS.map(item => item.id))
  const [loading, setLoading] = useState(false)

  const toggle = (value, selected, setter) => {
    setter(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value])
  }

  const generar = async () => {
    if (!sedeIds.length) return toast.warn('Seleccioná al menos una sede.')
    if (!sections.length) return toast.warn('Seleccioná al menos un punto para el resumen.')
    if (!desde || !hasta) return toast.warn('Indicá ambas fechas.')
    if (desde > hasta) return toast.warn('La fecha desde no puede ser posterior a la fecha hasta.')
    const selectedSedes = sedes.filter(sede => sedeIds.includes(String(sede.id)))
    setLoading(true)
    try {
      await generarInformeGestionGeneralPDF({
        sedeIds: selectedSedes.map(sede => sede.id),
        sedes: selectedSedes,
        desde,
        hasta,
        sections,
      })
      toast.ok('Informe general generado.')
      onClose()
    } catch (error) {
      toast.error('No se pudo generar el informe: ' + mensajeError(error))
    } finally {
      setLoading(false)
    }
  }

  const Selector = ({ value, label, selected, onToggle }) => {
    const checked = selected.includes(value)
    return (
      <button type="button" onClick={() => onToggle(value)} className="flex items-start gap-2 text-left p-2 rounded"
        style={{ border:`1px solid ${checked ? 'rgba(57,255,20,.3)' : 'rgba(255,255,255,.08)'}`, background:checked ? 'rgba(57,255,20,.06)' : 'rgba(255,255,255,.02)' }}>
        {checked ? <CheckSquare size={14} style={{ color:'var(--phosphor)', flexShrink:0 }} /> : <Square size={14} style={{ color:'var(--text-dim)', flexShrink:0 }} />}
        <span style={{ color:checked ? 'var(--text)' : 'var(--text-dim)', fontSize:'.72rem' }}>{label}</span>
      </button>
    )
  }

  return (
    <div className="modal-overlay" style={{ zIndex:70 }}>
      <div className="glass fade-in w-full max-w-3xl max-h-[92vh] overflow-y-auto" style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,.22)', borderRadius:6, padding:'1.5rem' }}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <BarChart3 size={20} style={{ color:'var(--phosphor)' }} />
            <div>
              <h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Informe general de gestión</h2>
              <p style={{ color:'var(--text-dim)', fontSize:'.7rem', marginTop:3 }}>Elegí período, sedes y puntos que querés incluir en el resumen.</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" disabled={loading}><X size={14}/></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div><label className="font-metric block mb-1" style={{ fontSize:'.6rem', color:'var(--text-dim)' }}>DESDE</label><input type="date" className="input-dark w-full" value={desde} onChange={event => setDesde(event.target.value)} /></div>
          <div><label className="font-metric block mb-1" style={{ fontSize:'.6rem', color:'var(--text-dim)' }}>HASTA</label><input type="date" className="input-dark w-full" value={hasta} onChange={event => setHasta(event.target.value)} /></div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="font-metric" style={{ fontSize:'.62rem', color:'var(--text-dim)' }}>SEDES ({sedeIds.length}/{sedes.length})</label>
            <button type="button" className="btn-ghost" style={{ fontSize:'.62rem', padding:'.2rem .5rem' }}
              onClick={() => setSedeIds(sedeIds.length === sedes.length ? [] : sedes.map(sede => String(sede.id)))}>
              {sedeIds.length === sedes.length ? 'Quitar todas' : 'Seleccionar todas'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sedes.map(sede => <Selector key={sede.id} value={String(sede.id)} label={sede.nombre} selected={sedeIds} onToggle={value => toggle(value, sedeIds, setSedeIds)} />)}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="font-metric" style={{ fontSize:'.62rem', color:'var(--text-dim)' }}>PUNTOS DEL RESUMEN ({sections.length}/{GESTION_REPORT_SECTIONS.length})</label>
            <button type="button" className="btn-ghost" style={{ fontSize:'.62rem', padding:'.2rem .5rem' }}
              onClick={() => setSections(sections.length === GESTION_REPORT_SECTIONS.length ? [] : GESTION_REPORT_SECTIONS.map(item => item.id))}>
              {sections.length === GESTION_REPORT_SECTIONS.length ? 'Quitar todos' : 'Seleccionar todos'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {GESTION_REPORT_SECTIONS.map(item => <Selector key={item.id} value={item.id} label={item.label} selected={sections} onToggle={value => toggle(value, sections, setSections)} />)}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost" disabled={loading}>Cancelar</button>
          <button onClick={generar} className="btn-primary flex items-center gap-2" disabled={loading || !sedeIds.length || !sections.length}>
            {loading ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>} Generar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
