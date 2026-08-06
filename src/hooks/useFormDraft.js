import { useEffect, useRef, useState } from 'react'

const PREFIX = 'bd.formDraft.'
const SCHEMA_VERSION = 1
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const defaultMeaningful = data => Object.values(data || {}).some(item => item !== '' && item !== null && item !== false)

export function readFormDraft(key) {
  if (!key) return null
  try {
    const parsed = JSON.parse(localStorage.getItem(`${PREFIX}${key}`) || 'null')
    if (!parsed?.data || typeof parsed.data !== 'object') return null
    const savedTime = new Date(parsed.savedAt || 0).getTime()
    if (parsed.version !== SCHEMA_VERSION || !savedTime || Date.now() - savedTime > MAX_AGE_MS) {
      removeFormDraft(key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function removeFormDraft(key) {
  if (!key) return
  try { localStorage.removeItem(`${PREFIX}${key}`) } catch { /* almacenamiento bloqueado */ }
}

export default function useFormDraft({ key, value, setValue, onRestore, enabled = true, isMeaningful, delay = 500 }) {
  const [recovered, setRecovered] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const readyRef = useRef(false)
  const meaningfulRef = useRef(isMeaningful || defaultMeaningful)
  const restoreRef = useRef(onRestore)

  useEffect(() => {
    readyRef.current = false
    if (!enabled || !key) {
      setRecovered(false)
      setSavedAt(null)
      return
    }
    const draft = readFormDraft(key)
    if (draft && meaningfulRef.current(draft.data)) {
      if (restoreRef.current) restoreRef.current(draft.data)
      else setValue?.(current => ({ ...current, ...draft.data }))
      setRecovered(true)
      setSavedAt(draft.savedAt || null)
    }
    readyRef.current = true
  }, [enabled, key, setValue])

  useEffect(() => {
    if (!enabled || !key || !readyRef.current || !meaningfulRef.current(value)) return undefined
    const timer = setTimeout(() => {
      const nextSavedAt = new Date().toISOString()
      try {
        localStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ version:SCHEMA_VERSION, data:value, savedAt:nextSavedAt }))
        setSavedAt(nextSavedAt)
      } catch { /* almacenamiento lleno o bloqueado */ }
    }, delay)
    return () => clearTimeout(timer)
  }, [delay, enabled, key, value])

  const clearDraft = () => {
    removeFormDraft(key)
    setRecovered(false)
    setSavedAt(null)
  }

  return { recovered, savedAt, clearDraft }
}
