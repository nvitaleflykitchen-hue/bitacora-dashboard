export function taskProgress(task, now = Date.now()) {
  const list = Array.isArray(task.subtareas) ? task.subtareas : []
  const done = list.filter(s => s.completada).length
  const progress = list.length ? Math.round(done / list.length * 100) : null
  const closed = ['Resuelto', 'Cancelado'].includes(task.estado)
  const raw = task.fecha_limite
  const deadline = raw ? Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59-03:00` : raw) : NaN
  const start = Date.parse(task.created_at)
  const valid = Number.isFinite(deadline)
  const elapsed = valid && Number.isFinite(start) && deadline > start && !closed ? Math.min(100, Math.max(0, Math.round((now - start) / (deadline - start) * 100))) : null
  const overdue = valid && now > deadline && !closed
  const minutes = valid ? Math.floor(Math.abs(deadline - now) / 60000) : 0
  const countdown = `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h ${minutes % 60}m`
  return { done, total:list.length, progress, closed, valid, deadline, elapsed, overdue, countdown, review:!closed && progress !== null && elapsed !== null && elapsed - progress >= 15 }
}
