import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ calls: [], rows: {}, payload: null }))
vi.mock('./supabase', () => {
  const from = (schema, table) => {
    const call = { schema, table, filters: [] }; mock.calls.push(call)
    const query = {
      select: vi.fn(() => query), order: vi.fn(() => query),
      eq: vi.fn((...args) => { call.filters.push(args); return query }),
      neq: vi.fn(() => query), not: vi.fn(() => query), in: vi.fn(() => query),
      or: vi.fn(value => { call.or = value; return query }),
      update: vi.fn(payload => { mock.payload = payload; return query }),
      range: vi.fn(() => query),
      then: (resolve, reject) => Promise.resolve({ data: mock.rows[table] || [], count: 1, error: null }).then(resolve, reject),
    }
    return query
  }
  return { db: () => ({ from: table => from('bitacora', table) }), supabase: { from: table => from('public', table) } }
})
import { getCorreoContext, getCorreos, reviewCorreo } from './correos'
beforeEach(() => { mock.calls = []; mock.rows = {}; mock.payload = null })
describe('Vínculo documental con activos', () => {
  it('carga el catálogo paginado y permite buscar por identificación, serie y sede', async () => {
    mock.rows.mnt_activos = [{ id: 'a1', codigo_interno: 'CAM-001', nombre: 'Cámara de frío', numero_serie: 'SER-9', sede: 'Planta Córdoba', marca: 'Marca', modelo: 'Modelo' }]
    const { destinations } = await getCorreoContext()
    expect(destinations.activos[0]).toMatchObject({ id: 'activo:a1', titulo: 'CAM-001 · Cámara de frío' })
    expect(destinations.activos[0].search).toContain('SER-9')
    expect(destinations.activos[0].search).toContain('Planta Córdoba')
    expect(mock.calls).toContainEqual(expect.objectContaining({ schema: 'public', table: 'mnt_activos', or: 'tipo.neq.VEHICULO,tipo.is.null' }))
  })
  it('guarda activo y personas y limpia el destino anterior con control de concurrencia', async () => {
    mock.rows.correos = [{ id: 'c1' }]
    await reviewCorreo({ id: 'c1', updated_at: 'version-1' }, 'activo:a1', 'vinculado', ['persona:p1'])
    expect(mock.payload).toMatchObject({ activo_id: 'a1', estado: 'vinculado', persona_ids: ['p1'], ticket_id: null, vehiculo_id: null, plan_id: null })
    expect(mock.calls[0].filters).toEqual([['id', 'c1'], ['updated_at', 'version-1']])
  })
  it('limpia el activo al archivar', async () => {
    mock.rows.correos = [{ id: 'c1' }]
    await reviewCorreo({ id: 'c1', updated_at: 'v1' }, null, 'ignorado')
    expect(mock.payload).toMatchObject({ activo_id: null, estado: 'ignorado', persona_ids: [] })
  })
  it('filtra los correos de la ficha por el activo', async () => {
    await getCorreos({ planId: 'activo:a1' })
    expect(mock.calls[0].filters).toContainEqual(['activo_id', 'a1'])
  })
  it('no confirma un guardado si la versión cambió o no hay permiso', async () => {
    await expect(reviewCorreo({ id: 'c1', updated_at: 'v1' }, 'activo:a1', 'vinculado')).rejects.toThrow('El correo cambió')
  })
})
