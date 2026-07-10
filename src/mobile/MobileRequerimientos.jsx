import { useState, useEffect, useCallback } from 'react'
import { getRequerimientos, updateRequerimiento, getSedes } from '../lib/queries'
import { useAuth } from '../lib/auth'
import { isQualityOnlyProfile } from '../lib/access'
import { ShoppingCart, ChevronDown, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function SedePill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.62rem',
        fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        background: active ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.05)',
        border: active ? '1px solid rgba(57,255,20,0.4)' : '1px solid rgba(255,255,255,0.08)',
        color: active ? 'var(--phosphor)' : 'var(--text-dim)',
      }}
    >
      {label}
    </button>
  )
}

import { REQ_ESTADO_COLOR as ESTADO_COLOR } from '../lib/estados'
import SkeletonTable from '../components/SkeletonTable'
import { toast } from '../lib/feedback'
import { mensajeError } from '../lib/errores'
import { generarReporteEficienciaCompras } from '../lib/comprasEficienciaPdf'

const URGENCIA_COLOR = { baja: '#39FF14', media: '#F59E0B', alta: '#FF2A2A' }

function RequerimientoCard({ r, canManage, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)

  const cambiarEstado = async (nuevoEstado) => {
    setSaving(true)
    try {
      await onUpdate(r.id, { estado: nuevoEstado })
    } finally {
      setSaving(false)
    }
  }

  const itemsCount = r.items ? (typeof r.items === 'string' ? JSON.parse(r.items).length : r.items.length) : 0

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 10, padding: '1rem', marginBottom: '0.75rem',
      borderLeft: `3px solid ${URGENCIA_COLOR[r.urgencia] || '#555'}`
    }}>
      <div className="flex justify-between items-start mb-2">
        <div style={{ flex: 1, marginRight: '0.5rem' }}>
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>
            Requerimiento #{r.id}
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
            {r.sedes?.nombre || 'Sede central'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: 4, background: `${ESTADO_COLOR[r.estado] || '#777'}22`, color: ESTADO_COLOR[r.estado] || '#999', fontWeight: 700 }}>
            {r.estado}
          </span>
          <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: 4, background: `${URGENCIA_COLOR[r.urgencia] || '#777'}22`, color: URGENCIA_COLOR[r.urgencia] || '#999', fontWeight: 700, textTransform: 'uppercase' }}>
            {r.urgencia}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
          {itemsCount} ítem{itemsCount !== 1 ? 's' : ''} solicitados
        </span>
        {r.enviado_at && (
          <span style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
            Enviado: {format(new Date(r.enviado_at), "d MMM", { locale: es })}
          </span>
        )}
      </div>

      <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 font-metric" style={{ color: 'var(--phosphor)', fontSize: '0.7rem', background: 'none', border: 'none' }}>
          {expanded ? 'Ocultar ítems' : 'Ver ítems'} <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3">
          {r.observaciones && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: 4, marginBottom: '0.75rem' }}>
              <strong>Nota:</strong> {r.observaciones}
            </p>
          )}

          {canManage && !['Cumplido', 'Rechazado'].includes(r.estado) && (
            <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
              <button disabled={saving} onClick={() => cambiarEstado('Cumplido')} className="btn-primary flex-1 py-2 text-xs" style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--phosphor)', border: '1px solid rgba(57,255,20,0.2)', padding: '0.4rem', borderRadius: 4 }}>
                {saving ? 'Guardando...' : 'Marcar Cumplido'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MobileRequerimientos() {
  const { allowedSedeIds, can, rol, perfil } = useAuth()
  const canManage = (can('compras', 'manage') || ['admin','editor','encargado'].includes(rol)) && !isQualityOnlyProfile(perfil)
  const [reqs, setReqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('activos')
  const [sedes, setSedes] = useState([])
  const [selectedSede, setSelectedSede] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getRequerimientos({ sedeIds: allowedSedeIds || undefined })
      .then(data => {
        const activos = data.filter(r => !['Cumplido', 'Rechazado'].includes(r.estado))
        const inactivos = data.filter(r => ['Cumplido', 'Rechazado'].includes(r.estado))
        setReqs([...activos, ...inactivos])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [allowedSedeIds])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    getSedes(allowedSedeIds || undefined).then(setSedes).catch(() => {})
  }, [allowedSedeIds])

  const handleUpdate = async (id, payload) => {
    await updateRequerimiento(id, payload)
    setReqs(prev => prev.map(r => r.id === id ? { ...r, ...payload } : r))
  }

  const filtrados = reqs.filter(r => {
    if (filtro === 'activos' && ['Cumplido', 'Rechazado'].includes(r.estado)) return false
    if (selectedSede && r.sede_id !== selectedSede.id) return false
    return true
  })

  return (
    <div className="mobile-scroll" style={{ padding: '1.25rem 1rem 1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
        <h1 style={{ color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700 }}>Compras</h1>

        <button
          title="Reporte de eficiencia PDF"
          onClick={async () => {
            try {
              toast('Generando reporte...')
              await generarReporteEficienciaCompras({})
              toast.ok('Reporte PDF descargado.')
            } catch (e) { toast.error('No se pudo generar el reporte: ' + mensajeError(e)) }
          }}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: 4, cursor: 'pointer', marginLeft: 'auto', marginRight: 8, display: 'flex' }}>
          <FileText size={16} />
        </button>
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--surface)', padding: '0.2rem', borderRadius: 20 }}>
          <button onClick={() => setFiltro('activos')} style={{ padding: '0.3rem 0.6rem', borderRadius: 16, fontSize: '0.65rem', fontWeight: 700, border: 'none', background: filtro === 'activos' ? 'rgba(57,255,20,0.15)' : 'transparent', color: filtro === 'activos' ? 'var(--phosphor)' : 'var(--text-dim)' }}>Activos</button>
          <button onClick={() => setFiltro('todos')} style={{ padding: '0.3rem 0.6rem', borderRadius: 16, fontSize: '0.65rem', fontWeight: 700, border: 'none', background: filtro === 'todos' ? 'rgba(57,255,20,0.15)' : 'transparent', color: filtro === 'todos' ? 'var(--phosphor)' : 'var(--text-dim)' }}>Todos</button>
        </div>
      </div>

      {/* Filtro de sede — solo si hay 2+ sedes */}
      {sedes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: '0.65rem', marginBottom: '0.25rem', flexShrink: 0 }}
          className="hide-scrollbar">
          <SedePill label="Todas" active={!selectedSede} onClick={() => setSelectedSede(null)} />
          {sedes.map(s => (
            <SedePill key={s.id} label={s.nombre} active={selectedSede?.id === s.id} onClick={() => setSelectedSede(s)} />
          ))}
        </div>
      )}

      <div style={{ flex: 1 }}>
        {loading ? (
          <SkeletonTable filas={6} columnas={2} />
        ) : filtrados.length === 0 ? (
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <ShoppingCart size={32} style={{ color: 'var(--phosphor)', margin: '0 auto 0.5rem', opacity: 0.8 }} />
            <p style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Sin requerimientos {filtro === 'activos' ? 'activos' : ''}{selectedSede ? ` en ${selectedSede.nombre}` : ''}</p>
          </div>
        ) : filtrados.map(r => (
          <RequerimientoCard key={r.id} r={r} canManage={canManage} onUpdate={handleUpdate} />
        ))}
      </div>
    </div>
  )
}
