import { describe, expect, it, vi, beforeEach } from 'vitest'
import { auditEvolution, auditDelta, validateAuditDraft, saveFoodAudit } from './foodAudits'
import { db } from './supabase'
import { getAdjuntos, uploadAdjunto, addAdjuntoLink } from './adjuntos'
vi.mock('./supabase', () => ({ db:vi.fn() }))
vi.mock('./adjuntos', () => ({ getAdjuntos:vi.fn(), uploadAdjunto:vi.fn(), addAdjuntoLink:vi.fn() }))
const rows = [
  { id:'oct', sede_id:19, organismo_auditor:'Biolev', fecha_auditoria:'2026-10-17', porcentaje_cumplimiento:77.8, estado:'Finalizada' },
  { id:'may', sede_id:19, organismo_auditor:'Biolev', fecha_auditoria:'2026-05-29', porcentaje_cumplimiento:86.7, estado:'Finalizada' },
  { id:'jul', sede_id:19, organismo_auditor:'Biolev', fecha_auditoria:'2026-07-30', porcentaje_cumplimiento:76.6, estado:'Finalizada' },
]
describe('evolución de auditorías', () => {
  it('ordena Mendoza por fecha y conserva el total oficial y la variación', () => {
    const evolution = auditEvolution(rows,19,'Biolev')
    expect(evolution.map(r => r.score)).toEqual([86.7,76.6,77.8])
    expect(auditDelta(evolution)).toBe(1.2)
  })
  it('no mezcla sedes, organismos, años ni borradores', () => {
    const extra = [ { ...rows[0], sede_id:21 }, { ...rows[0], organismo_auditor:'Otro' }, { ...rows[0], estado:'Borrador' }, { ...rows[0], fecha_auditoria:'2025-10-17' } ]
    expect(auditEvolution([...rows,...extra],19,'Biolev','2026')).toHaveLength(3)
  })
  it('no transforma la ausencia de puntaje en cero', () => {
    expect(auditEvolution([{...rows[0],porcentaje_cumplimiento:null}],19,'Biolev')[0].score).toBeNull()
    expect(auditDelta([{score:null},{score:77.8}])).toBeNull()
  })
  it('rechaza puntajes vacíos/fuera de rango y sedes no autorizadas', () => {
    expect(() => validateAuditDraft(rows[0],[])).toThrow('autorizada')
    for (const score of ['',null,-1,101,'abc']) expect(() => validateAuditDraft({...rows[0],porcentaje_cumplimiento:score},[19])).toThrow('0 y 100')
    expect(() => validateAuditDraft({...rows[0],porcentaje_cumplimiento:0},[19])).not.toThrow()
  })
})
describe('recuperación de carga', () => {
  beforeEach(() => vi.resetAllMocks())
  it('reutiliza el PDF y la sede persistida al completar un borrador', async () => {
    const persisted = { ...rows[0], estado:'Borrador' }
    const query = { select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:persisted}),update:vi.fn().mockReturnThis(),single:vi.fn().mockResolvedValue({data:{id:'oct'}}) }
    db.mockReturnValue({from:()=>query})
    const pdf = { nombre:'audit.pdf',mime_type:'application/pdf',url:'https://example.org/a.pdf' }
    getAdjuntos.mockResolvedValueOnce([pdf]).mockResolvedValueOnce([pdf])
    await saveFoodAudit({draft:{...persisted,sede_id:21},userId:'admin',allowedIds:[19,21]})
    expect(uploadAdjunto).not.toHaveBeenCalled()
    expect(addAdjuntoLink).not.toHaveBeenCalled()
    expect(getAdjuntos).toHaveBeenLastCalledWith('sede_biblioteca',19)
    expect(query.update).toHaveBeenCalledWith({estado:'Finalizada'})
  })
  it('no publica un borrador si falla la carga del archivo', async () => {
    const query = { select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{...rows[0],estado:'Borrador'}}),update:vi.fn() }
    db.mockReturnValue({from:()=>query});getAdjuntos.mockResolvedValue([]);uploadAdjunto.mockRejectedValue(new Error('Sin conexión'))
    await expect(saveFoodAudit({draft:rows[0],file:{name:'a.pdf',size:10},userId:'admin',allowedIds:[19]})).rejects.toThrow('Sin conexión')
    expect(query.update).not.toHaveBeenCalled()
  })
})
