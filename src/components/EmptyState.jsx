// Estado vacío con estética de la app. Uso:
//   <EmptyState icono={Inbox} titulo="Sin tickets abiertos"
//     detalle="Todo en orden por acá." accion="Crear ticket" onAccion={...} />
export default function EmptyState({ icono: Icono, titulo, detalle, accion, onAccion }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 fade-in">
      {Icono && (
        <div style={{
          width: 44, height: 44, borderRadius: 4, display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: 12,
          background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.12)',
        }}>
          <Icono size={20} style={{ color: 'var(--phosphor)', opacity: 0.7 }} />
        </div>
      )}
      <p className="font-metric" style={{ color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600 }}>
        {titulo}
      </p>
      {detalle && (
        <p className="font-metric mt-1" style={{ color: 'var(--text-dim)', fontSize: '0.7rem', maxWidth: 320, lineHeight: 1.5 }}>
          {detalle}
        </p>
      )}
      {accion && onAccion && (
        <button onClick={onAccion} className="btn-primary mt-4" style={{ fontSize: '0.72rem' }}>
          {accion}
        </button>
      )}
    </div>
  )
}
