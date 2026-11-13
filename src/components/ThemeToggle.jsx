import React, { useSyncExternalStore } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getTheme, setTheme, subscribeTheme } from '../lib/theme'

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)
  const light = theme === 'light'
  const label = light ? 'Modo oscuro' : 'Modo claro'
  const Icon = light ? Moon : Sun
  return <button type="button" className="btn-ghost theme-toggle" onClick={() => setTheme(light ? 'dark' : 'light')} aria-label={label} title={label}>
    <Icon size={16} aria-hidden="true" /><span>{label}</span>
  </button>
}
