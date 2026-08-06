import { AlertTriangle } from 'lucide-react'

export default function FormErrorSummary({ errors = [] }) {
  if (!errors.length) return null
  const focusField = field => {
    const element = document.querySelector(`[name="${field}"], #${field}`)
    element?.focus()
    element?.scrollIntoView?.({ behavior:'smooth', block:'center' })
  }
  return (
    <div role="alert" aria-live="assertive" style={{ padding:'10px 12px', border:'1px solid rgba(255,42,42,0.35)', background:'rgba(255,42,42,0.07)', borderRadius:4 }}>
      <p style={{ display:'flex', alignItems:'center', gap:6, color:'var(--alert)', fontWeight:700, fontSize:'0.75rem' }}><AlertTriangle size={14}/> Revisá {errors.length === 1 ? 'este campo' : `estos ${errors.length} campos`}</p>
      <ul style={{ margin:'6px 0 0 18px', color:'var(--text)', fontSize:'0.7rem' }}>
        {errors.map(error => <li key={error.field}><button type="button" onClick={() => focusField(error.field)} style={{ color:'inherit', background:'none', border:0, padding:0, textDecoration:'underline', cursor:'pointer' }}>{error.label}: {error.message}</button></li>)}
      </ul>
    </div>
  )
}
