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
    expect(JSON.parse(localStorage.getItem('bd.flota.prioridad'))).toBe('critica')
  })
})

