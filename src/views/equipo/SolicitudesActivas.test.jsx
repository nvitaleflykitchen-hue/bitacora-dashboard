import { describe, it, expect } from 'vitest'
import { openDays, candidatesForRequest } from './SolicitudesActivas'

describe('antigüedad de solicitudes', () => {
  it('usa días calendario de Argentina aun antes de medianoche UTC', () => {
    expect(openDays('2026-10-18', new Date('2026-10-19T02:59:00Z'))).toBe(0)
    expect(openDays('2026-10-18', new Date('2026-10-19T03:00:00Z'))).toBe(1)
  })
  it('no convierte fechas ausentes o inválidas en antigüedades', () => {
    expect(openDays(null)).toBeNull()
    expect(openDays('2026-02-30')).toBeNull()
    expect(openDays('2026-10-20', new Date('2026-10-19T12:00:00Z'))).toBe(-1)
  })
})
it('incluye vínculos secundarios sin duplicar al candidato principal', () => {
  const candidates = [{ id: 'a', solicitud_id: 'one' }, { id: 'b', solicitud_id: 'two' }, { id: 'c', solicitud_id: 'two' }]
  const links = new Map([['a', new Set(['one'])], ['b', new Set(['one'])]])
  expect(candidatesForRequest('one', candidates, links).map(c => c.id)).toEqual(['a', 'b'])
})

import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import SolicitudesActivas from './SolicitudesActivas'
afterEach(cleanup)
it('filtra solicitudes y abre el seguimiento exacto sin ofrecer edición al lector', () => {
  const onFollow = vi.fn()
  render(<SolicitudesActivas solicitudes={[
    { id: 'one', puesto: 'Cocinero', sede_id: 1, sede_nombre: 'Centro', urgencia: 'Alta', estado: 'entrevistas', fecha_apertura: '2026-10-01' },
    { id: 'two', puesto: 'Chofer', sede_id: 2, sede_nombre: 'Norte', urgencia: 'Baja', estado: 'borrador' },
  ]} candidatos={[]} linksByCandidate={new Map()} canManage={false} onFollow={onFollow} />)
  expect(screen.queryByText('Editar')).toBeNull()
  fireEvent.change(screen.getByLabelText('Filtrar sede'), { target: { value: '1' } })
  expect(screen.queryByText('Chofer')).toBeNull()
  fireEvent.click(screen.getByText('Ver seguimiento'))
  expect(onFollow).toHaveBeenCalledWith('one')
})
