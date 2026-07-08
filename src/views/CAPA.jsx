import { useState, useEffect, useCallback } from 'react'
import { format, isPast, isToday, differenceInDays } from 'date-fns'
import { getCapa, createCapa, updateCapa, getNoConformidades, getSedes, getCapaPlan, upsertCapaPlan } from '../lib/queries'
import { Plus, X, RefreshCw, Columns, LayoutList, ClipboardList, FileDown, Pencil } from 'lucide-react'
import AdjuntosPanel from '../components/AdjuntosPanel'
import PageHeader from '../components/PageHeader'
import { uploadAdjunto } from '../lib/adjuntos'
import { useAuth } from '../lib/auth'
import { generarInformeCapaPDF } from '../lib/capaReportPdf'

const ESTADOS_CAPA = ['Pendiente','En ejecución','Completada','Verificada']
const TIPOS_CAPA   = ['Correctiva','Preventiva']

const COL_CONFIG = {
  'Pendiente':    { label:'Pendiente',    color:'rgba(255,255,255,0.2)', accent:'rgba(255,255,255,0.15)' },
  'En ejecución': { label:'En ejecución', color:'rgba(96,165,250,0.3)',  accent:'rgba(96,165,250,0.2)'  },
  'Completada':   { label:'Completada',   color:'rgba(250,204,21,0.3)',  accent:'rgba(250,204,21,0.2)'  },
  'Verificada':   { label:'Verificada',   color:'rgba(57,255,20,0.3)',   accent:'rgba(57,255,20,0.2)'   },
}

function vencimientoChip(fechaLimite, estado) {
  if (!fechaLimite || estado === 'Completada' || estado === 'Verificada') return null
  const d = new Date(fechaLimite)
  const diff = differenceInDays(d, new Date())
  if (isPast(d) && !isToday(d)) return <span className="chip chip-red" style={{ fontSize:'0.58rem' }}>Vencido</span>
  if (diff < 7) return <span className="chip chip-yellow" style={{ fontSize:'0.58rem' }}>&lt;7 días</span>
  return <span className="chip chip-green" style={{ fontSize:'0.58rem' }}>A tiempo</span>
}

function estadoChip(estado) {
  if (estado === 'Pendiente')    return <span className="chip chip-gray">{estado}</span>
  if (estado === 'En ejecución') return <span className="chip chip-blue">{estado}</span>
  if (estado === 'Completada')   return <span className="chip chip-yellow">{estado}</span>
  if (estado === 'Verificada')   return <span className="chip chip-green">{estado}</span>
  return <span className="chip chip-gray">{estado}</span>
}

function CAPAForm({ onClose, onCreated, noConformidades, sedes }) {
  const { user, perfil } = useAuth()
  const [loading, setLoading] = useState(false)
  const [archivos, setArchivos] = useState([])
  const [form, setForm] = useState({
    tipo: 'Correctiva', no_conformidad_id: '', descripcion: '',
    responsable: '', fecha_limite: '', estado: 'Pendiente', evidencia: '',
    sede_id: '', auditoria_codigo: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSedeChange = (sedeId) => {
    const sede = sedes.find(s => String(s.id) === String(sedeId))
    set('sede_id', sedeId)
    if (sede) set('sede_nombre', sede.nombre)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const created = await createCapa({
        ...form,
        sede_id: form.sede_id || null,
        no_conformidad_id: form.no_conformidad_id || null,
        fecha_limite: form.fecha_limite || null,
        evidencia: form.evidencia || null,
        auditoria_codigo: form.auditoria_codigo || null,
        created_by: perfil?.nombre || user?.email,
      })
      if (archivos.length > 0 && created?.id) {
        await Promise.all(archivos.map(f => uploadAdjunto('capa', created.id, f)))
      }
      onCreated()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass hud-corner fade-in w-full max-w-lg rounded" style={{ borderRadius:'3px', maxHeight:'90vh', overflowY:'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
          <h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Nueva Acción CAPA</h2>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ padding:'0.3rem' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Unidad / Sede *</label>
              <select required className="input-dark" value={form.sede_id} onChange={e => handleSedeChange(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Cód. Auditoría</label>
              <input className="input-dark" value={form.auditoria_codigo}
                onChange={e => set('auditoria_codigo', e.target.value)}
                placeholder="Ej: FK-AUD-HOS-001" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Tipo *</label>
              <select required className="input-dark" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPOS_CAPA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>No Conformidad</label>
              <select className="input-dark" value={form.no_conformidad_id} onChange={e => set('no_conformidad_id', e.target.value)}>
                <option value="">— Sin asociar —</option>
                {noConformidades.map(nc => (
                  <option key={nc.id} value={nc.id}>{nc.codigo} — {nc.descripcion?.slice(0,40)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Descripción *</label>
            <textarea required className="input-dark" rows={3} value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)} placeholder="Descripción de la acción..."
              style={{ resize:'vertical' }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Responsable</label>
              <input className="input-dark" value={form.responsable} onChange={e => set('responsable', e.target.value)} placeholder="Ej: Carlos Pérez" />
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Fecha límite</label>
              <input type="date" className="input-dark" value={form.fecha_limite} onChange={e => set('fecha_limite', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Evidencia (URL)</label>
            <input className="input-dark" value={form.evidencia} onChange={e => set('evidencia', e.target.value)} placeholder="Ej: https://drive.google.com/file/d/..." />
          </div>
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Evidencias (Fotos/Archivos)</label>
            <input type="file" multiple className="input-dark" style={{ padding:'0.4rem' }} onChange={e => setArchivos(Array.from(e.target.files || []))} />
          </div>
          <div className="flex justify-end gap-3 pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Crear acción'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CAPACardDetail({ c, canWrite, onEstadoChange, onClose, onReload }) {
  const [estado, setEstado]           = useState(c.estado)
  const [notas, setNotas]             = useState(c.notas || '')
  const [saving, setSaving]           = useState(false)
  const [savingNotas, setSavingNotas] = useState(false)
  const [savingEficacia, setSavingEficacia] = useState(false)
  const [notasSaved, setNotasSaved]   = useState(false)

  const handleSaveEstado = async () => {
    setSaving(true)
    try { await onEstadoChange(c.id, estado); onClose() }
    catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const handleSaveNotas = async () => {
    setSavingNotas(true)
    try {
      await updateCapa(c.id, { notas })
      c.notas = notas // evita que al reabrir la ficha (con la lista aún sin refrescar) se vea el valor viejo
      onReload?.()
      setNotasSaved(true)
      setTimeout(() => setNotasSaved(false), 2000)
    } catch (e) { alert(e.message) }
    finally { setSavingNotas(false) }
  }

  const handleToggleEficacia = async (checked) => {
    setSavingEficacia(true)
    try {
      const payload = {
        eficacia_verificada: checked,
        estado: checked ? 'Verificada' : (c.estado === 'Verificada' ? 'Completada' : c.estado),
        fecha_cierre: checked ? new Date().toISOString().split('T')[0] : c.fecha_cierre,
      }
      await updateCapa(c.id, payload)
      c.eficacia_verificada = checked
      c.estado = payload.estado
      c.fecha_cierre = payload.fecha_cierre
      setEstado(payload.estado)
      onReload?.()
    } catch (e) { alert(e.message) }
    finally { setSavingEficacia(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass hud-corner fade-in w-full max-w-md rounded" style={{ borderRadius:'3px', maxHeight:'92vh', overflowY:'auto' }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
          <div>
            <span className="font-metric text-xs" style={{ color:'var(--phosphor)' }}>{c.codigo}</span>
            {c.sede_nombre && (
              <span className="chip chip-gray" style={{ fontSize:'0.6rem', marginLeft:8 }}>{c.sede_nombre}</span>
            )}
            {c.auditoria_codigo && (
              <span style={{ fontSize:'0.6rem', color:'var(--text-dim)', marginLeft:6 }}>{c.auditoria_codigo}</span>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding:'0.25rem' }}><X size={13} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <span className={`chip ${c.tipo === 'Preventiva' ? 'chip-blue' : 'chip-yellow'}`} style={{ fontSize:'0.62rem' }}>{c.tipo}</span>
            {vencimientoChip(c.fecha_limite, c.estado)}
            {c.no_conformidades?.codigo && (
              <span className="chip chip-gray" style={{ fontSize:'0.6rem' }}>NC: {c.no_conformidades.codigo}</span>
            )}
          </div>

          <p style={{ color:'var(--text)', fontSize:'0.82rem', lineHeight:1.5 }}>{c.descripcion}</p>

          {c.responsable && (
            <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>
              <span style={{ color:'var(--phosphor)' }}>Responsable:</span> {c.responsable}
            </p>
          )}
          {c.fecha_limite && (
            <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>
              <span style={{ color:'var(--phosphor)' }}>Vencimiento:</span> {format(new Date(c.fecha_limite), 'dd/MM/yyyy')}
            </p>
          )}
          {c.evidencia && (
            <p style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>
              <span style={{ color:'var(--phosphor)' }}>Evidencia:</span>{' '}
              <a href={c.evidencia} target="_blank" rel="noreferrer" style={{ color:'#60A5FA' }}>{c.evidencia.slice(0,50)}…</a>
            </p>
          )}

          <div className="rounded px-3 py-2" style={{ background:'rgba(57,255,20,0.035)', border:'1px solid rgba(57,255,20,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
              <div>
                <p className="font-metric text-xs tracking-wider" style={{ color:'var(--phosphor)' }}>VERIFICACIÓN DE EFICACIA · ISO 9001 10.2</p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', marginTop:3 }}>
                  Marcar cuando Calidad verificó que la acción corrigió la causa y no volvió a repetirse.
                </p>
              </div>
              {canWrite ? (
                <label style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text)', fontSize:'0.72rem', cursor:'pointer' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(c.eficacia_verificada || c.estado === 'Verificada')}
                    disabled={savingEficacia}
                    onChange={e => handleToggleEficacia(e.target.checked)}
                  />
                  {savingEficacia ? 'Guardando...' : 'Eficacia verificada'}
                </label>
              ) : (
                <span className={`chip ${c.eficacia_verificada || c.estado === 'Verificada' ? 'chip-green' : 'chip-gray'}`} style={{ fontSize:'0.6rem' }}>
                  {c.eficacia_verificada || c.estado === 'Verificada' ? 'Verificada' : 'Pendiente'}
                </span>
              )}
            </div>
          </div>

          {/* Notas de avance */}
          <div className="pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>
              Notas de avance
            </label>
            {canWrite ? (
              <>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Registrá avances, observaciones, problemas encontrados..."
                  rows={4}
                  className="input-dark"
                  style={{ resize:'vertical', fontSize:'0.78rem', lineHeight:1.5, width:'100%' }}
                />
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
                  <button
                    onClick={handleSaveNotas}
                    disabled={savingNotas || notas === (c.notas || '')}
                    className="btn-ghost"
                    style={{
                      padding:'0.25rem 0.75rem', fontSize:'0.65rem',
                      color: notasSaved ? 'var(--phosphor)' : undefined,
                    }}
                  >
                    {savingNotas ? 'Guardando...' : notasSaved ? '✓ Guardado' : 'Guardar notas'}
                  </button>
                </div>
              </>
            ) : (
              notas
                ? <p style={{ color:'var(--text)', fontSize:'0.78rem', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{notas}</p>
                : <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', fontStyle:'italic' }}>Sin notas</p>
            )}
          </div>

          {/* Cambio de estado */}
          {canWrite && (
            <div className="pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Estado</label>
              <div className="flex gap-2">
                <select className="input-dark flex-1" value={estado} onChange={e => setEstado(e.target.value)}>
                  {ESTADOS_CAPA.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <button onClick={handleSaveEstado} disabled={saving || estado === c.estado} className="btn-primary">
                  {saving ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          <div className="pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <AdjuntosPanel entityType="capa" entityId={c.id} readOnly={!canWrite} />
          </div>
        </div>
      </div>
    </div>
  )
}

function CapaKanban({ items, canWrite, onEstadoChange, onReload, focusId }) {
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    if (focusId) setDetail(items.find(item => String(item.id) === String(focusId)) || null)
  }, [focusId, items])

  return (
    <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:8, minHeight:400 }}>
      {ESTADOS_CAPA.map(col => {
        const cfg = COL_CONFIG[col]
        const cards = items.filter(i => i.estado === col)
        return (
          <div key={col} style={{
            minWidth:240, flex:'1 1 240px',
            background:'var(--surface)', border:`1px solid ${cfg.color}`,
            borderRadius:4, display:'flex', flexDirection:'column',
          }}>
            <div style={{
              padding:'8px 12px', display:'flex', alignItems:'center', justifyContent:'space-between',
              borderBottom:`1px solid ${cfg.color}`, background: cfg.accent,
            }}>
              <span className="font-metric" style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.06em', color:'var(--text)' }}>
                {cfg.label.toUpperCase()}
              </span>
              <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'1px 7px', borderRadius:10, background:cfg.color, color:'var(--text)' }}>
                {cards.length}
              </span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:7 }}>
              {cards.map(c => {
                const vencida = c.fecha_limite && isPast(new Date(c.fecha_limite)) && !isToday(new Date(c.fecha_limite))
                  && c.estado !== 'Completada' && c.estado !== 'Verificada'
                return (
                  <div key={c.id}
                    onClick={() => setDetail(c)}
                    style={{
                      background: vencida ? 'rgba(255,42,42,0.06)' : 'rgba(255,255,255,0.03)',
                      border: vencida ? '1px solid rgba(255,42,42,0.25)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius:3, padding:'9px 10px', cursor:'pointer', transition:'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = vencida ? 'rgba(255,42,42,0.1)' : 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = vencida ? 'rgba(255,42,42,0.06)' : 'rgba(255,255,255,0.03)'}
                  >
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                      <span className="font-metric" style={{ fontSize:'0.6rem', color:'var(--phosphor)' }}>{c.codigo}</span>
                      <span className={`chip ${c.tipo === 'Preventiva' ? 'chip-blue' : 'chip-yellow'}`} style={{ fontSize:'0.55rem', padding:'1px 5px' }}>
                        {c.tipo.slice(0,4).toUpperCase()}
                      </span>
                    </div>
                    {c.sede_nombre && (
                      <p style={{ color:'var(--phosphor)', fontSize:'0.62rem', opacity:0.7, marginBottom:3 }}>{c.sede_nombre}</p>
                    )}
                    <p style={{
                      color:'var(--text)', fontSize:'0.72rem', lineHeight:1.4,
                      display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical',
                      overflow:'hidden', marginBottom:6,
                    }}>{c.descripcion}</p>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
                      {c.responsable
                        ? <span style={{ color:'var(--text-dim)', fontSize:'0.62rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:110 }}>{c.responsable}</span>
                        : <span />}
                      <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                        {vencida && <span className="chip chip-red" style={{ fontSize:'0.55rem', padding:'1px 4px' }}>⚠ VEN</span>}
                        {c.fecha_limite && !vencida && (
                          differenceInDays(new Date(c.fecha_limite), new Date()) < 7
                            ? <span className="chip chip-yellow" style={{ fontSize:'0.55rem', padding:'1px 4px' }}>&lt;7d</span>
                            : <span style={{ color:'var(--text-dim)', fontSize:'0.6rem' }}>{format(new Date(c.fecha_limite),'dd/MM')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {cards.length === 0 && (
                <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', textAlign:'center', padding:'20px 0' }}>Sin acciones</p>
              )}
            </div>
          </div>
        )
      })}
      {detail && (
        <CAPACardDetail
          c={detail} canWrite={canWrite}
          onEstadoChange={async (id, estado) => { await onEstadoChange(id, estado); onReload() }}
          onClose={() => setDetail(null)}
          onReload={onReload}
        />
      )}
    </div>
  )
}

function CapaPlanForm({ auditoriaCodigo, sedeId, sedeNombre, plan, onClose, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    empresa_prestataria: plan?.empresa_prestataria || '',
    responsable_comedor: plan?.responsable_comedor || '',
    elaboro: plan?.elaboro || '',
    fecha_auditoria: plan?.fecha_auditoria || '',
    objetivo: plan?.objetivo || '',
    alcance: plan?.alcance || '',
    cumplimiento_informado: plan?.cumplimiento_informado ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await upsertCapaPlan({
        auditoria_codigo: auditoriaCodigo,
        sede_id: sedeId || null,
        sede_nombre: sedeNombre || null,
        ...form,
        fecha_auditoria: form.fecha_auditoria || null,
        cumplimiento_informado: form.cumplimiento_informado === '' ? null : Number(form.cumplimiento_informado),
      })
      onSaved(saved)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass hud-corner fade-in w-full max-w-lg rounded" style={{ borderRadius:'3px', maxHeight:'90vh', overflowY:'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom:'1px solid rgba(57,255,20,0.08)' }}>
          <h2 className="font-title font-bold" style={{ color:'var(--text)' }}>Datos del plan — {auditoriaCodigo}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ padding:'0.3rem' }}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', lineHeight:1.5 }}>
            Estos datos se completan una vez por plan y se reutilizan cada vez que se descarga el informe PDF.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Empresa prestataria</label>
              <input className="input-dark" value={form.empresa_prestataria} onChange={e => set('empresa_prestataria', e.target.value)} placeholder="Ej: Flying Kitchen" />
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Responsable del comedor</label>
              <input className="input-dark" value={form.responsable_comedor} onChange={e => set('responsable_comedor', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Elaboró</label>
              <input className="input-dark" value={form.elaboro} onChange={e => set('elaboro', e.target.value)} />
            </div>
            <div>
              <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Fecha de auditoría</label>
              <input type="date" className="input-dark" value={form.fecha_auditoria} onChange={e => set('fecha_auditoria', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>% Cumplimiento informado</label>
            <input type="number" step="0.1" min="0" max="100" className="input-dark" value={form.cumplimiento_informado} onChange={e => set('cumplimiento_informado', e.target.value)} />
          </div>
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Objetivo</label>
            <textarea className="input-dark" rows={2} value={form.objetivo} onChange={e => set('objetivo', e.target.value)} style={{ resize:'vertical' }} />
          </div>
          <div>
            <label className="font-metric text-xs tracking-wider uppercase mb-1.5 block" style={{ color:'var(--text-dim)' }}>Alcance</label>
            <textarea className="input-dark" rows={2} value={form.alcance} onChange={e => set('alcance', e.target.value)} style={{ resize:'vertical' }} />
          </div>
          <div className="flex justify-end gap-3 pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.05)' }}>
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar datos'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CapaAuditoria({ items, canWrite, onEstadoChange, onReload, focusId }) {
  const [detail, setDetail] = useState(null)
  const [expandidos, setExpandidos] = useState({})
  const [planes, setPlanes] = useState({})
  const [editingPlan, setEditingPlan] = useState(null)
  const [generando, setGenerando] = useState(null)

  useEffect(() => {
    if (focusId) setDetail(items.find(item => String(item.id) === String(focusId)) || null)
  }, [focusId, items])

  // Agrupar por auditoria_codigo + sede
  const grupos = {}
  items.forEach(c => {
    const key = c.auditoria_codigo || `__sin__${c.sede_nombre}`
    if (!grupos[key]) grupos[key] = {
      auditoria_codigo: c.auditoria_codigo,
      sede_nombre: c.sede_nombre,
      sede_id: c.sede_id,
      items: [],
    }
    grupos[key].items.push(c)
  })

  const toggleExpand = (key) => setExpandidos(e => ({ ...e, [key]: !e[key] }))

  const ensurePlan = async (codigo) => {
    if (!codigo) return null
    if (planes[codigo] !== undefined) return planes[codigo]
    try {
      const p = await getCapaPlan(codigo)
      setPlanes(prev => ({ ...prev, [codigo]: p }))
      return p
    } catch (e) {
      console.error(e)
      return null
    }
  }

  const handleDescargarInforme = async (grupo) => {
    const key = grupo.auditoria_codigo || `__sin__${grupo.sede_nombre}`
    setGenerando(key)
    try {
      const plan = grupo.auditoria_codigo ? await ensurePlan(grupo.auditoria_codigo) : null
      await generarInformeCapaPDF({ grupo, plan })
    } catch (e) {
      alert('Error generando el informe: ' + e.message)
    } finally {
      setGenerando(null)
    }
  }

  const handleEditarPlan = async (grupo) => {
    const plan = await ensurePlan(grupo.auditoria_codigo)
    setEditingPlan({ grupo, plan })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {Object.entries(grupos).map(([key, grupo]) => {
        const total = grupo.items.length
        const cerradas = grupo.items.filter(i => ['Completada','Verificada'].includes(i.estado)).length
        const pct = total > 0 ? Math.round(cerradas / total * 100) : 0
        const vencidas = grupo.items.filter(i =>
          i.fecha_limite && isPast(new Date(i.fecha_limite)) && !isToday(new Date(i.fecha_limite))
          && !['Completada','Verificada'].includes(i.estado)
        ).length
        const expanded = expandidos[key] !== false // expanded by default

        const pctColor = pct === 100 ? 'var(--phosphor)' : pct >= 50 ? '#60a5fa' : 'var(--warn)'

        return (
          <div key={key} className="glass rounded" style={{ borderRadius:3, overflow:'hidden' }}>
            {/* Header del plan */}
            <div
              onClick={() => toggleExpand(key)}
              style={{
                padding:'12px 16px', cursor:'pointer',
                borderBottom: expanded ? '1px solid rgba(57,255,20,0.08)' : 'none',
                display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
              }}
            >
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span className="font-metric" style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--phosphor)' }}>
                    {grupo.auditoria_codigo || 'Sin código de auditoría'}
                  </span>
                  <span style={{ fontSize:'0.7rem', color:'var(--text-dim)' }}>· {grupo.sede_nombre}</span>
                  {vencidas > 0 && (
                    <span className="chip chip-red" style={{ fontSize:'0.55rem' }}>⚠ {vencidas} vencida{vencidas > 1 ? 's' : ''}</span>
                  )}
                </div>
                <span style={{ fontSize:'0.65rem', color:'var(--text-dim)' }}>
                  {cerradas} de {total} completadas
                </span>
              </div>

              {/* Barra de progreso */}
              <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:160 }}>
                <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.08)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{
                    width:`${pct}%`, height:'100%', borderRadius:3,
                    background: pctColor,
                    boxShadow: pct === 100 ? `0 0 6px var(--phosphor)` : undefined,
                    transition:'width 0.4s ease',
                  }} />
                </div>
                <span className="font-metric" style={{ fontSize:'0.78rem', fontWeight:700, color: pctColor, minWidth:34, textAlign:'right' }}>
                  {pct}%
                </span>
              </div>

              {/* Chips de estado */}
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                {ESTADOS_CAPA.map(est => {
                  const cnt = grupo.items.filter(i => i.estado === est).length
                  if (cnt === 0) return null
                  return (
                    <span key={est} style={{
                      fontSize:'0.58rem', padding:'2px 6px', borderRadius:3, fontWeight:600,
                      background: est === 'Verificada' ? 'rgba(57,255,20,0.15)' : est === 'Completada' ? 'rgba(250,204,21,0.15)' : est === 'En ejecución' ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.1)',
                      color: est === 'Verificada' ? 'var(--phosphor)' : est === 'Completada' ? '#facc15' : est === 'En ejecución' ? '#60a5fa' : 'var(--text-dim)',
                    }}>
                      {cnt} {est === 'En ejecución' ? 'En ej.' : est}
                    </span>
                  )
                })}
              </div>

              {/* Acciones del plan: editar metadatos + descargar informe */}
              <div style={{ display:'flex', gap:5, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                {canWrite && grupo.auditoria_codigo && (
                  <button onClick={() => handleEditarPlan(grupo)} className="btn-ghost flex items-center gap-1"
                    style={{ padding:'0.25rem 0.5rem', fontSize:'0.62rem' }} title="Datos del plan (cabecera del informe)">
                    <Pencil size={11} /> Datos del plan
                  </button>
                )}
                <button onClick={() => handleDescargarInforme(grupo)}
                  disabled={generando === (grupo.auditoria_codigo || `__sin__${grupo.sede_nombre}`)}
                  className="btn-ghost flex items-center gap-1" style={{ padding:'0.25rem 0.5rem', fontSize:'0.62rem' }}
                  title="Descargar informe PDF de avance y evidencia">
                  <FileDown size={11} />
                  {generando === (grupo.auditoria_codigo || `__sin__${grupo.sede_nombre}`) ? 'Generando...' : 'Informe PDF'}
                </button>
              </div>

              <span style={{ color:'var(--text-dim)', fontSize:'0.7rem', flexShrink:0 }}>{expanded ? '▲' : '▼'}</span>
            </div>

            {/* Lista de CAPAs */}
            {expanded && (
              <div style={{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:3 }}>
                {/* Header columnas */}
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 10px', marginBottom:2 }}>
                  <span className="font-metric" style={{ fontSize:'0.58rem', color:'rgba(57,255,20,0.4)', minWidth:90, letterSpacing:'0.08em' }}>CÓDIGO</span>
                  <span className="font-metric" style={{ fontSize:'0.58rem', color:'rgba(57,255,20,0.4)', flex:1, letterSpacing:'0.08em' }}>DESCRIPCIÓN</span>
                  <span className="font-metric" style={{ fontSize:'0.58rem', color:'rgba(57,255,20,0.4)', minWidth:90, textAlign:'right', letterSpacing:'0.08em' }}>RESPONSABLE</span>
                  <span className="font-metric" style={{ fontSize:'0.58rem', color:'rgba(57,255,20,0.4)', minWidth:50, textAlign:'right', letterSpacing:'0.08em' }}>VENCE</span>
                  <span className="font-metric" style={{ fontSize:'0.58rem', color:'rgba(57,255,20,0.4)', minWidth:90, textAlign:'right', letterSpacing:'0.08em' }}>ESTADO</span>
                </div>
                {grupo.items.map(c => {
                  const vencida = c.fecha_limite && isPast(new Date(c.fecha_limite)) && !isToday(new Date(c.fecha_limite))
                    && !['Completada','Verificada'].includes(c.estado)
                  return (
                    <div key={c.id}
                      onClick={() => setDetail(c)}
                      style={{
                        display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                        background: vencida ? 'rgba(255,42,42,0.05)' : 'rgba(255,255,255,0.02)',
                        border: vencida ? '1px solid rgba(255,42,42,0.18)' : '1px solid rgba(255,255,255,0.04)',
                        borderRadius:3, cursor:'pointer', transition:'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = vencida ? 'rgba(255,42,42,0.09)' : 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = vencida ? 'rgba(255,42,42,0.05)' : 'rgba(255,255,255,0.02)'}
                    >
                      <span className="font-metric" style={{ fontSize:'0.62rem', color:'var(--phosphor)', minWidth:90 }}>{c.codigo}</span>
                      <p style={{ flex:1, fontSize:'0.72rem', color:'var(--text)', lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>
                        {c.descripcion}
                      </p>
                      <span style={{ fontSize:'0.62rem', color:'var(--text-dim)', minWidth:90, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {c.responsable || '—'}
                      </span>
                      <span style={{ fontSize:'0.62rem', color: vencida ? 'var(--alert)' : 'var(--text-dim)', minWidth:50, textAlign:'right', flexShrink:0 }}>
                        {c.fecha_limite ? format(new Date(c.fecha_limite), 'dd/MM') : '—'}
                      </span>
                      <div style={{ minWidth:90, textAlign:'right', flexShrink:0 }}>{estadoChip(c.estado)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {detail && (
        <CAPACardDetail
          c={detail} canWrite={canWrite}
          onEstadoChange={async (id, estado) => { await onEstadoChange(id, estado); onReload() }}
          onClose={() => setDetail(null)}
          onReload={onReload}
        />
      )}

      {editingPlan && (
        <CapaPlanForm
          auditoriaCodigo={editingPlan.grupo.auditoria_codigo}
          sedeId={editingPlan.grupo.sede_id}
          sedeNombre={editingPlan.grupo.sede_nombre}
          plan={editingPlan.plan}
          onClose={() => setEditingPlan(null)}
          onSaved={(saved) => {
            setPlanes(prev => ({ ...prev, [editingPlan.grupo.auditoria_codigo]: saved }))
            setEditingPlan(null)
          }}
        />
      )}
    </div>
  )
}

export default function CAPA({ focusId }) {
  const { allowedSedeIds, can } = useAuth()
  const [items, setItems]     = useState([])
  const [ncs, setNcs]         = useState([])
  const [sedes, setSedes]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtroTipo, setFiltroTipo]             = useState('')
  const [filtroEstado, setFiltroEstado]         = useState('')
  const [filtroResp, setFiltroResp]             = useState('')
  const [filtroSede, setFiltroSede]             = useState('')
  const [filtroAuditoria, setFiltroAuditoria]   = useState('')
  const [editingId, setEditingId]               = useState(null)
  const [editEstado, setEditEstado]             = useState('')
  const [vista, setVista]                       = useState('auditoria')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, ncData, sedesData] = await Promise.all([
        getCapa({
          sedeIds: allowedSedeIds || undefined,
          tipo: filtroTipo || undefined,
          estado: filtroEstado || undefined,
          responsable: filtroResp || undefined,
          sede_id: filtroSede || undefined,
          auditoria_codigo: filtroAuditoria || undefined,
        }),
        getNoConformidades({ estado: 'Abierta', sedeIds: allowedSedeIds || undefined }),
        getSedes(allowedSedeIds),
      ])
      const hasSedeScope = Array.isArray(allowedSedeIds) && allowedSedeIds.length > 0
      const dataFilt = hasSedeScope
        ? data.filter(item => allowedSedeIds.includes(item.sede_id))
        : data
      const sedesFilt = hasSedeScope
        ? sedesData.filter(s => allowedSedeIds.includes(s.id))
        : sedesData
      setItems(dataFilt); setNcs(ncData); setSedes(sedesFilt)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filtroTipo, filtroEstado, filtroResp, filtroSede, filtroAuditoria, allowedSedeIds])

  useEffect(() => { load() }, [load])

  // Si el usuario tiene una sola sede asignada (ej: encargado), queda preseleccionada
  useEffect(() => { if (allowedSedeIds?.length === 1) setFiltroSede(String(allowedSedeIds[0])) }, [allowedSedeIds])

  const canWrite = can('calidad', 'manage')

  const saveEstado = async (id, nuevoEstado) => {
    await updateCapa(id, {
      estado: nuevoEstado,
      fecha_cierre: nuevoEstado === 'Completada' || nuevoEstado === 'Verificada' ? format(new Date(), 'yyyy-MM-dd') : null,
      eficacia_verificada: nuevoEstado === 'Verificada',
    })
    setEditingId(null); load()
  }

  const pendientes  = items.filter(i => i.estado === 'Pendiente').length
  const enEjecucion = items.filter(i => i.estado === 'En ejecución').length
  const completadas = items.filter(i => i.estado === 'Completada' || i.estado === 'Verificada').length
  const vencidas    = items.filter(i => i.fecha_limite && isPast(new Date(i.fecha_limite)) && !isToday(new Date(i.fecha_limite)) && i.estado !== 'Completada' && i.estado !== 'Verificada').length

  const sedesConPlan = [...new Map(items.filter(i => i.sede_id).map(i => [i.sede_id, { id: i.sede_id, nombre: i.sede_nombre }])).values()]
  const auditorias   = [...new Set(items.map(i => i.auditoria_codigo).filter(Boolean))]

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      <PageHeader title="CAPA" subtitle={<>
        Acciones Correctivas y Preventivas · ISO 9001
        {filtroAuditoria && (
          <span style={{ color:'var(--phosphor)', marginLeft:6 }}>— {filtroAuditoria}</span>
        )}
        {!filtroAuditoria && filtroSede && sedes.find(s => String(s.id) === String(filtroSede)) && (
          <span style={{ color:'var(--phosphor)', marginLeft:6 }}>
            — {sedes.find(s => String(s.id) === String(filtroSede))?.nombre}
          </span>
        )}
      </>}>
        <div className="flex gap-2 flex-wrap">
          <div style={{ display:'flex', border:'1px solid rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' }}>
            {[
              { key:'auditoria', icon:<ClipboardList size={12} />, label:'Por auditoría' },
              { key:'kanban',    icon:<Columns size={12} />,       label:'Kanban'        },
              { key:'tabla',     icon:<LayoutList size={12} />,    label:'Tabla'         },
            ].map((v, i) => (
              <button key={v.key} onClick={() => setVista(v.key)} title={v.label} style={{
                padding:'0.3rem 0.6rem', display:'flex', alignItems:'center', gap:4,
                background: vista === v.key ? 'rgba(57,255,20,0.12)' : 'transparent',
                color: vista === v.key ? 'var(--phosphor)' : 'var(--text-dim)',
                border:'none', cursor:'pointer', fontSize:'0.68rem', fontWeight:600,
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}>{v.icon} {v.label}</button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost flex items-center gap-1.5" style={{ padding:'0.35rem 0.75rem' }}>
            <RefreshCw size={11} /> Actualizar
          </button>
          {canWrite && (
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5">
              <Plus size={12} /> Nueva acción
            </button>
          )}
        </div>
      </PageHeader>

      {!loading && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="kpi-card"><p className="kpi-value" style={{ color:'var(--warn)' }}>{pendientes}</p><p className="kpi-label">Pendientes</p></div>
          <div className="kpi-card"><p className="kpi-value" style={{ color:'#60A5FA' }}>{enEjecucion}</p><p className="kpi-label">En ejecución</p></div>
          <div className="kpi-card"><p className="kpi-value">{completadas}</p><p className="kpi-label">Completadas</p></div>
          <div className="kpi-card" style={{ borderColor: vencidas > 0 ? 'rgba(255,42,42,0.3)' : undefined }}>
            <p className="kpi-value" style={{ color: vencidas > 0 ? 'var(--alert)' : 'var(--phosphor)' }}>{vencidas}</p>
            <p className="kpi-label">Vencidas</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="glass rounded p-3 flex flex-wrap gap-3" style={{ borderRadius:'3px' }}>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--phosphor)', opacity:0.8 }}>Auditoría / Plan CAPA</label>
          <select className="input-dark" style={{ minWidth:170 }} value={filtroAuditoria} onChange={e => setFiltroAuditoria(e.target.value)}>
            <option value="">Todas</option>
            {auditorias.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Sede</label>
          <select className="input-dark" style={{ minWidth:160 }} value={filtroSede} onChange={e => setFiltroSede(e.target.value)}>
            <option value="">Todas</option>
            {sedesConPlan.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Tipo</label>
          <select className="input-dark" style={{ minWidth:120 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS_CAPA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Estado</label>
          <select className="input-dark" style={{ minWidth:120 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_CAPA.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="font-metric text-xs tracking-wider uppercase mb-1 block" style={{ color:'var(--text-dim)' }}>Responsable</label>
          <input className="input-dark" style={{ minWidth:120 }} value={filtroResp} onChange={e => setFiltroResp(e.target.value)} placeholder="Ej: Carlos Pérez" />
        </div>
        <button onClick={() => { setFiltroTipo(''); setFiltroEstado(''); setFiltroResp(''); setFiltroSede(''); setFiltroAuditoria('') }}
          className="btn-ghost self-end" style={{ padding:'0.35rem 0.75rem' }}>Limpiar</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : vista === 'auditoria' ? (
        <CapaAuditoria items={items} canWrite={canWrite} onEstadoChange={saveEstado} onReload={load} focusId={focusId} />
      ) : vista === 'kanban' ? (
        <CapaKanban items={items} canWrite={canWrite} onEstadoChange={saveEstado} onReload={load} focusId={focusId} />
      ) : (
        <div className="glass rounded overflow-hidden" style={{ borderRadius:'3px' }}>
          <div className="overflow-x-auto">
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Sede</th>
                  <th>Descripción</th>
                  <th className="hidden md:table-cell">NC asociada</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th className="hidden lg:table-cell">Responsable</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => (
                  <tr key={c.id}>
                    <td><span className="font-metric text-xs" style={{ color:'var(--phosphor)' }}>{c.codigo}</span></td>
                    <td><span className={`chip ${c.tipo === 'Preventiva' ? 'chip-blue' : 'chip-yellow'}`} style={{ fontSize:'0.6rem' }}>{c.tipo}</span></td>
                    <td><span style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{c.sede_nombre || '—'}</span></td>
                    <td>
                      <p style={{ color:'var(--text)', fontSize:'0.78rem', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                        title={c.descripcion}>{c.descripcion}</p>
                    </td>
                    <td className="hidden md:table-cell">
                      <span className="font-metric" style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>{c.no_conformidades?.codigo || '—'}</span>
                    </td>
                    <td>
                      {editingId === c.id ? (
                        <div className="flex items-center gap-1">
                          <select className="input-dark" style={{ width:130, fontSize:'0.7rem', padding:'0.2rem 0.4rem' }}
                            value={editEstado} onChange={e => setEditEstado(e.target.value)}>
                            {ESTADOS_CAPA.map(e => <option key={e} value={e}>{e}</option>)}
                          </select>
                          <button onClick={() => saveEstado(c.id, editEstado)} className="btn-primary" style={{ padding:'0.2rem 0.4rem', fontSize:'0.6rem' }}>✓</button>
                          <button onClick={() => setEditingId(null)} className="btn-ghost" style={{ padding:'0.2rem 0.4rem', fontSize:'0.6rem' }}>✕</button>
                        </div>
                      ) : estadoChip(c.estado)}
                    </td>
                    <td>{vencimientoChip(c.fecha_limite, c.estado) || estadoChip(c.estado)}</td>
                    <td className="hidden lg:table-cell" style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{c.responsable || '—'}</td>
                    <td>
                      {canWrite && editingId !== c.id && (
                        <button onClick={() => { setEditingId(c.id); setEditEstado(c.estado) }}
                          className="btn-ghost" style={{ padding:'0.2rem 0.5rem', fontSize:'0.62rem' }}>Editar</button>
                      )}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-10" style={{ color:'var(--text-dim)' }}>Sin acciones CAPA registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <CAPAForm
          noConformidades={ncs} sedes={sedes}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}
