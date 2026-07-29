import { describe, expect, it } from 'vitest'
import { createGestionGeneralReportPdf, GESTION_REPORT_SECTIONS } from './gestionGeneralReportPdf'

const sections = GESTION_REPORT_SECTIONS.map(item => item.id)
const base = { sede_id: 1, sede_nombre: 'Sede Centro' }

function fixture() {
  return {
    operacion: [
      { ...base, estado_general:'Sin novedades', requiere_escalamiento:false },
      { ...base, estado_general:'Hay novedades', requiere_escalamiento:true },
    ],
    escalamientos: [{ ...base, estado:'Pendiente' }, { ...base, estado:'Resuelto' }],
    mantenimiento: [{ ...base, estado:'abierto', prioridad:'critica' }, { ...base, estado:'resuelto', prioridad:'media' }],
    flota: {
      activos: [{ ...base, vencimiento_seguro:'2025-01-01' }],
      novedades: [{ ...base, estado:'abierta' }],
    },
    compras: [{ ...base, estado:'Enviado', urgencia:'alta' }, { ...base, estado:'Cumplido', urgencia:'media' }],
    calidad: {
      nc: [{ ...base, estado:'En proceso' }],
      capa: [{ ...base, estado:'Pendiente' }],
      auditorias: [{ ...base, estado:'Finalizada' }],
    },
    gestion: [{ ...base, estado:'Pendiente' }, { ...base, estado:'Resuelto' }],
    rrhh: {
      personas: [{ id:'1', activo:true }],
      evaluaciones: [{ resultado_global:'Alto', puntaje_calculado:3.8 }],
      historial: [{ tipo:'apercibimiento' }],
    },
  }
}

describe('informe general de gestión', () => {
  it('genera un PDF multipágina con todos los puntos seleccionados', () => {
    const ctx = createGestionGeneralReportPdf({
      data: fixture(),
      sedes: [{ id:1, nombre:'Sede Centro' }],
      desde: '2026-07-01',
      hasta: '2026-07-31',
      sections,
    })
    expect(ctx.doc.internal.getNumberOfPages()).toBeGreaterThan(1)
    expect(ctx.doc.output('arraybuffer').byteLength).toBeGreaterThan(5000)
  })

  it('admite generar un resumen con un único punto', () => {
    const ctx = createGestionGeneralReportPdf({
      data: { compras: fixture().compras },
      sedes: [{ id:1, nombre:'Sede Centro' }],
      desde: '2026-07-01',
      hasta: '2026-07-31',
      sections: ['compras'],
    })
    expect(ctx.doc.internal.getNumberOfPages()).toBe(1)
    expect(ctx.doc.output('arraybuffer').byteLength).toBeGreaterThan(2000)
  })
})
