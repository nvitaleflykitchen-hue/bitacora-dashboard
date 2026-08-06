const LEVEL_RANK = { info: 1, advertencia: 2, critico: 3 }

const DESTINATION_LABELS = {
  mntTickets: 'Mantenimiento · Tickets',
  mntKanban: 'Mantenimiento · Asignación',
  mntMatafuegos: 'Mantenimiento · Matafuegos',
  flotaGestion: 'Flota · Documentación',
  capa: 'Calidad · Acciones correctivas',
}

export function groupOperationalAlerts(alerts = []) {
  const groups = new Map()
  for (const alert of alerts) {
    const key = alert.navegarA || alert.id
    const current = groups.get(key) || {
      id:key,
      navegarA:alert.navegarA,
      label:DESTINATION_LABELS[key] || 'Alertas operativas',
      nivel:alert.nivel || 'info',
      total:0,
      items:[],
    }
    current.items.push(alert)
    current.total += Number(alert.count || 1)
    if ((LEVEL_RANK[alert.nivel] || 0) > (LEVEL_RANK[current.nivel] || 0)) current.nivel = alert.nivel
    groups.set(key, current)
  }
  return [...groups.values()].sort((a, b) =>
    (LEVEL_RANK[b.nivel] - LEVEL_RANK[a.nivel]) || (b.total - a.total),
  )
}
