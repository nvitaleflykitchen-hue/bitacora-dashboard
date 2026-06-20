export default function WorkspaceTabs({ title, subtitle, tabs, activeTab, onTabChange, children }) {
  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      <header className="px-4 md:px-6 pt-4 md:pt-5" style={{ background:'var(--abyss)' }}>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>{title}</h1>
            {subtitle && <p className="font-metric text-xs mt-1" style={{ color:'var(--text-dim)' }}>{subtitle}</p>}
          </div>
        </div>
        <nav aria-label={`Secciones de ${title}`} className="flex gap-1 mt-4 overflow-x-auto pb-2">
          {tabs.map(tab => (
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
        </nav>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
