import { useState, useEffect } from 'react'

// useState que persiste en localStorage — para filtros y preferencias de vista.
// Uso: const [filtro, setFiltro] = usePersistedState('mnt.filtroEstado', 'todos')
export default function usePersistedState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(`bd.${key}`)
      return raw !== null ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try { localStorage.setItem(`bd.${key}`, JSON.stringify(value)) } catch { /* storage lleno o bloqueado */ }
  }, [key, value])
  return [value, setValue]
}
