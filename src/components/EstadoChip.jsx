// Chip de estado unificado. Usar junto con los mapas de src/lib/estados.js:
//   <EstadoChip estado={t.estado} mapa={TICKET_ESTADO_COLOR} />
export default function EstadoChip({ estado, mapa, label, size = '0.62rem' }) {
  const color = mapa?.[estado] || '#6B7280'
  return (
    <span style={{
      fontSize: size, fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: 4,
      background: `${color.startsWith('#') ? color + '22' : 'rgba(107,114,128,0.12)'}`,
      color, whiteSpace: 'nowrap',
    }}>
      {label || String(estado || '').replace(/_/g, ' ')}
    </span>
  )
}
