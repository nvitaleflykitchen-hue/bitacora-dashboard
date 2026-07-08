/**
 * PageHeader — encabezado de página unificado.
 *
 * Reemplaza el patrón repetido en cada vista:
 *   <div className="flex ..."><h1 className="font-title ...">Título</h1>...</div>
 *
 * Uso:
 *   <PageHeader title="Escalamientos" subtitle="Pendientes de gestión">
 *     <button className="btn-primary">Nuevo</button>
 *   </PageHeader>
 *
 * `children` se renderiza como acciones alineadas a la derecha.
 */
export default function PageHeader({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="page-header">
      <div style={{ minWidth: 0 }}>
        <h1 className="page-header__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {Icon ? <Icon size={18} style={{ color: 'var(--phosphor)', flexShrink: 0 }} /> : null}
          <span>{title}</span>
        </h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="page-header__actions">{children}</div> : null}
    </div>
  )
}
