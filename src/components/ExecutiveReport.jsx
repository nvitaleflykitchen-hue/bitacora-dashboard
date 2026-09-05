import React, { useState } from 'react'

export default function ExecutiveReport({ briefing: b, name, loading, error, onNavigate: navigate }) {
  const onNavigate = target => navigate(({compras:'requerimientos',mantenimiento:'mantenimientoHub'})[target] || target)
  const [mode, setMode] = useState('report')
  const [copied, setCopied] = useState('')
  const push = [...b.peopleToPush].sort((a, z) => z.overdue - a.overdue)
  const message = person => `Hola, ${person.name}. Necesito un avance de estos pendientes:\n${person.tasks.map(task => `• ${task}`).join('\n')}\n¿Qué completaste y qué falta? Compartí la evidencia disponible, indicá si hay algún bloqueo o decisión que necesites y confirmá una fecha de cierre.`
  const copy = async person => {
    try { await navigator.clipboard.writeText(message(person)); setCopied(person.name) }
    catch { setCopied('error') }
  }
  const section = (title, text, target, children) => <article className="rounded p-3" style={{background:'rgba(0,0,0,.18)',border:'1px solid rgba(255,255,255,.09)'}}>
    <h3 className="font-bold">{title}</h3><p className="mt-2">{text}</p>{children}
    <button className="btn-ghost mt-3" onClick={() => onNavigate(target)}>Revisar {target === 'equipo' ? 'documentación del equipo' : target === 'tareas' ? 'tareas y evidencias' : target === 'compras' ? 'compras' : 'mantenimiento'}</button>
  </article>
  return <div className="rounded p-3 mt-3" style={{background:'rgba(80,180,255,.045)',border:'1px solid rgba(80,180,255,.16)',fontSize:'.8rem',lineHeight:1.6}}>
    <div className="flex gap-2 flex-wrap">
      <button className={mode === 'report' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('report')}>Mi informe de hoy</button>
      <button className={mode === 'messages' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMode('messages')}>Preparar mensajes de seguimiento</button>
    </div>
    <p className="mt-2" style={{color:'var(--text-dim)'}}>El informe reúne prioridades y próximos pasos. Los mensajes son borradores por responsable; podés copiarlos y editarlos antes de enviar.</p>
    {loading ? <p role="status" className="mt-3">Actualizando los datos del informe…</p> : error ? <p role="alert" className="mt-3">No pudimos actualizar los datos. Usá Actualizar para reintentar; no tomes los contadores como un informe vigente.</p> : mode === 'report' ? <div className="space-y-3 mt-4">
      <h3 className="font-title font-bold">{name || 'Hola'}, este es tu punto de partida.</h3>
      <p>Tenés {b.myTasks.open} tareas propias abiertas ({b.myTasks.overdue} vencidas y {b.myTasks.inProgress} en proceso) y {b.assignedByMe.open} tareas abiertas asignadas por vos, de las cuales {b.assignedByMe.overdue} están vencidas. Las decisiones pendientes también necesitan tu atención, aunque no tengas una tarea personal asignada.</p>
      {section('1. Destrabar decisiones', `${b.approvals.length} asuntos de compras y presupuestos requieren revisión. Revisá el impacto operativo, el monto y qué trabajo está detenido antes de decidir el orden de aprobación.`, 'compras', <><ul className="mt-2">{b.approvals.map((a,i) => <li key={i}>• {a.type}: {a.title}{a.site ? ` · ${a.site}` : ''}</li>)}</ul><button className="btn-ghost mt-2" onClick={() => onNavigate('mantenimiento')}>Revisar presupuestos de mantenimiento</button></>)}
      {section('2. A quién pedir avance', push.length ? 'Empezá por los vencidos y confirmá las próximas entregas. Pedí evidencia, bloqueo y fecha concreta; la demora por sí sola no prueba falta de trabajo.' : 'No se detectaron responsables con tareas asignadas por vos vencidas o con fecha dentro de siete días.', 'tareas', <ul className="mt-2">{push.map(p => <li key={p.name} className="mt-2"><strong>{p.name}</strong>: {p.overdue} vencidas · {p.soon} próximas. {p.tasks.join(' · ')}</li>)}</ul>)}
      {section('3. Acreditar documentación por sede', `${b.compliance.length} personas tienen documentación pendiente de acreditar según los registros: Carnet de manipulador en hospitales y aeropuertos, y PSA en aeropuertos. Confirmá con cada responsable si falta cargar, renovar o tramitar. Este control no acredita por sí solo la existencia del archivo ni verifica su contenido.`, 'equipo', <details className="mt-2"><summary>Ver personas y documentos pendientes ({b.compliance.length})</summary><ul>{b.compliance.map((p,i) => <li key={i} className="mt-2">{p.person} · {p.sites}: {p.missing.join(' + ')}</li>)}</ul></details>)}
      {section('4. Revisar operación y próximos vencimientos', `${b.maintenance.critical} tickets críticos y ${b.maintenance.unassigned} sin responsable. Hay ${b.imminent.length} compromisos vencidos o con fecha dentro de siete días. Confirmá responsable y próximo paso de los que comprometan el servicio.`, 'mantenimiento', <><p className="mt-2">{b.sitesWithoutAssets.length} sedes sin activos registrados: {b.sitesWithoutAssets.join(' · ') || 'ninguna detectada'}. Pedí inventario y fecha de carga; tener activos registrados no confirma un inventario completo.</p><details className="mt-2"><summary>Ver compromisos y fechas</summary><ul>{b.imminent.map((x,i) => <li key={i} className="mt-2">{x.titulo || x.descripcion || x.codigo} · {x.fecha_limite || x.fecha_compromiso || x.fecha_necesidad || 'Sin fecha'}</li>)}</ul></details></>)}
      <p style={{color:'var(--text-dim)'}}>Fuente: datos disponibles según tus permisos. El informe se calcula con esos registros y funciona sin IA local. Para evaluar avance real, revisá subtareas, comentarios y evidencias en cada ficha.</p>
    </div> : <div className="space-y-3 mt-4">
      {!push.length && <p>No hay seguimientos con vencimientos detectados para preparar.</p>}
      {push.map(p => <article key={p.name} className="rounded p-3" style={{background:'rgba(0,0,0,.2)'}}><h3 className="font-bold">Para {p.name}</h3><p className="mt-2" style={{whiteSpace:'pre-wrap'}}>{message(p)}</p><button className="btn-ghost mt-2" onClick={() => copy(p)}>{copied === p.name ? 'Copiado' : 'Copiar mensaje'}</button><button className="btn-ghost mt-2 ml-2" onClick={() => onNavigate('tareas')}>Revisar tareas antes de enviar</button></article>)}
      {copied === 'error' && <p role="status">No se pudo copiar. Podés seleccionar el texto del mensaje.</p>}
    </div>}
  </div>
}
