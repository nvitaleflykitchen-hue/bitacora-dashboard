import { useState, useEffect } from 'react'
import {
  getSedes, createRegistro, createRequerimiento,
  getActivos, getPersonasBySede, createVehiculoNovedadConTicket, createPersonaNovedad,
  createModuloNovedadConEscalamiento,
  CATEGORIAS_NOVEDAD_PERSONA,
  getVuelosDelDia, createVueloNovedad, TIPOS_NOVEDAD_VUELO,
} from '../lib/queries'
import { useAuth } from '../lib/auth'
import { db } from '../lib/supabase'
import { getOperationalOrigin, REPORT_ACTIVITY_LEVELS, REPORT_TURNS } from '../lib/operationalDomains'
import { uploadAdjunto } from '../lib/adjuntos'
import { ChevronLeft, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, Plus, X, Paperclip, FileText, Clock, Truck, User, Plane } from 'lucide-react'
import { format } from 'date-fns'

const ESTADOS_GENERALES = [
  { val: 'Sin novedades',        color: '#39FF14', bg: 'rgba(57,255,20,0.12)',  label: 'Sin novedades' },
  { val: 'Hay novedades',        color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Hay novedades' },
  { val: 'Operación condicionada', color: '#FF2A2A', bg: 'rgba(255,42,42,0.12)', label: 'Operación condicionada' },
]
const MOD_ESTADOS = ['Sin novedad', 'Hay novedades', 'Crítico']
const MOD_COLORS  = { 'Sin novedad': '#39FF14', 'Hay novedades': '#F59E0B', 'Crítico': '#FF2A2A' }

const MODULOS = [
  { key: 'a', label: 'Producción / Servicio del turno', ejemplo: 'Ej: faltó personal en el turno, se sirvió 15 min tarde' },
  { key: 'b', label: 'Cadena de frío y conservación', ejemplo: 'Ej: heladera de carnes a 9°C, ya se avisó a mantenimiento' },
  { key: 'c', label: 'Recepción / Abastecimiento', ejemplo: 'Ej: el proveedor de verdura no llegó, falta tomate' },
  { key: 'd', label: 'Stock crítico', ejemplo: 'Ej: quedan 2 días de aceite, pedir reposición urgente' },
  { key: 'e', label: 'Equipos / Mantenimiento', ejemplo: 'Ej: el horno industrial no calienta, ya se generó ticket' },
  { key: 'f', label: 'Higiene / BPM', ejemplo: 'Ej: falta jabón en el lavamanos de cocina' },
  { key: 'g', label: 'Personal / Dotación', ejemplo: 'Ej: ausencia sin aviso de un cocinero, se cubrió con suplente' },
  { key: 'h', label: 'Cliente / Usuario / Incidentes', ejemplo: 'Ej: reclamo de un comensal por demora, ya resuelto' },
]

const TIPOS_ESCALAMIENTO = [
  { val: 'Compras',       color: '#50b4ff' },
  { val: 'Mantenimiento', color: '#F59E0B' },
  { val: 'RRHH',          color: '#a78bfa' },
  { val: 'Logística',     color: '#34d399' },
  { val: 'Calidad',       color: '#fb923c' },
  { val: 'Coordinación',  color: '#f472b6' },
  { val: 'Dirección',     color: '#FF2A2A' },
  { val: 'Otro',          color: '#9ca3af' },
]

const TIPOS_NOVEDAD_VEHICULO = ['Avería', 'Accidente/Choque', 'Documentación', 'Otro']
const COLOR_VEHICULO = '#22d3ee'
const COLOR_PERSONA  = '#a78bfa'
const COLOR_VUELO    = '#fbbf24'
const ESTADO_VUELO_DEFAULT = { tipo: '', descripcion: '' }

// ── helpers ──────────────────────────────────────────────────────────────────

function Chip({ label, active, color, bg, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.45rem 0.85rem', borderRadius: 20, fontSize: '0.78rem',
      fontWeight: active ? 700 : 400, cursor: 'pointer',
      background: active ? bg : 'var(--surface)',
      border: active ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.08)',
      color: active ? color : 'var(--text-dim)', transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      color: 'var(--text-dim)', fontSize: '0.62rem',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      marginBottom: '0.5rem',
    }}>{children}</p>
  )
}

function RacionCard({ title, fields }) {
  return (
    <div style={{
      padding: '0.75rem', borderRadius: 10,
      background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <p style={{
        color: 'var(--text)', fontSize: '0.72rem', fontWeight: 700,
        marginBottom: '0.6rem', letterSpacing: '0.03em',
      }}>
        {title}
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))`,
        gap: '0.45rem',
      }}>
        {fields.map(({ label, val, set }) => (
          <label key={label} style={{ minWidth: 0 }}>
            <span style={{
              display: 'block', fontSize: '0.55rem', color: 'var(--text-dim)',
              marginBottom: '0.3rem', textTransform: 'uppercase',
              letterSpacing: '0.04em', textAlign: 'center',
            }}>
              {label}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={val}
              onChange={e => set(e.target.value)}
              placeholder="0"
              style={{
                width: '100%', padding: '0.65rem 0.3rem', borderRadius: 8,
                boxSizing: 'border-box', background: 'var(--bg)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text)', fontSize: '1rem', textAlign: 'center',
              }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Módulo card ───────────────────────────────────────────────────────────────
// Cada módulo (a-h) puede tener varias novedades (items). Cada item tiene su
// propia severidad, opción de "privada" y un botón "Escalar" que revela los
// chips de TIPOS_ESCALAMIENTO — esto reemplaza la vieja sección única de
// "Escalamientos" al final del formulario.

function ModuloNovedadCard({ item, index, ejemplo, onChange, onRemove }) {
  const color = MOD_COLORS[item.severidad] || MOD_COLORS['Hay novedades']
  const tipoSel = TIPOS_ESCALAMIENTO.find(t => t.val === item.tipo_escalamiento)
  const colorEscalar = tipoSel?.color || '#FF2A2A'

  return (
    <div style={{
      borderRadius: 8, marginBottom: '0.6rem',
      background: `${color}0c`,
      border: `1.5px solid ${color}44`,
      padding: '0.85rem 0.9rem',
    }}>
      {/* Header con número y remove */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Novedad #{index + 1}
        </span>
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', padding: '0.1rem', display: 'flex',
        }}>
          <X size={14} />
        </button>
      </div>

      {/* Severidad */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
        {MOD_ESTADOS.filter(e => e !== 'Sin novedad').map(e => (
          <Chip key={e} label={e} active={item.severidad === e}
            color={MOD_COLORS[e]} bg={`${MOD_COLORS[e]}22`}
            onClick={() => onChange({ ...item, severidad: e })} />
        ))}
      </div>

      {/* Descripción */}
      <textarea
        value={item.descripcion}
        onChange={e => onChange({ ...item, descripcion: e.target.value })}
        rows={2}
        placeholder={ejemplo || 'Describí la novedad...'}
        style={{
          width: '100%', padding: '0.65rem 0.75rem', borderRadius: 6, resize: 'none',
          background: 'var(--surface)', border: `1px solid ${color}33`,
          color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', boxSizing: 'border-box',
          marginBottom: '0.55rem',
        }}
      />

      {/* Privada */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!item.privada} onChange={e => onChange({ ...item, privada: e.target.checked })}
          style={{ accentColor: '#F59E0B' }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Marcar como privada (oculta para el próximo turno)</span>
      </label>

      {/* Escalar */}
      <button onClick={() => onChange({ ...item, escalar: !item.escalar })} style={{
        display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: 'pointer',
        background: item.escalar ? 'rgba(255,42,42,0.12)' : 'var(--surface)',
        border: item.escalar ? '1.5px solid #FF2A2A' : '1.5px solid rgba(255,255,255,0.08)',
        color: item.escalar ? '#FF2A2A' : 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 700,
      }}>
        🚩 {item.escalar ? 'Escalado' : 'Escalar'}
      </button>

      {item.escalar && (
        <div style={{ marginTop: '0.6rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginBottom: '0.4rem' }}>
            ¿A qué área corresponde?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {TIPOS_ESCALAMIENTO.map(t => (
              <button key={t.val} onClick={() => onChange({ ...item, tipo_escalamiento: t.val })} style={{
                padding: '0.35rem 0.7rem', borderRadius: 20, fontSize: '0.72rem',
                fontWeight: item.tipo_escalamiento === t.val ? 700 : 400, cursor: 'pointer',
                background: item.tipo_escalamiento === t.val ? `${t.color}22` : 'var(--surface)',
                border: item.tipo_escalamiento === t.val ? `1.5px solid ${t.color}` : '1.5px solid rgba(255,255,255,0.08)',
                color: item.tipo_escalamiento === t.val ? t.color : 'var(--text-dim)', transition: 'all 0.12s',
              }}>{t.val}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ModuloCard({ mod, items, ejemplo, onAgregar, onActualizar, onQuitar }) {
  const [open, setOpen] = useState(false)
  const tieneNovedad = items.length > 0
  const peorSeveridad = items.some(it => it.severidad === 'Crítico') ? 'Crítico' : (tieneNovedad ? 'Hay novedades' : 'Sin novedad')
  const color = MOD_COLORS[peorSeveridad] || 'var(--text-dim)'

  return (
    <div style={{
      borderRadius: 8, marginBottom: '0.5rem',
      background: 'var(--surface)',
      border: tieneNovedad ? `1.5px solid ${color}44` : '1.5px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            width: 22, height: 22, borderRadius: 4, fontSize: '0.65rem', fontWeight: 800,
            background: tieneNovedad ? `${color}22` : 'rgba(255,255,255,0.05)',
            color: tieneNovedad ? color : 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{mod.key.toUpperCase()}</span>
          <span style={{ color: 'var(--text)', fontSize: '0.85rem', textAlign: 'left' }}>{mod.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          {tieneNovedad ? (
            <span style={{ fontSize: '0.6rem', color, fontWeight: 700 }}>
              {items.length} {peorSeveridad === 'Crítico' ? '⚠' : '!'}
            </span>
          ) : (
            <span style={{ fontSize: '0.6rem', color, fontWeight: 700 }}>OK</span>
          )}
          {open ? <ChevronUp size={14} color="var(--text-dim)" /> : <ChevronDown size={14} color="var(--text-dim)" />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 1rem 0.9rem' }}>
          {items.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.65rem' }}>
              Sin novedades en este módulo.
            </p>
          ) : (
            items.map((item, i) => (
              <ModuloNovedadCard key={i} item={item} index={i} ejemplo={ejemplo}
                onChange={val => onActualizar(i, val)}
                onRemove={() => onQuitar(i)} />
            ))
          )}
          <button onClick={onAgregar} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            padding: '0.4rem 0.8rem', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 700,
          }}>
            <Plus size={12} /> Agregar novedad
          </button>
        </div>
      )}
    </div>
  )
}

// ── Vehículo novedad card ─────────────────────────────────────────────────────

function VehiculoNovedadCard({ item, index, vehiculos, onChange, onRemove, hideCrearTicket }) {
  const color = COLOR_VEHICULO
  const tipoSel = TIPOS_ESCALAMIENTO.find(t => t.val === item.tipo_escalamiento)
  const colorEscalar = tipoSel?.color || '#FF2A2A'
  return (
    <div style={{
      borderRadius: 8, marginBottom: '0.6rem',
      background: 'rgba(34,211,238,0.05)',
      border: `1.5px solid ${color}44`,
      padding: '0.85rem 0.9rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Vehículo #{index + 1}
        </span>
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', padding: '0.1rem', display: 'flex',
        }}>
          <X size={14} />
        </button>
      </div>

      <select
        value={item.activo_id}
        onChange={e => {
          const v = vehiculos.find(x => String(x.id) === e.target.value)
          onChange({ ...item, activo_id: e.target.value, activo_nombre: v?.nombre || '' })
        }}
        style={{
          width: '100%', padding: '0.65rem 0.75rem', borderRadius: 6, marginBottom: '0.6rem', boxSizing: 'border-box',
          background: 'var(--surface)', border: `1px solid ${color}33`,
          color: 'var(--text)', fontSize: '0.85rem', appearance: 'none',
        }}>
        <option value="">— Elegí el vehículo —</option>
        {vehiculos.map(v => (
          <option key={v.id} value={v.id}>{v.nombre}{v.dominio ? ` (${v.dominio})` : ''}</option>
        ))}
      </select>
      {vehiculos.length === 0 && (
        <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '-0.4rem', marginBottom: '0.6rem' }}>
          No hay vehículos asignados a esta sede.
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
        {TIPOS_NOVEDAD_VEHICULO.map(t => (
          <button key={t} onClick={() => onChange({ ...item, tipo: t })} style={{
            padding: '0.35rem 0.7rem', borderRadius: 20, fontSize: '0.72rem',
            fontWeight: item.tipo === t ? 700 : 400, cursor: 'pointer',
            background: item.tipo === t ? `${color}22` : 'var(--surface)',
            border: item.tipo === t ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.08)',
            color: item.tipo === t ? color : 'var(--text-dim)', transition: 'all 0.12s',
          }}>{t}</button>
        ))}
      </div>

      <textarea
        value={item.descripcion}
        onChange={e => onChange({ ...item, descripcion: e.target.value })}
        rows={2}
        placeholder="Describí la novedad del vehículo..."
        style={{
          width: '100%', padding: '0.65rem 0.75rem', borderRadius: 6, resize: 'none',
          background: 'var(--surface)', border: `1px solid ${color}33`,
          color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.55rem',
        }}
      />

      {!hideCrearTicket && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={item.crearTicket}
            onChange={e => onChange({ ...item, crearTicket: e.target.checked })}
            style={{ accentColor: color }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Crear ticket automático en Mantenimiento de Flota</span>
        </label>
      )}

      {/* Escalar */}
      <button onClick={() => onChange({ ...item, escalar: !item.escalar })} style={{
        display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', borderRadius: 6, cursor: 'pointer',
        background: item.escalar ? 'rgba(255,42,42,0.12)' : 'var(--surface)',
        border: item.escalar ? '1.5px solid #FF2A2A' : '1.5px solid rgba(255,255,255,0.08)',
        color: item.escalar ? '#FF2A2A' : 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 700,
      }}>
        🚩 {item.escalar ? 'Escalado' : 'Escalar'}
      </button>

      {item.escalar && (
        <div style={{ marginTop: '0.6rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', marginBottom: '0.4rem' }}>
            ¿A qué área corresponde?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {TIPOS_ESCALAMIENTO.map(t => (
              <button key={t.val} onClick={() => onChange({ ...item, tipo_escalamiento: t.val })} style={{
                padding: '0.35rem 0.7rem', borderRadius: 20, fontSize: '0.72rem',
                fontWeight: item.tipo_escalamiento === t.val ? 700 : 400, cursor: 'pointer',
                background: item.tipo_escalamiento === t.val ? `${t.color}22` : 'var(--surface)',
                border: item.tipo_escalamiento === t.val ? `1.5px solid ${t.color}` : '1.5px solid rgba(255,255,255,0.08)',
                color: item.tipo_escalamiento === t.val ? t.color : 'var(--text-dim)', transition: 'all 0.12s',
              }}>{t.val}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Persona novedad card ──────────────────────────────────────────────────────

function PersonaNovedadCard({ item, index, personas, onChange, onRemove }) {
  const color = COLOR_PERSONA
  return (
    <div style={{
      borderRadius: 8, marginBottom: '0.6rem',
      background: 'rgba(167,139,250,0.05)',
      border: `1.5px solid ${color}44`,
      padding: '0.85rem 0.9rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Persona #{index + 1}
        </span>
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', padding: '0.1rem', display: 'flex',
        }}>
          <X size={14} />
        </button>
      </div>

      <select
        value={item.persona_id}
        onChange={e => {
          const p = personas.find(x => String(x.id) === e.target.value)
          onChange({ ...item, persona_id: e.target.value, persona_nombre: p ? `${p.nombre} ${p.apellido || ''}`.trim() : '' })
        }}
        style={{
          width: '100%', padding: '0.65rem 0.75rem', borderRadius: 6, marginBottom: '0.6rem', boxSizing: 'border-box',
          background: 'var(--surface)', border: `1px solid ${color}33`,
          color: 'var(--text)', fontSize: '0.85rem', appearance: 'none',
        }}>
        <option value="">— Elegí la persona —</option>
        {personas.map(p => (
          <option key={p.id} value={p.id}>{p.nombre} {p.apellido || ''}{p.puesto ? ` — ${p.puesto}` : ''}</option>
        ))}
      </select>
      {personas.length === 0 && (
        <p style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '-0.4rem', marginBottom: '0.6rem' }}>
          No hay personal activo asignado a esta sede.
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
        {CATEGORIAS_NOVEDAD_PERSONA.map(c => (
          <button key={c} onClick={() => onChange({ ...item, categoria: c })} style={{
            padding: '0.35rem 0.7rem', borderRadius: 20, fontSize: '0.72rem',
            fontWeight: item.categoria === c ? 700 : 400, cursor: 'pointer',
            background: item.categoria === c ? `${color}22` : 'var(--surface)',
            border: item.categoria === c ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.08)',
            color: item.categoria === c ? color : 'var(--text-dim)', transition: 'all 0.12s',
          }}>{c}</button>
        ))}
      </div>

      <textarea
        value={item.descripcion}
        onChange={e => onChange({ ...item, descripcion: e.target.value })}
        rows={2}
        placeholder="Describí la novedad de personal..."
        style={{
          width: '100%', padding: '0.65rem 0.75rem', borderRadius: 6, resize: 'none',
          background: 'var(--surface)', border: `1px solid ${color}33`,
          color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── Vuelo del día (plantilla) — chip de estado + descripción opcional ────────

function VueloDelDiaCard({ vuelo, estado, onChange }) {
  const color = COLOR_VUELO
  const esOk = estado.tipo === 'OK'
  const esNovedadReal = !!estado.tipo && !esOk
  return (
    <div style={{
      borderRadius: 8, marginBottom: '0.6rem',
      background: esNovedadReal ? 'rgba(251,191,36,0.06)' : esOk ? 'rgba(57,255,20,0.05)' : 'var(--surface)',
      border: esNovedadReal ? `1.5px solid ${color}55` : esOk ? '1.5px solid rgba(57,255,20,0.35)' : '1px solid rgba(255,255,255,0.08)',
      padding: '0.7rem 0.9rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
          {vuelo.vuelo_codigo}{vuelo.destino ? ` → ${vuelo.destino}` : ''}
        </span>
        {vuelo.aerolinea && <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{vuelo.aerolinea}</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: esNovedadReal ? '0.6rem' : 0 }}>
        {TIPOS_NOVEDAD_VUELO.map(t => (
          <button key={t} onClick={() => onChange({ tipo: t, descripcion: t === 'OK' ? '' : estado.descripcion })} style={{
            padding: '0.3rem 0.65rem', borderRadius: 20, fontSize: '0.7rem',
            fontWeight: estado.tipo === t ? 700 : 400, cursor: 'pointer',
            background: estado.tipo === t ? (t === 'OK' ? 'rgba(57,255,20,0.15)' : `${color}22`) : 'var(--surface)',
            border: estado.tipo === t ? `1.5px solid ${t === 'OK' ? '#39FF14' : color}` : '1.5px solid rgba(255,255,255,0.08)',
            color: estado.tipo === t ? (t === 'OK' ? '#39FF14' : color) : 'var(--text-dim)', transition: 'all 0.12s',
          }}>{t}</button>
        ))}
      </div>

      {esNovedadReal && (
        <textarea
          value={estado.descripcion}
          onChange={e => onChange({ ...estado, descripcion: e.target.value })}
          rows={2}
          placeholder={`Describí la novedad del vuelo ${vuelo.vuelo_codigo}...`}
          style={{
            width: '100%', padding: '0.6rem 0.7rem', borderRadius: 6, resize: 'none',
            background: 'var(--surface)', border: `1px solid ${color}33`,
            color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  )
}

// ── Vuelo no listado (ad-hoc, no estaba en la plantilla del día) ─────────────

function VueloAdHocCard({ item, index, onChange, onRemove }) {
  const color = COLOR_VUELO
  return (
    <div style={{
      borderRadius: 8, marginBottom: '0.6rem',
      background: 'rgba(251,191,36,0.05)',
      border: `1.5px solid ${color}44`,
      padding: '0.85rem 0.9rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Vuelo no listado #{index + 1}
        </span>
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', padding: '0.1rem', display: 'flex',
        }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <input
          value={item.vuelo_codigo}
          onChange={e => onChange({ ...item, vuelo_codigo: e.target.value.toUpperCase() })}
          placeholder="Código (ej: AR1234)"
          style={{
            padding: '0.6rem 0.7rem', borderRadius: 6, boxSizing: 'border-box',
            background: 'var(--surface)', border: `1px solid ${color}33`,
            color: 'var(--text)', fontSize: '0.82rem',
          }}
        />
        <input
          value={item.destino}
          onChange={e => onChange({ ...item, destino: e.target.value.toUpperCase() })}
          placeholder="Destino"
          style={{
            padding: '0.6rem 0.7rem', borderRadius: 6, boxSizing: 'border-box',
            background: 'var(--surface)', border: `1px solid ${color}33`,
            color: 'var(--text)', fontSize: '0.82rem',
          }}
        />
      </div>

      <input
        value={item.aerolinea}
        onChange={e => onChange({ ...item, aerolinea: e.target.value })}
        placeholder="Aerolínea (opcional)"
        style={{
          width: '100%', padding: '0.6rem 0.7rem', borderRadius: 6, marginBottom: '0.6rem', boxSizing: 'border-box',
          background: 'var(--surface)', border: `1px solid ${color}33`,
          color: 'var(--text)', fontSize: '0.82rem',
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
        {TIPOS_NOVEDAD_VUELO.map(t => (
          <button key={t} onClick={() => onChange({ ...item, tipo: t })} style={{
            padding: '0.35rem 0.7rem', borderRadius: 20, fontSize: '0.72rem',
            fontWeight: item.tipo === t ? 700 : 400, cursor: 'pointer',
            background: item.tipo === t ? `${color}22` : 'var(--surface)',
            border: item.tipo === t ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.08)',
            color: item.tipo === t ? color : 'var(--text-dim)', transition: 'all 0.12s',
          }}>{t}</button>
        ))}
      </div>

      <textarea
        value={item.descripcion}
        onChange={e => onChange({ ...item, descripcion: e.target.value })}
        rows={2}
        placeholder="Describí la novedad del vuelo..."
        style={{
          width: '100%', padding: '0.65rem 0.75rem', borderRadius: 6, resize: 'none',
          background: 'var(--surface)', border: `1px solid ${color}33`,
          color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── Archivo adjunto (staged, antes de enviar) ─────────────────────────────────

function ArchivoStagedItem({ item, onRemove }) {
  const isImage = item.file.type.startsWith('image/')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.6rem',
      borderRadius: 8, background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)',
      marginBottom: '0.4rem',
    }}>
      {isImage ? (
        <img src={item.preview} alt={item.file.name}
          style={{ width: 38, height: 38, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 38, height: 38, borderRadius: 5, background: 'rgba(167,139,250,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <FileText size={16} style={{ color: '#A78BFA' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          color: 'var(--text)', fontSize: '0.78rem', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.file.name}</p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.65rem', margin: 0 }}>
          {(item.file.size / 1024).toFixed(0)} KB
        </p>
      </div>
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', color: 'rgba(255,80,80,0.7)',
        padding: '0.2rem', flexShrink: 0, cursor: 'pointer', display: 'flex',
      }}>
        <X size={16} />
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MobileReporte({ onBack, onSuccess }) {
  const { perfil, rol, allowedSedeIds } = useAuth()
  const esOperario = rol === 'operario' // acotado a bitácora + checklist: sin tickets ni compras
  const [sedes,    setSedes]    = useState([])
  const [sedeId,   setSedeId]   = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [enviado,      setEnviado]      = useState(false)
  const [creadoId,     setCreadoId]     = useState(null)
  const [escCompras,   setEscCompras]   = useState([])   // escalamientos de tipo Compras post-submit
  const [reqForm,      setReqForm]      = useState(null) // null | { descripcion, sede_id, sede_nombre }
  const [reqLoading,   setReqLoading]   = useState(false)
  const [reqOk,        setReqOk]        = useState(false)
  const [novedadesAnteriores, setNovedadesAnteriores] = useState(null)
  const [vuelosAnteriores, setVuelosAnteriores] = useState([])

  // Campos
  const [turno,          setTurno]          = useState('')
  const [nivelActividad, setNivelActividad] = useState('Normal')
  const [estadoGeneral,  setEstadoGeneral]  = useState('Sin novedades')
  // Cada módulo (a-h) tiene una lista de novedades ("items"), cada una con su
  // propia severidad, opción de privacidad y de escalamiento — reemplaza el
  // viejo modelo de un único estado/detalle por módulo + sección de
  // Escalamientos aparte.
  const [modulos, setModulos] = useState(() =>
    Object.fromEntries(MODULOS.map(m => [m.key, { items: [] }]))
  )
  const [escalamientosCreados, setEscalamientosCreados] = useState(0)

  // Vehículos asignados a la sede + novedades cargadas: array de { activo_id, activo_nombre, tipo, descripcion, crearTicket }
  const [vehiculosSede,     setVehiculosSede]     = useState([])
  const [vehiculoNovedades, setVehiculoNovedades] = useState([])
  const [ticketsFlotaCreados, setTicketsFlotaCreados] = useState(0)

  // Personal asignado a la sede + novedades cargadas: array de { persona_id, persona_nombre, categoria, descripcion }
  const [personasSede,     setPersonasSede]     = useState([])
  const [personaNovedades, setPersonaNovedades] = useState([])

  // Vuelos del día (solo sedes tipo Aeropuerto): plantilla del día de hoy + estado por vuelo,
  // más vuelos no listados que se agregan a mano (ad-hoc).
  const [vuelosDelDia, setVuelosDelDia] = useState([])
  const [vueloEstados, setVueloEstados] = useState({}) // { [vuelo_programado_id]: { tipo, descripcion } }
  const [vuelosAdHoc,  setVuelosAdHoc]  = useState([])

  // Raciones (solo Comedores)
  const [op1Prod,      setOp1Prod]      = useState('')
  const [op1Serv,      setOp1Serv]      = useState('')
  const [op1Sobrante,  setOp1Sobrante]  = useState('')
  const [op2Prod,      setOp2Prod]      = useState('')
  const [op2Serv,      setOp2Serv]      = useState('')
  const [op2Sobrante,  setOp2Sobrante]  = useState('')
  const [vegProd,      setVegProd]      = useState('')
  const [vegServ,      setVegServ]      = useState('')
  const [vegSobrante,  setVegSobrante]  = useState('')
  const [ensaladaProd,     setEnsaladaProd]     = useState('')
  const [ensaladaSobrante, setEnsaladaSobrante] = useState('')
  const [postreProd,       setPostreProd]       = useState('')
  const [postreSobrante,   setPostreSobrante]   = useState('')

  // Adjuntos (fotos/documentos) — se cargan en el form y se suben recién al enviar
  const [archivos, setArchivos] = useState([]) // [{ id, file, preview }]
  const [adjuntosErrores, setAdjuntosErrores] = useState(0)

  // Cargar sedes
  useEffect(() => {
    getSedes(allowedSedeIds?.length ? allowedSedeIds : null).then(list => {
      setSedes(list)
      if (list.length === 1) setSedeId(list[0].id)
      else if (list.length > 0) setSedeId(list[0].id)
    }).catch(console.error)
  }, [allowedSedeIds])

  // Cargar novedades del turno anterior (módulos + vuelos del último reporte de la sede)
  useEffect(() => {
    if (!sedeId) { setVuelosAnteriores([]); return }
    db().from('registros').select('*').eq('sede_id', sedeId).order('fecha_reporte', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setNovedadesAnteriores(data)
        db().from('vuelo_novedades').select('*').eq('registro_id', data.id).order('id').then(({ data: vuelos }) => {
          setVuelosAnteriores(vuelos || [])
        })
      } else {
        setNovedadesAnteriores(null)
        setVuelosAnteriores([])
      }
    })
  }, [sedeId])

  // Cargar vehículos y personal asignados a la sede elegida
  useEffect(() => {
    if (!sedeId) { setVehiculosSede([]); setPersonasSede([]); return }
    getActivos({ tipo: 'VEHICULO', sede_id: sedeId }).then(setVehiculosSede).catch(console.error)
    getPersonasBySede(sedeId).then(setPersonasSede).catch(console.error)
  }, [sedeId])

  const sedeSel = sedes.find(s => s.id === sedeId)

  // Cargar vuelos del día (calendario real, con fallback a plantilla semanal) —
  // solo escalas tipo Aeropuerto.
  useEffect(() => {
    if (!sedeId || sedeSel?.tipo !== 'Aeropuerto') { setVuelosDelDia([]); setVueloEstados({}); return }
    const fechaHoy = new Date().toISOString().slice(0, 10)
    getVuelosDelDia(sedeId, fechaHoy).then(list => {
      setVuelosDelDia(list)
      setVueloEstados(Object.fromEntries(list.map(v => [v.id, { ...ESTADO_VUELO_DEFAULT }])))
    }).catch(console.error)
  }, [sedeId, sedeSel?.tipo])

  const agregarItemModulo = (key) =>
    setModulos(prev => ({
      ...prev,
      [key]: { items: [...prev[key].items, { severidad: 'Hay novedades', descripcion: '', privada: false, escalar: false, tipo_escalamiento: '' }] },
    }))

  const actualizarItemModulo = (key, i, val) =>
    setModulos(prev => ({
      ...prev,
      [key]: { items: prev[key].items.map((it, idx) => idx === i ? val : it) },
    }))

  const quitarItemModulo = (key, i) =>
    setModulos(prev => ({
      ...prev,
      [key]: { items: prev[key].items.filter((_, idx) => idx !== i) },
    }))

  const agregarVehiculoNovedad = () =>
    setVehiculoNovedades(prev => [...prev, { activo_id: '', activo_nombre: '', tipo: 'Avería', descripcion: '', crearTicket: !esOperario, escalar: false, tipo_escalamiento: '' }])

  const actualizarVehiculoNovedad = (i, val) =>
    setVehiculoNovedades(prev => prev.map((v, idx) => idx === i ? val : v))

  const quitarVehiculoNovedad = (i) =>
    setVehiculoNovedades(prev => prev.filter((_, idx) => idx !== i))

  const agregarPersonaNovedad = () =>
    setPersonaNovedades(prev => [...prev, { persona_id: '', persona_nombre: '', categoria: 'Otro', descripcion: '' }])

  const actualizarPersonaNovedad = (i, val) =>
    setPersonaNovedades(prev => prev.map((p, idx) => idx === i ? val : p))

  const quitarPersonaNovedad = (i) =>
    setPersonaNovedades(prev => prev.filter((_, idx) => idx !== i))

  const actualizarVueloEstado = (id, val) =>
    setVueloEstados(prev => ({ ...prev, [id]: val }))

  const agregarVueloAdHoc = () =>
    setVuelosAdHoc(prev => [...prev, { vuelo_codigo: '', destino: '', aerolinea: '', tipo: 'Demora', descripcion: '' }])

  const actualizarVueloAdHoc = (i, val) =>
    setVuelosAdHoc(prev => prev.map((v, idx) => idx === i ? val : v))

  const quitarVueloAdHoc = (i) =>
    setVuelosAdHoc(prev => prev.filter((_, idx) => idx !== i))

  const agregarArchivos = (files) => {
    const MAX_MB = 50
    const nuevos = []
    for (const file of Array.from(files || [])) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`"${file.name}" supera el máximo de ${MAX_MB} MB`)
        continue
      }
      nuevos.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })
    }
    if (nuevos.length) setArchivos(prev => [...prev, ...nuevos])
  }

  const quitarArchivo = (id) => {
    setArchivos(prev => {
      const item = prev.find(a => a.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return prev.filter(a => a.id !== id)
    })
  }

  // Devuelve el id del registro existente para esta sede+turno+día, o null.
  // (antes devolvía un booleano; ahora hace falta el id para poder reusarlo
  // cuando el usuario elige "Agregar al reporte existente").
  const checkDuplicado = async () => {
    if (!sedeId || !turno) return null
    const hoy = new Date().toISOString().slice(0, 10)
    const { data } = await db()
      .from('registros')
      .select('id')
      .eq('sede_id', sedeId)
      .eq('turno', turno)
      .gte('fecha_reporte', `${hoy}T00:00:00-03:00`)
      .lte('fecha_reporte', `${hoy}T23:59:59-03:00`)
      .limit(1)
    return data?.[0]?.id ?? null
  }

  const handleSubmit = async (forzar = false) => {
    if (!sedeId)  { setError('Seleccioná una sede'); return }
    if (!turno)   { setError('Seleccioná el turno'); return }
    // Validar novedades de módulo
    for (const m of MODULOS) {
      for (const it of modulos[m.key].items) {
        if (!it.descripcion.trim()) { setError(`Completá la descripción de cada novedad en "${m.label}"`); return }
      }
    }
    // Validar novedades de vehículo
    for (const v of vehiculoNovedades) {
      if (!v.activo_id) { setError('Seleccioná el vehículo en cada novedad de vehículo'); return }
      if (!v.descripcion.trim()) { setError('Completá la descripción de cada novedad de vehículo'); return }
    }
    // Validar novedades de persona
    for (const p of personaNovedades) {
      if (!p.persona_id) { setError('Seleccioná la persona en cada novedad de personal'); return }
      if (!p.descripcion.trim()) { setError('Completá la descripción de cada novedad de personal'); return }
    }
    // Validar novedades de vuelo
    for (const v of vuelosDelDia) {
      const est = vueloEstados[v.id]
      if (est?.tipo && est.tipo !== 'OK' && !est.descripcion.trim()) {
        setError(`Completá la descripción de la novedad del vuelo ${v.vuelo_codigo}`); return
      }
    }
    for (const v of vuelosAdHoc) {
      if (!v.vuelo_codigo.trim()) { setError('Completá el código de cada vuelo no listado'); return }
      if (!v.descripcion.trim()) { setError('Completá la descripción de cada vuelo no listado'); return }
    }
    setLoading(true); setError(null)
    try {
      const dupId = await checkDuplicado()
      if (dupId && !forzar) {
        setError('DUPLICADO')
        setLoading(false)
        return
      }
      // "Enviar igual": ya existe un reporte para esta sede+turno+día (la DB
      // lo bloquea con un índice único, no hay forma de insertar un 2do).
      // En vez de duplicarlo, reusamos ese registro: no se crea uno nuevo ni
      // se pisa su checklist, solo se agregan las novedades cargadas ahora.
      const reutilizandoReporte = !!dupId && forzar

      // Lista plana de todas las novedades de módulo, con su módulo de origen
      const todosLosItems = MODULOS.flatMap(m =>
        modulos[m.key].items.map(it => ({ ...it, modulo_key: m.key, modulo_label: m.label }))
      )
      const itemsEscalados = todosLosItems.filter(it => it.escalar)
      const vuelosConNovedad = vuelosDelDia.some(v => {
        const tipo = vueloEstados[v.id]?.tipo
        return tipo && tipo !== 'OK'
      }) || vuelosAdHoc.length > 0
      const tieneNovedadesOperativas = todosLosItems.length > 0
        || vehiculoNovedades.length > 0
        || personaNovedades.length > 0
        || vuelosConNovedad
      const estadoGeneralEfectivo = estadoGeneral === 'Sin novedades' && tieneNovedadesOperativas
        ? 'Hay novedades'
        : estadoGeneral
      if (estadoGeneralEfectivo !== estadoGeneral) setEstadoGeneral(estadoGeneralEfectivo)

      const payload = {
        sede_id:              sedeId,
        sede_nombre:          sedeSel?.nombre || '',
        reportante:           perfil?.nombre  || '',
        email_reportante:     perfil?.email   || '',
        turno,
        nivel_actividad:      nivelActividad,
        estado_general:       estadoGeneralEfectivo,
        requiere_escalamiento: itemsEscalados.length > 0 || estadoGeneralEfectivo === 'Operación condicionada',
        motivo_escalamiento:  itemsEscalados.length > 0 ? itemsEscalados.map(it => `[${it.tipo_escalamiento || 'Otro'}] ${it.descripcion}`).join(' | ') : null,
        escalado_a:           itemsEscalados.length > 0 ? [...new Set(itemsEscalados.map(it => it.tipo_escalamiento).filter(Boolean))].join(', ') : null,
        origen_form:          getOperationalOrigin(sedeSel),
        tipo:                 sedeSel?.tipo || null,
        fecha_reporte:        new Date().toISOString(),
      }
      // Módulos A-H: resumen legacy (estado_X/detalle_X) derivado de los items
      for (const m of MODULOS) {
        const items = modulos[m.key].items
        payload[`estado_${m.key}`]  = items.length === 0 ? 'Sin novedad' : (items.some(it => it.severidad === 'Crítico') ? 'Crítico' : 'Hay novedades')
        payload[`detalle_${m.key}`] = items.length === 0 ? null : items.map(it => (it.privada ? '[PRIVADA] ' : '') + it.descripcion).join(' | ')
      }
      // Raciones (solo Comedores)
      if (sedeSel?.tipo === 'Comedor') {
        payload.op1_producidos          = op1Prod      ? parseInt(op1Prod)      : null
        payload.op1_servidos            = op1Serv      ? parseInt(op1Serv)      : null
        payload.op1_sobrante            = op1Sobrante      ? parseInt(op1Sobrante)      : null
        payload.op2_producidos          = op2Prod      ? parseInt(op2Prod)      : null
        payload.op2_servidos            = op2Serv      ? parseInt(op2Serv)      : null
        payload.op2_sobrante            = op2Sobrante  ? parseInt(op2Sobrante) : null
        payload.vegetariano_producidos  = vegProd      ? parseInt(vegProd)      : null
        payload.vegetariano_servidos    = vegServ      ? parseInt(vegServ)      : null
        payload.vegetariano_sobrante    = vegSobrante      ? parseInt(vegSobrante)      : null
        payload.ensalada_producidos     = ensaladaProd ? parseInt(ensaladaProd) : null
        payload.ensalada_sobrante       = ensaladaSobrante ? parseInt(ensaladaSobrante) : null
        payload.postre_producidos       = postreProd   ? parseInt(postreProd)   : null
        payload.postre_sobrante         = postreSobrante   ? parseInt(postreSobrante)   : null
      }
      let registroId
      if (reutilizandoReporte) {
        registroId = dupId
      } else {
        const registro = await createRegistro(payload)
        registroId = registro?.id ?? registro?.[0]?.id ?? null
      }
      setCreadoId(registroId)

      // Subir adjuntos staged (recién ahora existe un registro.id real)
      let fallosAdjuntos = 0
      if (registroId && archivos.length > 0) {
        for (const item of archivos) {
          try {
            await uploadAdjunto('registro', registroId, item.file, perfil?.nombre || 'reportante')
          } catch (e) {
            console.error('Error subiendo adjunto:', e)
            fallosAdjuntos++
          }
        }
      }
      setAdjuntosErrores(fallosAdjuntos)

      // Insertar novedades de módulo (+ escalamiento vinculado cuando se marcó "Escalar")
      let resultadosModulos = []
      if (todosLosItems.length > 0 && registroId) {
        const fechaHoy = new Date().toISOString().slice(0, 10)
        resultadosModulos = await Promise.all(todosLosItems.map(it =>
          createModuloNovedadConEscalamiento({
            registro_id:        registroId,
            sede_id:            sedeId,
            sede_nombre:        sedeSel?.nombre || '',
            modulo_key:         it.modulo_key,
            modulo_label:       it.modulo_label,
            severidad:          it.severidad || 'Hay novedades',
            descripcion:        it.descripcion,
            privada:            !!it.privada,
            reportante:         perfil?.nombre || '',
            fecha_reporte:      fechaHoy,
            estado:             'Pendiente',
            escalar:            !!it.escalar,
            tipo_escalamiento:  it.escalar ? (it.tipo_escalamiento || 'Otro') : null,
          })
        ))
      }
      setEscalamientosCreados(resultadosModulos.filter(r => r.escalamiento).length)

      // Insertar novedades de vehículo (+ ticket de Flota cuando se pidió)
      let ticketsCreados = 0
      if (vehiculoNovedades.length > 0 && registroId) {
        const fechaHoy = new Date().toISOString().slice(0, 10)
        const resultados = await Promise.all(vehiculoNovedades.map(v =>
          createVehiculoNovedadConTicket({
            registro_id:   registroId,
            sede_id:       sedeId,
            sede_nombre:   sedeSel?.nombre || '',
            activo_id:     v.activo_id,
            activo_nombre: v.activo_nombre,
            tipo:          v.tipo || 'Avería',
            descripcion:   v.descripcion,
            reportante:    perfil?.nombre || '',
            fecha_reporte: fechaHoy,
            estado:        'Pendiente',
            crearTicket:   esOperario ? false : v.crearTicket,
            escalar:           v.escalar,
            tipo_escalamiento: v.escalar ? (v.tipo_escalamiento || 'Otro') : null,
          })
        ))
        ticketsCreados = resultados.filter(r => r.ticket).length
        setEscalamientosCreados(prev => prev + resultados.filter(r => r.escalamiento).length)
      }
      setTicketsFlotaCreados(ticketsCreados)

      // Insertar novedades de personal
      if (personaNovedades.length > 0 && registroId) {
        const fechaHoy = new Date().toISOString().slice(0, 10)
        await Promise.all(personaNovedades.map(p =>
          createPersonaNovedad({
            registro_id:    registroId,
            sede_id:        sedeId,
            sede_nombre:    sedeSel?.nombre || '',
            persona_id:     p.persona_id,
            persona_nombre: p.persona_nombre,
            categoria:      p.categoria || 'Otro',
            descripcion:    p.descripcion,
            reportante:     perfil?.nombre || '',
            fecha_reporte:  fechaHoy,
            estado:         'Pendiente',
          })
        ))
      }

      // Insertar novedades de vuelo (plantilla del día con novedad reportada + ad-hoc no listados)
      if (registroId && (vuelosDelDia.length > 0 || vuelosAdHoc.length > 0)) {
        const fechaHoy = new Date().toISOString().slice(0, 10)
        const novedadesVuelo = [
          ...vuelosDelDia
            .filter(v => vueloEstados[v.id]?.tipo)
            .map(v => ({
              registro_id:         registroId,
              sede_id:             sedeId,
              sede_nombre:         sedeSel?.nombre || '',
              vuelo_programado_id: v._origen === 'plantilla' ? v.id : null,
              vuelo_calendario_id: v._origen === 'calendario' ? v.id : null,
              vuelo_codigo:        v.vuelo_codigo,
              destino:             v.destino,
              aerolinea:           v.aerolinea,
              tipo:                vueloEstados[v.id].tipo,
              descripcion:         vueloEstados[v.id].descripcion.trim() || (vueloEstados[v.id].tipo === 'OK' ? 'Vuelo operado sin novedades.' : ''),
              reportante:          perfil?.nombre || '',
              fecha_reporte:       fechaHoy,
              estado:              vueloEstados[v.id].tipo === 'OK' ? 'Resuelto' : 'Pendiente',
            })),
          ...vuelosAdHoc.map(v => ({
            registro_id:   registroId,
            sede_id:       sedeId,
            sede_nombre:   sedeSel?.nombre || '',
            vuelo_codigo:  v.vuelo_codigo,
            destino:       v.destino,
            aerolinea:     v.aerolinea,
            tipo:          v.tipo || 'Otro',
            descripcion:   v.descripcion,
            reportante:    perfil?.nombre || '',
            fecha_reporte: fechaHoy,
            estado:        'Pendiente',
          })),
        ]
        if (novedadesVuelo.length > 0) {
          await Promise.all(novedadesVuelo.map(createVueloNovedad))
        }
      }

      // Detectar escalamientos de Compras para ofrecer requerimiento
      // (operario no tiene acceso a Compras: se omite la oferta de crear requerimiento)
      const compras = esOperario ? [] : resultadosModulos.map(r => r.escalamiento).filter(e => e?.tipo === 'Compras')
      if (compras.length > 0) {
        setEscCompras(compras)
        setReqForm({
          descripcion: compras.map(e => e.descripcion).join('\n'),
          sede_id:     sedeId,
          sede_nombre: sedeSel?.nombre || '',
        })
      }
      setEnviado(true)
      if (compras.length === 0) setTimeout(() => onSuccess(), 1500)
    } catch (err) {
      if (err.message?.includes('registros_sede_turno_dia_uq')) {
        setError('DUPLICADO')
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError('SIN_RED')
      } else {
        setError(err.message || 'Error desconocido')
      }
    } finally {
      setLoading(false)
    }
  }


  const generarPDF = () => {
    const fecha    = new Date()
    const fechaStr = fecha.toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    const horaStr  = fecha.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })
    const todosLosItemsPDF = MODULOS.flatMap(m => modulos[m.key].items.map(it => ({ ...it, moduloLabel: m.label })))
    const estadoClass = estadoGeneral === 'Sin novedades' ? 'ok' : estadoGeneral === 'Hay novedades' ? 'warn' : 'crit'

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Turno — ${sedeSel?.nombre || ''}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; color: #111; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  .sub { color: #666; font-size: 0.85rem; margin-bottom: 20px; }
  .badge { display:inline-block; padding:4px 14px; border-radius:20px; font-weight:700; font-size:0.85rem; margin-bottom:18px; }
  .ok   { background:#e6ffe6; color:#1a7a1a; border:1px solid #4caf50; }
  .warn { background:#fff8e1; color:#b45309; border:1px solid #f59e0b; }
  .crit { background:#ffe6e6; color:#c00;    border:1px solid #f00; }
  table { width:100%; border-collapse:collapse; margin:12px 0; }
  th { text-align:left; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.06em; color:#888; padding:4px 8px; border-bottom:2px solid #ddd; }
  td { padding:7px 8px; font-size:0.87rem; border-bottom:1px solid #eee; vertical-align:top; }
  .esc { background:#fff4f4; border:1px solid #fcc; border-radius:6px; padding:8px 12px; margin:4px 0; font-size:0.85rem; }
  .footer { margin-top:32px; padding-top:10px; border-top:1px solid #ddd; font-size:0.7rem; color:#aaa; }
  @media print { body { padding:10px } }
</style>
</head>
<body>
<h1>Fly Kitchen — Reporte de Turno</h1>
<div class="sub">${sedeSel?.nombre || '—'} · Turno ${turno} · ${fechaStr}, ${horaStr} hs</div>
<div class="badge ${estadoClass}">${estadoGeneral}</div>
<table>
  <tr><th>Reportante</th><th>Nivel de actividad</th></tr>
  <tr><td>${perfil?.nombre || '—'}</td><td>${nivelActividad}</td></tr>
</table>
${todosLosItemsPDF.length > 0 ? `
<h3 style="font-size:0.9rem;margin:18px 0 6px">Módulos con novedades</h3>
<table>
  <tr><th>Módulo</th><th>Severidad</th><th>Detalle</th></tr>
  ${todosLosItemsPDF.map(it => `
  <tr><td>${it.moduloLabel}</td><td>${it.severidad}${it.escalar ? ' · Escalado' : ''}</td><td>${(it.privada ? '[PRIVADA] ' : '') + it.descripcion}${it.escalar ? ` <em>(→ ${it.tipo_escalamiento || 'Otro'})</em>` : ''}</td></tr>`).join('')}
</table>` : '<p style="color:#2a7a2a;font-size:0.85rem;margin:12px 0">✓ Todos los módulos sin novedades</p>'}
${vehiculoNovedades.length > 0 ? `
<h3 style="font-size:0.9rem;margin:18px 0 6px">Novedades de Vehículo</h3>
${vehiculoNovedades.map((v, i) => `<div class="esc"><strong>${i+1}. [${v.tipo || 'Avería'}] ${v.activo_nombre || 'Vehículo sin nombre'}</strong> — ${v.descripcion}</div>`).join('')}` : ''}
${personaNovedades.length > 0 ? `
<h3 style="font-size:0.9rem;margin:18px 0 6px">Novedades de Personal</h3>
${personaNovedades.map((p, i) => `<div class="esc"><strong>${i+1}. [${p.categoria || 'Otro'}] ${p.persona_nombre || 'Sin nombre'}</strong> — ${p.descripcion}</div>`).join('')}` : ''}
<div class="footer">Fly Kitchen Operations · ${fecha.toISOString()} · origen: app</div>
</body>
</html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 400)
  }

  // ── Pantalla de éxito ──
  if (enviado) {
    const handleCrearReq = async () => {
      if (!reqForm) return
      setReqLoading(true)
      try {
        await createRequerimiento({
          sede_id:     reqForm.sede_id,
          sede_nombre: reqForm.sede_nombre,
          solicitante: perfil?.nombre || '',
          descripcion: reqForm.descripcion,
          urgencia:    'alta',
          estado:      'Pendiente',
          origen_registro_id: creadoId,
        })
        setReqOk(true)
        setTimeout(() => onSuccess(), 1500)
      } catch (e) {
        console.error(e)
      } finally {
        setReqLoading(false)
      }
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.5rem' }}>
        <div style={{ fontSize: '3rem' }}>✓</div>
        <p style={{ color: 'var(--phosphor)', fontWeight: 700, fontSize: '1.1rem' }}>Reporte enviado</p>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Gracias {perfil?.nombre?.split(' ')[0]}</p>

        {ticketsFlotaCreados > 0 && (
          <p style={{ color: COLOR_VEHICULO, fontSize: '0.78rem', textAlign: 'center' }}>
            🚚 {ticketsFlotaCreados} ticket{ticketsFlotaCreados > 1 ? 's' : ''} de Flota creado{ticketsFlotaCreados > 1 ? 's' : ''} automáticamente
          </p>
        )}

        {escalamientosCreados > 0 && (
          <p style={{ color: '#FF2A2A', fontSize: '0.78rem', textAlign: 'center' }}>
            🚩 {escalamientosCreados} escalamiento{escalamientosCreados > 1 ? 's' : ''} creado{escalamientosCreados > 1 ? 's' : ''} y notificado{escalamientosCreados > 1 ? 's' : ''}
          </p>
        )}

        {adjuntosErrores > 0 && (
          <p style={{ color: '#F59E0B', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.4 }}>
            ⚠ {adjuntosErrores} archivo{adjuntosErrores > 1 ? 's' : ''} no se {adjuntosErrores > 1 ? 'pudieron' : 'pudo'} subir.
            El reporte quedó guardado igual — pedile a un encargado que los suba desde la PC en el detalle del reporte.
          </p>
        )}

        <button onClick={generarPDF} style={{
          marginTop: '0.25rem', padding: '0.6rem 1.4rem', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
          color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 600,
        }}>
          📄 Descargar reporte
        </button>

        {escCompras.length > 0 && !reqOk && (
          <div style={{
            width: '100%', marginTop: '0.5rem', borderRadius: 10,
            background: 'rgba(80,180,255,0.07)', border: '1.5px solid rgba(80,180,255,0.25)',
            padding: '1rem',
          }}>
            <p style={{ color: '#50b4ff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              📦 Escalamiento a Compras detectado
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginBottom: '0.9rem', lineHeight: 1.4 }}>
              {escCompras.map(e => e.descripcion).join(' · ')}
            </p>
            <button
              onClick={handleCrearReq}
              disabled={reqLoading}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 8,
                background: reqLoading ? 'rgba(80,180,255,0.3)' : 'rgba(80,180,255,0.15)',
                border: '1.5px solid rgba(80,180,255,0.4)',
                color: '#50b4ff', fontWeight: 700, fontSize: '0.88rem',
                cursor: reqLoading ? 'wait' : 'pointer',
              }}>
              {reqLoading ? 'Creando...' : '+ Crear requerimiento de compras'}
            </button>
            <button onClick={() => onSuccess()}
              style={{
                width: '100%', marginTop: '0.5rem', padding: '0.5rem',
                background: 'none', border: 'none', color: 'var(--text-dim)',
                fontSize: '0.75rem', cursor: 'pointer',
              }}>
              Omitir
            </button>
          </div>
        )}

        {reqOk && (
          <p style={{ color: 'var(--phosphor)', fontSize: '0.82rem' }}>Requerimiento creado ✓</p>
        )}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--abyss)' }}>
      {/* Header */}
      <div style={{
        padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.2rem' }}>
          <ChevronLeft size={22} />
        </button>
        <div>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1rem', margin: 0 }}>Nuevo Reporte</h2>
          <p style={{ color: 'rgba(57,255,20,0.5)', fontSize: '0.65rem', margin: 0, marginTop: 1 }}>
            {perfil?.nombre || '—'}
          </p>
        </div>
      </div>

      {/* Body scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        
        {/* Novedades del turno anterior */}
        {novedadesAnteriores && (
          <div style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:8, padding:'1rem', marginBottom:'1.5rem' }}>
            <h3 style={{ fontSize:'0.75rem', color:'#3B82F6', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <Clock size={14} /> Novedades del Turno Anterior
            </h3>
            <p style={{ fontSize:'0.7rem', color:'var(--text-dim)', marginBottom:'0.8rem' }}>
              Reportado el {format(new Date(novedadesAnteriores.fecha_reporte), 'dd/MM/yyyy HH:mm')}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {(() => {
                const puedeVerPrivadas = ['admin', 'editor', 'encargado'].includes(perfil?.rol)
                const bloques = MODULOS.map(m => {
                  const est = novedadesAnteriores[`estado_${m.key}`]
                  const detRaw = novedadesAnteriores[`detalle_${m.key}`] || ''
                  if (!est || est === 'Sin novedad' || !detRaw) return null
                  // detalle_X puede traer varias novedades concatenadas con ' | ',
                  // cada una con su propio prefijo "[PRIVADA] " opcional
                  const segmentos = detRaw.split(' | ').map(seg => {
                    const privada = seg.startsWith('[PRIVADA] ')
                    return { texto: privada ? seg.replace('[PRIVADA] ', '') : seg, privada }
                  }).filter(seg => puedeVerPrivadas || !seg.privada)
                  if (segmentos.length === 0) return null
                  return { key: m.key, label: m.label, segmentos }
                }).filter(Boolean)

                if (vuelosAnteriores.length > 0) {
                  bloques.push({
                    key: 'vuelos',
                    label: 'Vuelos del día',
                    segmentos: vuelosAnteriores.map(v => ({
                      texto: `${v.vuelo_codigo}${v.destino ? ` → ${v.destino}` : ''}: ${v.tipo}${v.tipo !== 'OK' && v.descripcion ? ` — ${v.descripcion}` : ''}`,
                      privada: false,
                      ok: v.tipo === 'OK',
                    })),
                  })
                }

                if (bloques.length === 0) {
                  return <p style={{ fontSize:'0.75rem', color:'var(--text-dim)', margin:0 }}>No hubo novedades registradas en el turno anterior.</p>
                }
                return bloques.map(({ key, label, segmentos }) => (
                  <div key={key} style={{ background:'rgba(0,0,0,0.2)', padding:'0.6rem', borderRadius:6 }}>
                    <div style={{ fontSize:'0.65rem', color:'var(--text-dim)', marginBottom:'0.3rem', textTransform:'uppercase' }}>{label}</div>
                    {segmentos.map((seg, i) => (
                      <div key={i} style={{ fontSize:'0.8rem', color: seg.ok ? '#39FF14' : 'var(--text)', marginTop: i > 0 ? '0.3rem' : 0 }}>
                        • {seg.texto} {seg.privada && <span style={{ color:'#F59E0B', marginLeft:4, fontSize:'0.65rem' }}>(Privada)</span>}
                      </div>
                    ))}
                  </div>
                ))
              })()}
            </div>
          </div>
        )}

        {/* Sede */}
        <div style={{ marginBottom: '1.1rem' }}>
          <SectionLabel>Sede *</SectionLabel>
          {sedes.length === 1 ? (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: 8, fontWeight: 600,
              background: 'rgba(57,255,20,0.07)', border: '1.5px solid rgba(57,255,20,0.2)',
              color: 'var(--phosphor)', fontSize: '0.9rem',
            }}>{sedeSel?.nombre}</div>
          ) : (
            <select value={sedeId || ''} onChange={e => setSedeId(Number(e.target.value))}
              style={{
                width: '100%', padding: '0.8rem 1rem', borderRadius: 8,
                background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text)', fontSize: '0.9rem', appearance: 'none',
              }}>
              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          )}
        </div>

        {/* Turno */}
        <div style={{ marginBottom: '1.1rem' }}>
          <SectionLabel>Turno *</SectionLabel>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {REPORT_TURNS.map(t => (
              <button key={t} onClick={() => setTurno(t)} style={{
                flex: 1, padding: '0.75rem 0', borderRadius: 8, cursor: 'pointer',
                fontWeight: turno === t ? 700 : 400, fontSize: '0.85rem',
                background: turno === t ? 'rgba(57,255,20,0.12)' : 'var(--surface)',
                border: turno === t ? '1.5px solid #39FF14' : '1.5px solid rgba(255,255,255,0.08)',
                color: turno === t ? '#39FF14' : 'var(--text-dim)', transition: 'all 0.15s',
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Nivel actividad */}
        <div style={{ marginBottom: '1.1rem' }}>
          <SectionLabel>Nivel de actividad</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {REPORT_ACTIVITY_LEVELS.map(n => (
              <Chip key={n} label={n} active={nivelActividad === n}
                color="#50b4ff" bg="rgba(80,180,255,0.12)"
                onClick={() => setNivelActividad(n)} />
            ))}
          </div>
        </div>

        {/* Estado general */}
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionLabel>Estado general *</SectionLabel>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', lineHeight: 1.4, marginTop: '-0.3rem', marginBottom: '0.6rem' }}>
            Sin novedades: turno normal. Hay novedades: pasó algo pero no afecta el servicio. Operación condicionada: no se puede prestar el servicio con normalidad.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {ESTADOS_GENERALES.map(e => (
              <button key={e.val} onClick={() => setEstadoGeneral(e.val)} style={{
                padding: '0.8rem 1rem', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                background: estadoGeneral === e.val ? e.bg : 'var(--surface)',
                border: estadoGeneral === e.val ? `1.5px solid ${e.color}` : '1.5px solid rgba(255,255,255,0.06)',
                color: estadoGeneral === e.val ? e.color : 'var(--text)', fontWeight: estadoGeneral === e.val ? 700 : 400,
                fontSize: '0.9rem', transition: 'all 0.15s',
              }}>{e.label}</button>
            ))}
          </div>
          {estadoGeneral === 'Operación condicionada' && (
            <p style={{ fontSize: '0.7rem', color: '#FF2A2A', marginTop: '0.5rem', lineHeight: 1.4 }}>
              Abrí el módulo afectado más abajo, agregá la novedad como "Crítico" y escalala desde ahí mismo.
            </p>
          )}
        </div>

        {/* Raciones — solo Comedores */}
        {sedeSel?.tipo === 'Comedor' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <SectionLabel>Raciones del turno (opcional)</SectionLabel>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', lineHeight: 1.4, marginTop: '-0.3rem', marginBottom: '0.6rem' }}>
              Cada menú está agrupado por opción. Sobrante son las porciones que quedaron sin servir al final del turno.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              <RacionCard title="Opción 1" fields={[
                { label: 'Producidas', val: op1Prod, set: setOp1Prod },
                { label: 'Servidas', val: op1Serv, set: setOp1Serv },
                { label: 'Sobrante', val: op1Sobrante, set: setOp1Sobrante },
              ]} />
              <RacionCard title="Opción 2" fields={[
                { label: 'Producidas', val: op2Prod, set: setOp2Prod },
                { label: 'Servidas', val: op2Serv, set: setOp2Serv },
                { label: 'Sobrante', val: op2Sobrante, set: setOp2Sobrante },
              ]} />
              <RacionCard title="Vegetariano" fields={[
                { label: 'Producidas', val: vegProd, set: setVegProd },
                { label: 'Servidas', val: vegServ, set: setVegServ },
                { label: 'Sobrante', val: vegSobrante, set: setVegSobrante },
              ]} />
              <RacionCard title="Ensalada" fields={[
                { label: 'Producidas', val: ensaladaProd, set: setEnsaladaProd },
                { label: 'Sobrante', val: ensaladaSobrante, set: setEnsaladaSobrante },
              ]} />
              <RacionCard title="Postre" fields={[
                { label: 'Producidas', val: postreProd, set: setPostreProd },
                { label: 'Sobrante', val: postreSobrante, set: setPostreSobrante },
              ]} />
            </div>
          </div>
        )}

        {/* Vuelos del día — solo escalas tipo Aeropuerto */}
        {sedeSel?.tipo === 'Aeropuerto' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <SectionLabel>
                <Plane size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Vuelos del día
              </SectionLabel>
              <button onClick={agregarVueloAdHoc} style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.3rem 0.7rem', borderRadius: 6, cursor: 'pointer',
                background: `${COLOR_VUELO}15`, border: `1px solid ${COLOR_VUELO}55`,
                color: COLOR_VUELO, fontSize: '0.72rem', fontWeight: 700,
              }}>
                <Plus size={12} /> No listado
              </button>
            </div>

            {vuelosDelDia.length === 0 && vuelosAdHoc.length === 0 ? (
              <div style={{
                padding: '0.85rem 1rem', borderRadius: 8, textAlign: 'center',
                background: 'var(--surface)', border: '1.5px dashed rgba(255,255,255,0.08)',
                color: 'var(--text-dim)', fontSize: '0.8rem',
              }}>
                No hay vuelos pendientes de chequear hoy. Si falta uno, agregalo con "No listado".
              </div>
            ) : (
              <>
                {vuelosDelDia.map(v => (
                  <VueloDelDiaCard
                    key={v.id}
                    vuelo={v}
                    estado={vueloEstados[v.id] || ESTADO_VUELO_DEFAULT}
                    onChange={val => actualizarVueloEstado(v.id, val)}
                  />
                ))}
                {vuelosAdHoc.map((item, i) => (
                  <VueloAdHocCard
                    key={i}
                    item={item}
                    index={i}
                    onChange={val => actualizarVueloAdHoc(i, val)}
                    onRemove={() => quitarVueloAdHoc(i)}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Fotos / Documentos */}
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionLabel>Fotos / Documentos (opcional)</SectionLabel>
          {archivos.map(item => (
            <ArchivoStagedItem key={item.id} item={item} onRemove={() => quitarArchivo(item.id)} />
          ))}
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            padding: '0.75rem', borderRadius: 8, cursor: 'pointer',
            background: 'var(--surface)', border: '1.5px dashed rgba(255,255,255,0.15)',
            color: 'var(--text-dim)', fontSize: '0.8rem',
          }}>
            <Paperclip size={14} /> Adjuntar foto o documento
            <input
              type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              style={{ display: 'none' }}
              onChange={e => { agregarArchivos(e.target.files); e.target.value = '' }}
            />
          </label>
        </div>

        {/* Módulos A-H */}
        <div style={{ marginBottom: '1.25rem' }}>
          <SectionLabel>Módulos</SectionLabel>
          {MODULOS.map(m => (
            <ModuloCard key={m.key} mod={m}
              items={modulos[m.key].items}
              ejemplo={m.ejemplo}
              onAgregar={() => agregarItemModulo(m.key)}
              onActualizar={(i, val) => actualizarItemModulo(m.key, i, val)}
              onQuitar={(i) => quitarItemModulo(m.key, i)}
            />
          ))}
        </div>

        {/* Novedades de vehículo */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <SectionLabel>
              <Truck size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Novedades de Vehículo{vehiculoNovedades.length > 0 ? ` (${vehiculoNovedades.length})` : ''}
            </SectionLabel>
            <button onClick={agregarVehiculoNovedad} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.3rem 0.7rem', borderRadius: 6, cursor: 'pointer',
              background: `${COLOR_VEHICULO}15`, border: `1px solid ${COLOR_VEHICULO}55`,
              color: COLOR_VEHICULO, fontSize: '0.72rem', fontWeight: 700,
            }}>
              <Plus size={12} /> Agregar
            </button>
          </div>

          {vehiculoNovedades.length === 0 ? (
            <div style={{
              padding: '0.85rem 1rem', borderRadius: 8, textAlign: 'center',
              background: 'var(--surface)', border: '1.5px dashed rgba(255,255,255,0.08)',
              color: 'var(--text-dim)', fontSize: '0.8rem',
            }}>
              Sin novedades de vehículo — tocá "Agregar" si hay algo que reportar
            </div>
          ) : (
            vehiculoNovedades.map((item, i) => (
              <VehiculoNovedadCard
                key={i}
                item={item}
                index={i}
                vehiculos={vehiculosSede}
                onChange={val => actualizarVehiculoNovedad(i, val)}
                onRemove={() => quitarVehiculoNovedad(i)}
                hideCrearTicket={esOperario}
              />
            ))
          )}
        </div>

        {/* Novedades de personal */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <SectionLabel>
              <User size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Novedades de Personal{personaNovedades.length > 0 ? ` (${personaNovedades.length})` : ''}
            </SectionLabel>
            <button onClick={agregarPersonaNovedad} style={{
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.3rem 0.7rem', borderRadius: 6, cursor: 'pointer',
              background: `${COLOR_PERSONA}15`, border: `1px solid ${COLOR_PERSONA}55`,
              color: COLOR_PERSONA, fontSize: '0.72rem', fontWeight: 700,
            }}>
              <Plus size={12} /> Agregar
            </button>
          </div>

          {personaNovedades.length === 0 ? (
            <div style={{
              padding: '0.85rem 1rem', borderRadius: 8, textAlign: 'center',
              background: 'var(--surface)', border: '1.5px dashed rgba(255,255,255,0.08)',
              color: 'var(--text-dim)', fontSize: '0.8rem',
            }}>
              Sin novedades de personal — tocá "Agregar" si hay algo que reportar
            </div>
          ) : (
            personaNovedades.map((item, i) => (
              <PersonaNovedadCard
                key={i}
                item={item}
                index={i}
                personas={personasSede}
                onChange={val => actualizarPersonaNovedad(i, val)}
                onRemove={() => quitarPersonaNovedad(i)}
              />
            ))
          )}
        </div>

        {/* Mensajes de error con acción */}
        {error === 'DUPLICADO' && (
          <div style={{
            padding: '1rem', borderRadius: 8, marginBottom: '1rem',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <AlertTriangle size={16} color="#F59E0B" />
              <span style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.85rem' }}>Ya existe un reporte para este turno</span>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '0.8rem' }}>
              Ya se registró un reporte para <strong>{sedeSel?.nombre}</strong>, turno <strong>{turno}</strong> hoy.
              Las novedades que cargaste ahora se van a agregar a ese reporte (no se va a duplicar ni pisar el checklist original).
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => { setError(null) }}
                style={{
                  flex: 1, padding: '0.65rem', borderRadius: 8, cursor: 'pointer',
                  background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 600,
                }}>
                Cancelar
              </button>
              <button
                onClick={() => { setError(null); handleSubmit(true) }}
                disabled={loading}
                style={{
                  flex: 1, padding: '0.65rem', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
                  color: '#F59E0B', fontSize: '0.82rem', fontWeight: 700,
                }}>
                Agregar al reporte
              </button>
            </div>
          </div>
        )}

        {error && error !== 'DUPLICADO' && (
          <div style={{
            padding: '0.85rem 1rem', borderRadius: 8, marginBottom: '1rem',
            background: 'rgba(255,42,42,0.08)', border: '1px solid rgba(255,42,42,0.3)',
          }}>
            <p style={{ color: '#FF2A2A', fontSize: '0.82rem', margin: 0 }}>
              {error === 'SIN_RED'
                ? '⚠ Sin conexión — revisá tu red e intentá de nuevo'
                : `Error: ${error}`}
            </p>
            {error === 'SIN_RED' && (
              <button
                onClick={() => handleSubmit()}
                style={{
                  marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                  background: 'none', border: 'none', color: '#F59E0B',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0,
                }}>
                <RefreshCw size={13} /> Reintentar
              </button>
            )}
          </div>
        )}

        {/* Nota de obligatoriedad */}
        <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem', textAlign: 'center', marginBottom: '0.6rem' }}>
          * Campos obligatorios para poder enviar el reporte
        </p>

        {/* Botón submit */}
        <button
          onClick={() => handleSubmit()}
          disabled={loading || !sedeId || !turno}
          style={{
            width: '100%', padding: '1rem', borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
            background: loading || !sedeId || !turno
              ? 'rgba(57,255,20,0.15)'
              : 'var(--phosphor)',
            color: loading || !sedeId || !turno ? 'rgba(57,255,20,0.4)' : '#0A0A0E',
            fontWeight: 800, fontSize: '1rem', border: 'none',
            transition: 'all 0.2s',
          }}>
          {loading ? 'Enviando...' : 'Enviar Reporte'}
        </button>

        <div style={{ height: '2rem' }} />
      </div>
    </div>
  )
}
