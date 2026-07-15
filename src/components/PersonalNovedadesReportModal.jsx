import { useState } from 'react'
import { CalendarRange, Download, Loader2, X } from 'lucide-react'
import { generarInformeNovedadesPersonalPDF } from '../lib/personalNovedadesReportPdf'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'

function iso(date) { return date.toISOString().slice(0, 10) }

export default function PersonalNovedadesReportModal({ sedes, onClose }) {
  const [sedeId, setSedeId] = useState(sedes.length === 1 ? String(sedes[0].id) : '')
  const [desde, setDesde] = useState(iso(new Date(Date.now() - 30 * 86400000)))
  const [hasta, setHasta] = useState(iso(new Date()))
  const [loading, setLoading] = useState(false)

  const generar = async () => {
    const sede = sedes.find(item => String(item.id) === String(sedeId))
    if (!sede) return toast.warn('Seleccioná una sede.')
    if (!desde || !hasta) return toast.warn('Indicá ambas fechas.')
    if (desde > hasta) return toast.warn('La fecha desde no puede ser posterior a la fecha hasta.')
    setLoading(true)
    try {
      const cantidad = await generarInformeNovedadesPersonalPDF({ sedeId:sede.id, sedeNombre:sede.nombre, desde, hasta })
      toast.ok(cantidad ? `Informe generado con ${cantidad} novedades.` : 'Informe generado sin novedades para el período.')
      onClose()
    } catch (error) {
      toast.error('No se pudo generar el informe: ' + mensajeError(error))
    } finally {
      setLoading(false)
    }
  }

  return <div className="modal-overlay" style={{ zIndex:70 }}>
    <div className="glass fade-in w-full max-w-lg" style={{ background:'var(--surface)', border:'1px solid rgba(57,255,20,.22)', borderRadius:6, padding:'1.5rem' }}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3"><CalendarRange size={19} style={{ color:'var(--phosphor)' }} /><div><h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Informe de novedades del personal</h2><p style={{ color:'var(--text-dim)', fontSize:'.7rem', marginTop:3 }}>Seleccioná la sede y el período que querés informar.</p></div></div>
        <button onClick={onClose} className="btn-ghost" disabled={loading}><X size={14}/></button>
      </div>
      <label className="font-metric block mb-1" style={{ fontSize:'.6rem', color:'var(--text-dim)' }}>SEDE</label>
      <select className="input-dark w-full mb-4" value={sedeId} onChange={e=>setSedeId(e.target.value)}>
        <option value="">Seleccionar sede...</option>
        {sedes.map(sede => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div><label className="font-metric block mb-1" style={{ fontSize:'.6rem', color:'var(--text-dim)' }}>DESDE</label><input type="date" className="input-dark w-full" value={desde} onChange={e=>setDesde(e.target.value)} /></div>
        <div><label className="font-metric block mb-1" style={{ fontSize:'.6rem', color:'var(--text-dim)' }}>HASTA</label><input type="date" className="input-dark w-full" value={hasta} onChange={e=>setHasta(e.target.value)} /></div>
      </div>
      <div style={{ background:'rgba(80,180,255,.07)', border:'1px solid rgba(80,180,255,.16)', borderRadius:4, padding:'10px 12px', fontSize:'.68rem', color:'var(--text-dim)', lineHeight:1.5, marginBottom:18 }}>
        El PDF incluirá únicamente novedades operativas del personal registradas en la bitácora: ausentismo, llegadas tarde, desempeño, conducta y otras categorías.
      </div>
      <div className="flex justify-end gap-2"><button onClick={onClose} className="btn-ghost" disabled={loading}>Cancelar</button><button onClick={generar} className="btn-primary flex items-center gap-2" disabled={loading}>{loading ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>} Generar PDF</button></div>
    </div>
  </div>
}
