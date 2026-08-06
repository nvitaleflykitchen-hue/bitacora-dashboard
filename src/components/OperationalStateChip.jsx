import { operationalStateMeta } from '../lib/operationalStates'

export default function OperationalStateChip({ estado, showStage = false, size = '0.62rem' }) {
  const meta = operationalStateMeta(estado)
  const showRaw = showStage && meta.raw && meta.normalized !== meta.label.toLowerCase()
  return (
    <span
      className={`chip ${meta.chip}`}
      style={{ fontSize:size, whiteSpace:'nowrap' }}
      title={meta.raw && meta.raw !== meta.label ? `Estado del módulo: ${meta.raw}` : undefined}
    >
      {meta.key === 'unknown' ? (meta.raw || meta.label) : meta.label}
      {showRaw && <span aria-hidden="true" style={{ opacity:0.72 }}> · {meta.raw.replace(/_/g, ' ')}</span>}
    </span>
  )
}
