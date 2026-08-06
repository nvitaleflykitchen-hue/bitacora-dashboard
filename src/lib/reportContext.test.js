import { describe, expect, it } from 'vitest'
import { normalizeReportContext, reportContextDraftKey } from './reportContext'

describe('reportContext', () => {
  it('acepta solamente orígenes completos y conocidos', () => {
    expect(normalizeReportContext({ type:'activo', id:42, sedeId:7, label:'Horno' })).toMatchObject({ type:'activo', id:'42', sedeId:'7', label:'Horno' })
    expect(normalizeReportContext({ type:'desconocido', id:42, sedeId:7 })).toBeNull()
    expect(normalizeReportContext({ type:'persona', id:42 })).toBeNull()
  })

  it('separa borradores generales y contextuales', () => {
    const context = normalizeReportContext({ type:'vehiculo', id:'abc', sedeId:3 })
    expect(reportContextDraftKey(null)).toBe('general')
    expect(reportContextDraftKey(context)).toBe('vehiculo-abc-3')
  })
})
