import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import usePersistedState from './usePersistedState'

describe('usePersistedState', () => {
  beforeEach(() => localStorage.clear())

  it('recupera una preferencia guardada', () => {
    localStorage.setItem('bd.flota.vista', JSON.stringify('historial'))
    const { result } = renderHook(() => usePersistedState('flota.vista', 'kanban'))
    expect(result.current[0]).toBe('historial')
  })

  it('persiste cambios de filtros', () => {
    const { result } = renderHook(() => usePersistedState('flota.prioridad', ''))
    act(() => result.current[1]('critica'))
    expect(JSON.parse(localStorage.getItem('bd.flota.prioridad')).value).toBe('critica')
  })

  it('descarta valores que ya no son válidos', () => {
    localStorage.setItem('bd.mobile.tab', JSON.stringify('admin'))
    const { result } = renderHook(() => usePersistedState('mobile.tab', 'home', { validate:value => ['home','tareas'].includes(value) }))
    expect(result.current[0]).toBe('home')
  })
})
