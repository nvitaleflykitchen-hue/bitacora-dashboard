import { useState, useEffect } from 'react'

const STORAGE_VERSION = 1

export function readPersistedState(key, initial, validate = () => true) {
  try {
    const raw = localStorage.getItem(`bd.${key}`)
    if (raw === null) return initial
    const parsed = JSON.parse(raw)
    const value = parsed?.__bdPersisted === STORAGE_VERSION ? parsed.value : parsed
    return validate(value) ? value : initial
  } catch {
    return initial
  }
}

// useState que persiste en localStorage — para filtros y preferencias de vista.
// Uso: const [filtro, setFiltro] = usePersistedState('mnt.filtroEstado', 'todos')
export default function usePersistedState(key, initial, options = {}) {
  const { validate = () => true } = options
  const [value, setValue] = useState(() => readPersistedState(key, initial, validate))
  useEffect(() => {
    try {
      localStorage.setItem(`bd.${key}`, JSON.stringify({ __bdPersisted:STORAGE_VERSION, value, updatedAt:new Date().toISOString() }))
    } catch { /* storage lleno o bloqueado */ }
  }, [key, value])
  return [value, setValue]
}
