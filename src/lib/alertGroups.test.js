import { describe, expect, it } from 'vitest'
import { groupOperationalAlerts } from './alertGroups'

describe('groupOperationalAlerts', () => {
  it('reúne alertas del mismo destino y conserva la mayor severidad', () => {
    const groups = groupOperationalAlerts([
      { id:'sla', nivel:'critico', count:4, navegarA:'mntTickets', mensaje:'4 SLA vencidos' },
      { id:'old', nivel:'info', count:6, navegarA:'mntTickets', mensaje:'6 tickets antiguos' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ nivel:'critico', total:10, label:'Mantenimiento · Tickets' })
    expect(groups[0].items).toHaveLength(2)
  })

  it('ordena primero los grupos más severos', () => {
    const groups = groupOperationalAlerts([
      { id:'warning', nivel:'advertencia', count:20, navegarA:'mntKanban' },
      { id:'critical', nivel:'critico', count:1, navegarA:'capa' },
    ])
    expect(groups.map(group => group.nivel)).toEqual(['critico', 'advertencia'])
  })
})
