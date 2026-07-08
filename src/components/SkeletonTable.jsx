// Skeleton de carga para listas/tablas — reemplaza al spinner central.
export function SkeletonBlock({ w = '100%', h = 12, style }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: 2, ...style }} />
}

export default function SkeletonTable({ filas = 6, columnas = 4 }) {
  return (
    <div className="fade-in" style={{ padding: '0.5rem 0' }}>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: `repeat(${columnas}, 1fr)`, gap: '1rem',
          padding: '0.7rem 1rem', borderBottom: '1px solid var(--line-soft)',
          opacity: 1 - i * 0.12,
        }}>
          {Array.from({ length: columnas }).map((_, j) => (
            <SkeletonBlock key={j} w={`${55 + ((i * 7 + j * 13) % 40)}%`} />
          ))}
        </div>
      ))}
    </div>
  )
}
