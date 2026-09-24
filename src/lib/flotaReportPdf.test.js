import { describe, expect, it } from 'vitest'
import { groupVehicleReport } from './flotaReportData'
import { createVehicleReportPdf, vehicleReportFilename } from './flotaReportPdf'

const vehicles = [
  { id:1, nombre:'Hyundai - JDN 191', sede_id:3, sede_nombre:'Aeropuerto de Córdoba', estado:'operativo', responsable:'Fly Kitchen' },
  { id:2, nombre:'Lifan - AD 286 IH', sede_id:3, sede_nombre:'Aeropuerto de Córdoba', estado:'en_reparacion' },
]
const rows = {
  documentation:[{id:10,entity_id:'1',codigo:'seguro_ariel_aeropuerto',titulo:'Seguro ARIEL',estado:'vigente',fecha_vencimiento:'2027-01-01'}],
  fleetDocuments:[], plans:[{id:20,activo_id:1,nombre:'Service',estado:'activo'}],
  executions:[{id:21,plan_id:20,fecha:'2026-09-01',realizado_por:'Pablo'}],
  tickets:[{id:30,activo_id:2,descripcion:'Reparación',estado:'abierto'}],
  news:[
    {id:40,activo_id:1,registro_id:77,descripcion:'El motor perdió potencia al salir de plataforma.',reportante:'Operador',fecha_reporte:'2026-09-20'},
    {id:41,activo_id:2,descripcion:'Revisar neumático',reportante:'Taller',fecha_reporte:'2026-09-21'},
  ],
  reports:[{id:77,fecha_reporte:'2026-09-20T14:30:00Z',reportante:'Romina Rodríguez',turno:'Mañana',sede_nombre:'Aeropuerto de Córdoba'}],
  visits:[], extinguishers:[],
  attachments:[{entity_type:'documentacion_item',entity_id:'10',nombre:'poliza.pdf'}],
}

describe('informes de Flota', () => {
  it('aísla los datos por vehículo y muestra la documentación aeroportuaria aunque esté pendiente', () => {
    const [first,second] = groupVehicleReport(vehicles,rows)
    expect(first.documentation.find(d => d.codigo === 'seguro_ariel_aeropuerto').attachments[0].nombre).toBe('poliza.pdf')
    expect(second.documentation.find(d => d.codigo === 'seguro_ariel_aeropuerto').registered).toBe(false)
    expect(first.plans[0].executions).toHaveLength(1)
    expect(first.tickets).toHaveLength(0)
    expect(second.tickets).toHaveLength(1)
    expect(first.scaleReports[0].sourceReport.reportante).toBe('Romina Rodríguez')
    expect(first.scaleReports[0].descripcion).toBe('El motor perdió potencia al salir de plataforma.')
    expect(first.news).toHaveLength(0)
    expect(second.scaleReports).toHaveLength(0)
    expect(second.news).toHaveLength(1)
  })

  it('genera PDF individual y general con páginas separadas por vehículo', () => {
    const data = groupVehicleReport(vehicles,rows)
    const one = createVehicleReportPdf(data.slice(0,1),'Aeropuerto de Córdoba')
    const all = createVehicleReportPdf(data,'Aeropuerto de Córdoba')
    expect(one.output()).toContain('%PDF-')
    expect(one.output()).toContain('Reportes de escala vinculados')
    expect(one.output()).toContain('El motor perdió potencia al salir de plataforma.')
    expect(all.internal.getNumberOfPages()).toBeGreaterThan(one.internal.getNumberOfPages())
    expect(vehicleReportFilename(data,'Aeropuerto de Córdoba')).toMatch(/^informe_flota_sede_aeropuerto_de_cordoba_\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})
