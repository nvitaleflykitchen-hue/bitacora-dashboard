import { RotateCcw, Trash2 } from 'lucide-react'

export default function FormDraftNotice({ recovered, savedAt, onDiscard }) {
  if (!recovered && !savedAt) return null
  const time = savedAt ? new Date(savedAt).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }) : null
  return (
    <div role="status" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'8px 10px', border:'1px solid rgba(80,180,255,0.28)', background:'rgba(80,180,255,0.07)', borderRadius:4, color:'#8CC8FF', fontSize:'0.7rem' }}>
      <span style={{ display:'flex', alignItems:'center', gap:6 }}>
        <RotateCcw size={13} /> {recovered ? 'Borrador recuperado' : 'Borrador guardado automáticamente'}{time ? ` · ${time}` : ''}
      </span>
      {onDiscard && <button type="button" className="btn-ghost" onClick={onDiscard} style={{ padding:'0.2rem 0.45rem', fontSize:'0.62rem' }}><Trash2 size={11}/> Descartar</button>}
    </div>
  )
}

