import React, { useEffect, useRef, useState } from 'react'
import { EllipsisVertical } from 'lucide-react'

export default function ActionOverflowMenu({ items, label = 'Más acciones' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
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

  const activate = item => {
    if (item.disabled) return
    item.onClick?.()
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="btn-ghost flex items-center gap-1.5" onClick={() => setOpen(value => !value)}
        aria-expanded={open} aria-haspopup="menu">
        <EllipsisVertical size={14} aria-hidden="true" /> {label}
      </button>
      {open && <div role="menu" aria-label={label} className="absolute right-0 mt-1 py-1"
        style={{ zIndex:50, width:230, background:'var(--surface)', border:'1px solid var(--line)', boxShadow:'0 12px 32px rgba(0,0,0,.7)' }}>
        {items.map((item, index) => {
          const Icon = item.icon
          const style = {
            color:item.tone === 'danger' ? 'var(--alert)' : item.tone === 'warning' ? 'var(--warn)' : 'var(--text)',
            opacity:item.disabled ? .4 : 1,
            borderTop:item.separated ? '1px solid var(--line)' : undefined,
            cursor:item.disabled ? 'not-allowed' : 'pointer',
          }
          const content = <><span className="flex items-center gap-2">{Icon && <Icon size={14} aria-hidden="true" />}{item.label}</span>{item.hint && <span style={{fontSize:'.56rem',color:'var(--text-dim)'}}>{item.hint}</span>}</>
          if (item.href && !item.disabled) return <a key={item.id || index} role="menuitem" href={item.href} target={item.target} rel={item.target ? 'noreferrer' : undefined}
            onClick={() => setOpen(false)} className="w-full px-3 py-2 flex items-center justify-between text-left font-metric" style={{...style,fontSize:'.66rem',textDecoration:'none'}}>{content}</a>
          return <button key={item.id || index} type="button" role="menuitem" disabled={item.disabled} onClick={() => activate(item)}
            className="w-full px-3 py-2 flex items-center justify-between text-left font-metric" style={{...style,fontSize:'.66rem',background:'transparent'}}>{content}</button>
        })}
      </div>}
    </div>
  )
}
