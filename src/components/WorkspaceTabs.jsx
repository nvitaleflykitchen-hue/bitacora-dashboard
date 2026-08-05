import React from 'react'

export default function WorkspaceTabs({ title, subtitle, tabs, activeTab, onTabChange, children, rightSlot, maxPrimaryTabs = 5 }) {
  const primaryTabs = tabs.slice(0, maxPrimaryTabs)
  const secondaryTabs = tabs.slice(maxPrimaryTabs)
  const activeSecondary = secondaryTabs.some(tab => tab.id === activeTab) ? activeTab : ''

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <header className="px-4 md:px-6 pt-4 md:pt-5" style={{ background:'var(--abyss)' }}>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>{title}</h1>
            {subtitle && <p className="font-metric text-xs mt-1" style={{ color:'var(--text-dim)' }}>{subtitle}</p>}
          </div>
          {rightSlot && <div style={{ flexShrink:0 }}>{rightSlot}</div>}
        </div>
        <nav aria-label={`Secciones de ${title}`} className="flex gap-1 mt-4 overflow-x-auto pb-2">
          {primaryTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={activeTab === tab.id ? 'btn-primary' : 'btn-ghost'}
              style={{ flexShrink:0, fontSize:'0.65rem', padding:'0.4rem 0.7rem' }}
            >
              {tab.label}
            </button>
          ))}
          {secondaryTabs.length > 0 && (
            <label style={{ flexShrink:0, position:'relative' }}>
              <span className="sr-only">Más herramientas de {title}</span>
              <select aria-label={`Más herramientas de ${title}`} value={activeSecondary}
                onChange={event => event.target.value && onTabChange(event.target.value)}
                className={activeSecondary ? 'btn-primary' : 'btn-ghost'}
                style={{ fontSize:'0.65rem', padding:'0.4rem 1.8rem 0.4rem 0.7rem', cursor:'pointer' }}>
                <option value="">Más herramientas</option>
                {secondaryTabs.map(tab => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
              </select>
            </label>
          )}
        </nav>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  )
}
