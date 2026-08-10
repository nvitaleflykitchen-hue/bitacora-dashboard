import { useMemo, useState } from 'react'
import { BarChart3, CheckSquare, Download, FileSearch, Loader2, Square, X } from 'lucide-react'
import { GESTION_REPORT_SECTIONS, generarInformeGestionGeneralPDF, loadGestionGeneralReportData } from '../lib/gestionGeneralReportPdf'
import { buildGestionScorecards, gestionScoreTone } from '../lib/gestionKpis'
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
  const [scorecards, setScorecards] = useState(null)
  const [scope, setScope] = useState('global')

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

  const analizar = async () => {
    if (!sedeIds.length) return toast.warn('Seleccioná al menos una sede.')
    if (!desde || !hasta || desde > hasta) return toast.warn('Revisá el período seleccionado.')
    const selectedSedes = sedes.filter(sede => sedeIds.includes(String(sede.id)))
    setLoading(true)
    try {
      const data = await loadGestionGeneralReportData({
        sedeIds:selectedSedes.map(sede => sede.id),
        desde,
        hasta,
        sections:GESTION_REPORT_SECTIONS.map(item => item.id),
      })
      setScorecards(buildGestionScorecards({ data, sedes:selectedSedes, desde, hasta }))
      if (scope !== 'global' && !sedeIds.includes(scope)) setScope('global')
    } catch (error) {
      toast.error('No se pudieron calcular los indicadores: ' + mensajeError(error))
    } finally {
      setLoading(false)
    }
  }

  const selectedCard = scorecards
    ? scope === 'global' ? scorecards.global : scorecards.bySede.find(item => item.id === scope) || scorecards.global
    : null
  const toneColor = score => ({green:'var(--phosphor)',blue:'#60A5FA',yellow:'var(--warn)',red:'var(--alert)',gray:'var(--text-dim)'})[gestionScoreTone(score)]

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
          <button onClick={onClose} aria-label="Cerrar informe" className="btn-ghost" disabled={loading}><X size={14}/></button>
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

        <div className="mb-5" style={{borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:'1rem'}}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="font-metric block mb-1" style={{fontSize:'.6rem',color:'var(--text-dim)'}}>VISTA DEL TABLERO</label>
              <select className="input-dark" value={scope} onChange={event=>setScope(event.target.value)} style={{minWidth:260}}>
                <option value="global">Global empresa</option>
                {sedes.filter(sede=>sedeIds.includes(String(sede.id))).map(sede=><option key={sede.id} value={String(sede.id)}>{sede.nombre}</option>)}
              </select>
            </div>
            <button type="button" onClick={analizar} className="btn-primary flex items-center gap-2" disabled={loading||!sedeIds.length}>
              {loading?<Loader2 size={13} className="animate-spin"/>:<FileSearch size={13}/>} Calcular indicadores
            </button>
          </div>

          {selectedCard&&<div className="mt-4 space-y-3">
            <div className="glass p-4 flex flex-wrap items-center justify-between gap-3">
              <div><div className="font-metric" style={{fontSize:'.62rem',color:'var(--text-dim)'}}>{selectedCard.label.toUpperCase()}</div><div className="font-title font-bold mt-1" style={{fontSize:'1rem',color:'var(--text)'}}>Índice mensual de gestión</div><div style={{fontSize:'.65rem',color:'var(--text-dim)',marginTop:3}}>{selectedCard.volume} registros evaluados · S/D no afecta el promedio</div></div>
              <div className="font-title font-bold" style={{fontSize:'2rem',color:toneColor(selectedCard.score)}}>{selectedCard.score==null?'S/D':selectedCard.score+'%'}</div>
            </div>
            <div>
              <div className="flex items-end justify-between gap-3 mb-2">
                <div>
                  <div className="font-title font-bold" style={{color:'var(--text)',fontSize:'.88rem'}}>Control documental y vencimientos</div>
                  <div style={{color:'var(--text-dim)',fontSize:'.62rem',marginTop:2}}>Qué falta, qué vence y qué ya está vencido al cierre del período.</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {selectedCard.documentation.map(block=>{
                  const labels={persona:'Personal',vehiculo:'Vehículos',sede:'Sedes e instalaciones'}
                  const upcoming=block.proximo7+block.proximo15+block.proximo30
                  return <div key={block.type} className="glass p-3" style={{borderColor:(block.vencido||block.sinCargar)?'rgba(255,42,42,.22)':'rgba(57,255,20,.16)'}}>
                    <div className="flex justify-between gap-3"><div><div className="font-title font-bold" style={{fontSize:'.78rem',color:'var(--text)'}}>{labels[block.type]}</div><div className="font-metric" style={{fontSize:'.55rem',color:'var(--text-dim)',marginTop:2}}>{block.entities} CONTROLADOS · {block.total} REQUISITOS</div></div><div className="font-title font-bold" style={{fontSize:'1.2rem',color:toneColor(block.score)}}>{block.score==null?'S/D':block.score+'%'}</div></div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3" style={{fontSize:'.64rem'}}>
                      <div style={{color:'var(--text-dim)'}}>Vigentes <strong style={{float:'right',color:'var(--phosphor)'}}>{block.vigente}</strong></div>
                      <div style={{color:'var(--text-dim)'}}>Próx. 30 días <strong style={{float:'right',color:upcoming?'var(--warn)':'var(--text)'}}>{upcoming}</strong></div>
                      <div style={{color:'var(--text-dim)'}}>Vencidos <strong style={{float:'right',color:block.vencido?'var(--alert)':'var(--text)'}}>{block.vencido}</strong></div>
                      <div style={{color:'var(--text-dim)'}}>Sin cargar <strong style={{float:'right',color:block.sinCargar?'var(--alert)':'var(--text)'}}>{block.sinCargar}</strong></div>
                      <div style={{color:'var(--text-dim)'}}>Pendientes <strong style={{float:'right',color:block.pendiente?'var(--warn)':'var(--text)'}}>{block.pendiente}</strong></div>
                      <div style={{color:'var(--text-dim)'}}>Observados <strong style={{float:'right',color:block.observado?'var(--warn)':'var(--text)'}}>{block.observado}</strong></div>
                    </div>
                    {upcoming>0&&<div className="font-metric mt-3" style={{fontSize:'.54rem',color:'var(--text-dim)'}}>7 DÍAS: {block.proximo7} · 15 DÍAS: {block.proximo15} · 30 DÍAS: {block.proximo30}</div>}
                  </div>
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {selectedCard.dimensions.map(dimension=><div key={dimension.id} className="glass p-3"><div className="font-metric" style={{fontSize:'.57rem',color:'var(--text-dim)'}}>{dimension.label.toUpperCase()}</div><div className="font-title font-bold mt-2" style={{fontSize:'1.25rem',color:toneColor(dimension.score)}}>{dimension.score==null?'S/D':dimension.score+'%'}</div><div style={{fontSize:'.56rem',color:'var(--text-dim)',marginTop:2}}>Peso {dimension.weight}%</div></div>)}
            </div>
            <div className="overflow-x-auto glass">
              <table className="table-dark w-full"><thead><tr><th>Indicador</th><th>Resultado</th><th>Base</th></tr></thead><tbody>
                {selectedCard.dimensions.flatMap(dimension=>dimension.metrics.map(item=><tr key={dimension.id+'-'+item.label}><td><div style={{color:'var(--text)',fontSize:'.7rem'}}>{item.label}</div><div className="font-metric" style={{fontSize:'.55rem',color:'var(--text-dim)'}}>{dimension.label}</div></td><td style={{color:toneColor(item.score),fontWeight:700}}>{item.score==null?'S/D':item.score+'%'}</td><td style={{color:'var(--text-dim)',fontSize:'.68rem'}}>{item.denominator?item.numerator+' / '+item.denominator:'Sin casos aplicables'}</td></tr>))}
              </tbody></table>
            </div>
            {scope==='global'&&scorecards.bySede.length>0&&<div className="overflow-x-auto glass"><table className="table-dark w-full"><thead><tr><th>Sede</th><th>Índice</th><th>Volumen</th></tr></thead><tbody>{[...scorecards.bySede].sort((a,b)=>(b.score??-1)-(a.score??-1)).map(item=><tr key={item.id} onClick={()=>setScope(item.id)} style={{cursor:'pointer'}}><td style={{color:'var(--text)'}}>{item.label}</td><td style={{color:toneColor(item.score),fontWeight:700}}>{item.score==null?'S/D':item.score+'%'}</td><td style={{color:'var(--text-dim)'}}>{item.volume}</td></tr>)}</tbody></table></div>}
          </div>}
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
