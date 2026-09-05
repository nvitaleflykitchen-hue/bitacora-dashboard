const OPEN_TASKS = new Set(['Pendiente', 'En proceso'])
const CLOSED_TICKETS = new Set(['resuelto', 'cerrado'])
const VALID_DOCS = new Set(['vigente', 'no_aplica'])

const day = value => value ? String(value).slice(0, 10) : null
const daysFromToday = (value, today) => value ? Math.ceil((new Date(`${day(value)}T12:00:00`) - today) / 86400000) : null
const personName = person => [person.nombre, person.apellido].filter(Boolean).join(' ').trim() || 'Sin nombre'

export function buildExecutiveBriefing({ tasks=[], capas=[], requirements=[], tickets=[], assets=[], sites=[], people=[], documents=[], profileIds=[], today=new Date() } = {}) {
  const start = new Date(today); start.setHours(12, 0, 0, 0)
  const ids = new Set(profileIds.filter(Boolean).map(String))
  const openTasks = tasks.filter(task => OPEN_TASKS.has(task.estado))
  const isMine = task => ids.has(String(task.responsable_id || ''))
  const isCreated = task => ids.has(String(task.creado_por || ''))
  const dueSoon = item => { const days=daysFromToday(item.fecha_limite || item.fecha_compromiso || item.fecha_necesidad, start); return days != null && days <= 7 }
  const overdue = item => { const days=daysFromToday(item.fecha_limite || item.fecha_compromiso || item.fecha_necesidad, start); return days != null && days < 0 }
  const myTasks = openTasks.filter(isMine)
  const assignedByMe = openTasks.filter(isCreated)
  const peopleToPushMap = new Map()
  assignedByMe.filter(task => !isMine(task) && dueSoon(task)).forEach(task => {
    const name=task.perfiles?.nombre || task.responsable || 'Sin responsable'
    const current=peopleToPushMap.get(name) || { name, overdue:0, soon:0, tasks:[] }
    overdue(task) ? current.overdue++ : current.soon++
    current.tasks.push(task.titulo)
    peopleToPushMap.set(name,current)
  })

  const siteById = new Map(sites.map(site => [String(site.id), site]))
  const docsByPerson = new Map()
  documents.filter(doc => doc.entity_type === 'persona').forEach(doc => {
    const map=docsByPerson.get(String(doc.entity_id)) || new Map()
    map.set(doc.codigo,doc); docsByPerson.set(String(doc.entity_id),map)
  })
  const validDoc = (personId, code) => {
    const doc=docsByPerson.get(String(personId))?.get(code)
    return !!doc && VALID_DOCS.has(doc.estado) && (!doc.fecha_vencimiento || daysFromToday(doc.fecha_vencimiento,start) >= 0)
  }
  const compliance = people.flatMap(person => {
    const names=(person.sede_ids || []).map(id => siteById.get(String(id))?.nombre || '').filter(Boolean)
    const hospital=names.some(name => /hospital/i.test(name))
    const airport=names.some(name => /aeropuerto/i.test(name))
    const missing=[]
    if((hospital || airport) && !validDoc(person.id,'carnet_manipulador')) missing.push('Carnet manipulador')
    if(airport && !validDoc(person.id,'credencial_psa')) missing.push('Credencial PSA')
    return missing.length ? [{person:personName(person),sites:names.join(' · '),missing}] : []
  })

  const assetsBySite = new Map()
  assets.forEach(asset => asset.sede_id && assetsBySite.set(String(asset.sede_id),(assetsBySite.get(String(asset.sede_id))||0)+1))
  const sitesWithoutAssets = sites.filter(site => !assetsBySite.get(String(site.id))).map(site => site.nombre)
  const openTickets=tickets.filter(ticket => !CLOSED_TICKETS.has(ticket.estado))
  const approvals=[
    ...requirements.filter(req => req.estado === 'Pendiente').map(req => ({type:'Compra',title:req.descripcion || `Requerimiento ${req.numero || req.id}`,site:req.sede_nombre || req.sedes?.nombre})),
    ...openTickets.filter(ticket => ticket.estado_presupuesto === 'pendiente_aprobacion').map(ticket => ({type:'Presupuesto',title:ticket.descripcion,site:ticket.sede})),
  ]
  const imminent=[...openTasks,...capas.filter(c => !['Completada','Verificada'].includes(c.estado)),...openTickets].filter(dueSoon).sort((a,b)=>String(a.fecha_limite||'').localeCompare(String(b.fecha_limite||'')))

  const signals=[]
  if(approvals.length) signals.push({kind:'DECISIÓN',severity:'alta',title:`${approvals.length} aprobaciones requieren revisión`,detail:approvals.slice(0,3).map(x=>`${x.type}: ${x.title}`).join(' | ')})
  ;[...peopleToPushMap.values()].sort((a,b)=>b.overdue-a.overdue).slice(0,4).forEach(item=>signals.push({kind:'EMPUJAR',severity:item.overdue?'alta':'media',title:`Contactar a ${item.name}`,detail:`${item.overdue} vencidas · ${item.soon} próximas. ${item.tasks.slice(0,2).join(' | ')}`}))
  if(compliance.length) signals.push({kind:'CUMPLIMIENTO',severity:'alta',title:`${compliance.length} personas con documentación obligatoria faltante`,detail:compliance.slice(0,4).map(x=>`${x.person}: ${x.missing.join(' + ')}`).join(' | ')})
  if(sitesWithoutAssets.length) signals.push({kind:'COBERTURA',severity:'media',title:`${sitesWithoutAssets.length} sedes sin activos cargados`,detail:sitesWithoutAssets.slice(0,6).join(' · ')})
  const criticalTickets=openTickets.filter(t=>t.prioridad==='critica').length, unassignedTickets=openTickets.filter(t=>!t.responsable_id).length
  if(criticalTickets || unassignedTickets) signals.push({kind:'MANTENIMIENTO',severity:criticalTickets?'alta':'media',title:`${criticalTickets} críticos · ${unassignedTickets} sin responsable`,detail:'Asignar responsable y próximo paso verificable.'})
  if(imminent.length) signals.push({kind:'7 DÍAS',severity:'media',title:`${imminent.length} compromisos vencidos o inminentes`,detail:imminent.slice(0,4).map(x=>x.titulo||x.descripcion||x.codigo).filter(Boolean).join(' | ')})

  return {
    myTasks:{open:myTasks.length,overdue:myTasks.filter(overdue).length,inProgress:myTasks.filter(t=>t.estado==='En proceso').length},
    assignedByMe:{open:assignedByMe.length,overdue:assignedByMe.filter(overdue).length},
    peopleToPush:[...peopleToPushMap.values()], approvals, compliance, sitesWithoutAssets,
    maintenance:{open:openTickets.length,critical:criticalTickets,unassigned:unassignedTickets}, imminent, signals,
  }
}
