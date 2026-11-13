import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import ThemeToggle from './ThemeToggle'
import { THEME_KEY, setTheme } from '../lib/theme'
afterEach(() => {cleanup(); localStorage.clear(); document.documentElement.removeAttribute('data-theme'); vi.restoreAllMocks()})
it('shares the theme between controls and persists the preference', () => {
  render(<><ThemeToggle/><ThemeToggle/></>)
  fireEvent.click(screen.getAllByRole('button',{name:'Modo claro'})[0])
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem(THEME_KEY)).toBe('light')
  expect(screen.getAllByRole('button',{name:'Modo oscuro'})).toHaveLength(2)
  fireEvent.click(screen.getAllByRole('button',{name:'Modo oscuro'})[1])
  expect(document.documentElement.dataset.theme).toBe('dark')
})
it('continues to work when storage is unavailable', () => {
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')})
  render(<ThemeToggle/>)
  fireEvent.click(screen.getByRole('button',{name:'Modo claro'}))
  expect(screen.getByRole('button',{name:'Modo oscuro'})).toBeInTheDocument()
})
it('updates mounted controls when another tab changes the theme', () => {
  render(<ThemeToggle/>)
  act(()=>window.dispatchEvent(new StorageEvent('storage',{key:THEME_KEY,newValue:'light'})))
  expect(screen.getByRole('button',{name:'Modo oscuro'})).toBeInTheDocument()
  act(()=>setTheme('dark'))
  expect(screen.getByRole('button',{name:'Modo claro'})).toBeInTheDocument()
})
