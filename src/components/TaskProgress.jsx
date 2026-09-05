import React, { useEffect, useState } from 'react'
import { Clock3, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { taskProgress } from '../lib/taskProgress'

export default function TaskProgress({ task }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (['Resuelto','Cancelado'].includes(task.estado)) return
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [task.estado])
  const p = taskProgress(task, now)
  const color = p.overdue ? '#ff5555' : p.review ? '#fbbf24' : 'var(--phosphor)'
  const bar = (label, value, detail, tint) => <div className="mt-3">
    <div className="flex justify-between gap-2 mb-1" style={{fontSize:'.62rem'}}><span>{label}</span><strong>{detail}</strong></div>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} style={{height:8,borderRadius:8,background:'rgba(255,255,255,.1)',overflow:'hidden'}}><div style={{width:`${value}%`,height:'100%',background:tint,borderRadius:8,transition:'width .25s'}} /></div>
  </div>
  return <section aria-label="Tiempo y avance de la tarea" className="mt-3 mb-3">
    <div className="flex items-center gap-3 rounded p-3" style={{border:`1px solid ${color}`,background:'rgba(0,0,0,.18)',color}}>
      {p.closed ? <CheckCircle2 size={25}/> : <Clock3 size={28}/>}
      <div style={{minWidth:0}}><p className="font-metric" style={{fontSize:'.6rem',letterSpacing:'.06em'}}>{p.closed ? 'TAREA CERRADA' : p.overdue ? 'VENCIDA HACE' : 'TIEMPO RESTANTE'}</p>
        <strong className="font-metric" style={{fontSize:p.valid && !p.closed ? '1.5rem' : '.9rem',fontVariantNumeric:'tabular-nums'}}>{p.closed ? task.estado : p.valid ? p.countdown : 'Sin fecha límite'}</strong>
        {p.valid && <p style={{fontSize:'.6rem',color:'var(--text-dim)'}}>Límite: {new Date(p.deadline).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',dateStyle:'short',timeStyle:'short'})} · Argentina</p>}
      </div>
    </div>
    {p.progress === null ? <p className="mt-2" style={{fontSize:'.65rem',color:'var(--text-dim)'}}>Sin subtareas para medir avance.</p> : bar('SUBTAREAS COMPLETADAS',p.progress,`${p.progress}% · ${p.done} de ${p.total}`,'var(--phosphor)')}
    {p.elapsed !== null && bar('PLAZO CONSUMIDO',p.elapsed,`${p.elapsed}%`,p.overdue ? '#ff5555' : '#fbbf24')}
    {p.review && !p.overdue && <p className="flex items-center gap-1 mt-2" style={{fontSize:'.65rem',color:'#fbbf24'}}><AlertTriangle size={12}/> Revisar ritmo de avance</p>}
    {p.progress !== null && <p className="mt-2" style={{fontSize:'.58rem',color:'var(--text-dim)'}}>Avance orientativo: cada subtarea cuenta por igual.</p>}
  </section>
}
