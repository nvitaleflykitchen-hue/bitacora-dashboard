import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import useFormDraft, { readFormDraft, removeFormDraft } from './useFormDraft'

describe('useFormDraft', () => {
  beforeEach(() => localStorage.clear())

  it('recupera una carga guardada y permite descartarla', () => {
    localStorage.setItem('bd.formDraft.tarea-u1', JSON.stringify({ version:1, data:{ titulo:'Revisar horno' }, savedAt:new Date().toISOString() }))
    const { result } = renderHook(() => {
      const [form, setForm] = useState({ titulo:'', prioridad:'Media' })
      return { form, draft:useFormDraft({ key:'tarea-u1', value:form, setValue:setForm }) }
    })

    expect(result.current.form).toMatchObject({ titulo:'Revisar horno', prioridad:'Media' })
    expect(result.current.draft.recovered).toBe(true)
    act(() => result.current.draft.clearDraft())
    expect(readFormDraft('tarea-u1')).toBeNull()
  })

  it('guarda automáticamente sólo después de que existe contenido', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => {
      const [form, setForm] = useState({ descripcion:'' })
      return { form, setForm, draft:useFormDraft({ key:'ticket-u1', value:form, setValue:setForm, delay:100 }) }
    })
    expect(readFormDraft('ticket-u1')).toBeNull()
    act(() => result.current.setForm({ descripcion:'Pierde aceite' }))
    act(() => vi.advanceTimersByTime(110))
    expect(readFormDraft('ticket-u1')?.data.descripcion).toBe('Pierde aceite')
    removeFormDraft('ticket-u1')
    vi.useRealTimers()
  })

  it('descarta borradores antiguos o de otra versión', () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    localStorage.setItem('bd.formDraft.vencido', JSON.stringify({ version:1, data:{ titulo:'Viejo' }, savedAt:old }))
    localStorage.setItem('bd.formDraft.incompatible', JSON.stringify({ version:99, data:{ titulo:'Otro' }, savedAt:new Date().toISOString() }))

    expect(readFormDraft('vencido')).toBeNull()
    expect(readFormDraft('incompatible')).toBeNull()
  })
})
