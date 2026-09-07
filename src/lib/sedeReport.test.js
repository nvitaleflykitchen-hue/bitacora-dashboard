import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase', () => ({ db: vi.fn(), supabase: {} }))
import { construirInformeSede, leerPaginasInforme, resumenDocumental, validarRangoInforme } from './sedeReport'
import { crearInformeSedePDF } from './sedeReportRenderer'

export function fixtureInforme() {
  const sources = Object.fromEntries(['sede','registros','tickets','capas','ncs','personas','activos','modulos','vehiculoNovedades','docsSede','docsPersonal','evaluaciones','docsVehiculo','preventivos'].map(k => [k, { rows: [] }]))
  sources.sede.rows = [{ id: 1, nombre: 'Sede de prueba', dias_operacion: [1,2,3,4,5], activa: true }]
  return { sources, sedeId: 1, desde: '2026-08-31', hasta: '2026-09-06', now: new Date('2026-09-07T10:00:00') }
}
describe('informe de sede', () => {
  it('cuenta días únicos operativos y no duplica turnos', () => {
    const f = fixtureInforme()
    f.sources.registros.rows = [{ fecha_reporte: '2026-08-31', turno: 'mañana' }, { fecha_reporte: '2026-08-31', turno: 'tarde' }, { fecha_reporte: '2026-09-05' }]
    expect(construirInformeSede(f).summary[0].valor).toBe('20% (1/5)')
  })
  it('no declara incumplimiento histórico si la sede está pausada', () => {
    const f = fixtureInforme(); f.sources.sede.rows[0].en_pausa = true
    expect(construirInformeSede(f).summary[0].valor).toBe('Sin base calculable')
  })
  it('distingue errores de consulta de ausencia de registros', () => {
    const f = fixtureInforme(); f.sources.tickets.error = 'denied'
    const r = construirInformeSede(f)
    expect(r.summary.find(s => s.id === 'tickets').valor).toBe('No se pudo consultar')
    expect(r.sections.find(s => s.id === 'tickets').rows).toEqual([])
    expect(r.warnings).toHaveLength(1)
  })
  it('excluye no aplica e invalida documentos declarados vigentes pero vencidos', () => {
    const r = resumenDocumental([{ id: 1, nombre: 'Ana' }], [{ entity_id:'1', codigo:'a', estado:'no_aplica' }, { entity_id:'1', codigo:'b', estado:'vigente', fecha_vencimiento:'2026-01-01' }], [{ codigo:'a' },{ codigo:'b' },{ codigo:'c' }], '2026-09-07')
    expect(r).toMatchObject({ total:2, vigentes:0, noAplica:1, vencidos:1, faltantes:1 })
  })
  it('excluye evaluaciones restringidas y promedia una evaluación por persona', () => {
    const f = fixtureInforme()
    f.sources.personas.rows = [{ id:1, puntaje_promedio:4 }, { id:2, puntaje_promedio:null, evaluacion_propia:true }]
    f.sources.evaluaciones.rows = [{ persona_id:1, fecha_evaluacion:'2026-09-01', puntaje_calculado:2 }, { persona_id:1, fecha_evaluacion:'2026-09-03', puntaje_calculado:4 }]
    const s = construirInformeSede(f).summary.find(s => s.id === 'evaluaciones')
    expect(s.valor).toBe('100% (1/1)'); expect(s.detalle).toContain('4.00/5'); expect(s.detalle).toContain('1 restringidas')
  })
  it('mide avance de planes incluyendo acciones terminadas y separa NC cerradas', () => {
    const f = fixtureInforme()
    f.sources.capas.rows = [{ codigo:'A', auditoria_codigo:'PLAN-1', estado:'Completada' }, { codigo:'B', auditoria_codigo:'PLAN-1', estado:'Pendiente', fecha_limite:'2026-09-01' }]
    f.sources.ncs.rows = [{ id:1, estado:'Cerrada', vencimiento:'2020-01-01' }]
    const r = construirInformeSede(f)
    expect(r.summary.find(s => s.id === 'capas').detalle).toContain('50% (1/2)')
    expect(r.summary.find(s => s.id === 'ncs').valor).toBe('0 abiertas · 1 cerradas sin verificar')
    expect(r.sections.find(s => s.id === 'ncs').rows[0][3]).toBe('0')
  })
  it('pagina más de 500 registros y propaga errores de páginas posteriores', async () => {
    let calls = 0
    const query = () => ({ order: () => ({ range: () => { calls++; return Promise.resolve({ data: calls === 1 ? Array(500).fill({ id:1 }) : [{ id:2 }] }) } }) })
    expect(await leerPaginasInforme(query)).toHaveLength(501)
    await expect(leerPaginasInforme(() => ({ order: () => ({ range: () => Promise.resolve({ error: new Error('fail') }) }) }))).rejects.toThrow('fail')
  })
  it('rechaza fechas inválidas e intervalos invertidos', () => {
    expect(() => validarRangoInforme('2026-02-30','2026-03-01')).toThrow()
    expect(() => validarRangoInforme('2026-09-04','2026-09-01')).toThrow()
  })
  it('genera varias páginas sin perder el final de descripciones extensas', () => {
    const report = construirInformeSede(fixtureInforme())
    report.sections = [{ title:'Tickets', note:'Prueba de paginación', columns:['Ticket','Descripción'], rows:[['1', 'Descripción extensa '.repeat(1800) + 'FINAL_UNICO']] }]
    const doc = crearInformeSedePDF(report)
    expect(doc.internal.getNumberOfPages()).toBeGreaterThan(2)
    expect(doc.output()).toContain('FINAL_UNICO')
  })
})
