import React, { useEffect, useRef, useState } from 'react'
import { Check, Ellipsis } from 'lucide-react'

export default function OverflowTabs({ primaryTabs, secondaryTabs, activeTab, onChange, ariaLabel = 'Secciones' }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const activeSecondary = secondaryTabs.find(tab => tab.id === activeTab)

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = event => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    const closeEscape = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [open])

  const selectTab = id => {
    onChange(id)
    setOpen(false)
  }

  return (
    <nav aria-label={ariaLabel} className="flex gap-0 items-stretch">
      {primaryTabs.map(tab => (
        <button key={tab.id} type="button" onClick={() => selectTab(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          className="font-metric px-4 py-1.5"
          style={{ fontSize:'0.6rem', letterSpacing:'0.08em', background:activeTab === tab.id ? 'rgba(57,255,20,0.1)' : 'transparent', color:activeTab === tab.id ? 'var(--phosphor)' : 'var(--text-dim)', borderBottom:activeTab === tab.id ? '2px solid var(--phosphor)' : '2px solid transparent' }}>
          {tab.label}
        </button>
      ))}
      {secondaryTabs.length > 0 && <div ref={menuRef} className="relative">
        <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="menu"
          aria-label={activeSecondary ? `Más herramientas. Activa: ${activeSecondary.label}` : 'Más herramientas'}
          className="font-metric px-4 py-1.5 flex items-center gap-1.5 h-full"
          style={{ fontSize:'0.6rem', letterSpacing:'0.08em', background:activeSecondary ? 'rgba(57,255,20,0.1)' : 'transparent', color:activeSecondary ? 'var(--phosphor)' : 'var(--text-dim)', borderBottom:activeSecondary ? '2px solid var(--phosphor)' : '2px solid transparent' }}>
          <Ellipsis size={15} aria-hidden="true" /> MÁS
          {activeSecondary && <span aria-hidden="true" style={{ width:5, height:5, borderRadius:'50%', background:'var(--phosphor)' }} />}
        </button>
        {open && <div role="menu" aria-label="Más herramientas" className="absolute left-0 mt-1 py-1"
          style={{ zIndex:40, minWidth:250, background:'var(--surface)', border:'1px solid var(--line)', boxShadow:'0 12px 32px rgba(0,0,0,.65)' }}>
          {secondaryTabs.map(tab => <button key={tab.id} type="button" role="menuitem" onClick={() => selectTab(tab.id)}
            className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left font-metric"
            style={{ fontSize:'0.65rem', color:activeTab === tab.id ? 'var(--phosphor)' : 'var(--text)', background:activeTab === tab.id ? 'var(--phosphor-dim)' : 'transparent' }}>
            <span>{tab.label}</span>
            {activeTab === tab.id && <Check size={13} aria-label="Sección activa" />}
          </button>)}
        </div>}
      </div>}
    </nav>
  )
}
