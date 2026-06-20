import { useState, useEffect, useCallback } from 'react'
import { getPerfiles, upsertPerfil } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { RefreshCw, Check, X as XIcon, UserPlus, Mail, Trash2, KeyRound } from 'lucide-react'
import { useAuth } from '../lib/auth'

const ROLES = ['admin','editor','encargado','consultor','grupo','sede']
const ROL_LABEL = { admin: 'Admin', editor: 'Editor', encargado: 'Encargado', consultor: 'Consultor', grupo: 'Grupo', sede: 'Sede' }

function rolChip(rol) {
  const label = ROL_LABEL[rol] || rol
  if (rol === 'admin')      return <span className="chip chip-red">{label}</span>
  if (rol === 'encargado')  return <span className="chip chip-yellow">{label}</span>
  if (rol === 'editor')     return <span className="chip chip-blue">{label}</span>
  return <span className="chip chip-gray">{label}</span>
}

function NuevoUsuarioModal({ onClose, onCreated }) {
  const [modo, setModo] = useState('invitar')
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '', rol: 'editor', activo: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleInvitar = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.email) { setError('Nombre y email son obligatorios.'); return }
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ email: form.email, nombre: form.nombre, rol: form.rol, telefono: form.telefono })
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al enviar invitacion')
      setOk(true)
      setTimeout(() => { onCreated(); onClose() }, 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleManual = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.email || !form.password) {
      setError('Nombre, email y contrasena son obligatorios.')
      return
    }
    setLoading(true); setError(null)
    try {
      const { data, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { nombre: form.nombre } }
      })
      if (authErr) throw authErr
      const userId = data?.user?.id
      if (!userId) throw new Error('No se pudo obtener el ID del usuario creado.')
      await upsertPerfil({
        id: userId,
        email: form.email,
        nombre: form.nombre,
        telefono: form.telefono || null,
        rol: form.rol,
        activo: form.activo,
      })
      onCreated(); onClose()
    } catch (err) {
      setError(err.message || 'Error al crear usuario.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 50 }}>
      <div className="glass rounded p-6 w-full max-w-md fade-in" style={{
        background: 'var(--surface)', border: '1px solid rgba(57,255,20,0.15)', borderRadius: 4
      }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-title font-bold" style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
            Nuevo Usuario
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '0.2rem 0.4rem' }}>
            <XIcon size={14} />
          </button>
        </div>

        <div className="flex gap-1 mb-4 p-1 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {[['invitar','Invitar por email'],['manual','Crear con contrasena']].map(([m, label]) => (
            <button key={m} type="button" onClick={() => { setModo(m); setError(null); setOk(false) }}
              className="flex-1 font-metric text-xs py-1.5 rounded transition-all"
              style={{
                fontSize: '0.7rem',
                background: modo === m ? 'var(--phosphor)' : 'transparent',
                color: modo === m ? '#0A0A0E' : 'var(--text-dim)',
                fontWeight: modo === m ? 700 : 400,
              }}>
              {label}
            </button>
          ))}
        </div>

        {ok ? (
          <div className="text-center py-4">
            <p className="font-metric" style={{ color: 'var(--phosphor)', fontSize: '0.8rem' }}>
              Invitacion enviada a {form.email}
            </p>
            <p className="font-metric mt-1" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
              El usuario recibira un link para crear su contrasena.
            </p>
          </div>
        ) : (
          <form onSubmit={modo === 'invitar' ? handleInvitar : handleManual} className="space-y-3">
            <div>
              <label className="font-metric text-xs mb-1 block" style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>NOMBRE COMPLETO *</label>
              <input className="input-dark w-full" placeholder="Ej: Benjamin Torres" required
                value={form.nombre} onChange={e => set('nombre', e.target.value)} />
            </div>
            <div>
              <label className="font-metric text-xs mb-1 block" style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>EMAIL *</label>
              <input className="input-dark w-full" type="email" placeholder="Ej: juan.perez@flykitchen.com" required
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="font-metric text-xs mb-1 block" style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>TELEFONO (opcional)</label>
              <input className="input-dark w-full" type="tel" placeholder="Ej: 5491112345678"
                value={form.telefono} onChange={e => set('telefono', e.target.value)} />
            </div>
            {modo === 'manual' && (
              <div>
                <label className="font-metric text-xs mb-1 block" style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>CONTRASENA TEMPORAL *</label>
                <input className="input-dark w-full" type="password" placeholder="Minimo 6 caracteres" required
                  value={form.password} onChange={e => set('password', e.target.value)} />
              </div>
            )}
            <div>
              <label className="font-metric text-xs mb-1 block" style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>ROL</label>
              <select className="input-dark w-full" value={form.rol} onChange={e => set('rol', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {error && (
              <p className="font-metric text-xs" style={{ color: 'var(--alert)', fontSize: '0.7rem' }}>{error}</p>
            )}

            {modo === 'invitar' && (
              <p className="font-metric" style={{ color: 'var(--text-dim)', fontSize: '0.63rem', lineHeight: 1.5 }}>
                Se enviara un email con un link. El usuario elige su propia contrasena y entra directo a la app.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? '...' : modo === 'invitar' ? 'Enviar invitacion' : 'Crear usuario'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { perfil: perfilActual } = useAuth()
  const [perfiles, setPerfiles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData]   = useState({})
  const [saving, setSaving]       = useState(false)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setPerfiles(await getPerfiles()) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (p) => {
    setEditingId(p.id)
    setEditData({ rol: p.rol, activo: p.activo, telefono: p.telefono || '' })
  }

  const cancelEdit = () => { setEditingId(null); setEditData({}) }

  const saveEdit = async (p) => {
    setSaving(true)
    try {
      await upsertPerfil({ ...p, ...editData, telefono: editData.telefono || null })
      setEditingId(null)
      load()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  const [actionLoading, setActionLoading] = useState(null) // userId siendo procesado

  const adminAction = async (action, p) => {
    const msgs = {
      reset_password: `¿Enviar email de recuperación de contraseña a ${p.email}?`,
      resend_invite:  `¿Reenviar invitación a ${p.email}?`,
      delete_user:    `⚠ ¿Eliminar permanentemente a ${p.nombre || p.email}? Esta acción no se puede deshacer.`,
    }
    if (!confirm(msgs[action])) return
    setActionLoading(p.id + action)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action, userId: p.id, email: p.email }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error + (json.debug ? ' | debug: ' + JSON.stringify(json.debug) : ''))
      alert(json.message || 'Listo')
      if (action === 'delete_user') load()
    } catch (e) { alert('Error: ' + e.message) }
    finally { setActionLoading(null) }
  }

  const activos   = perfiles.filter(p => p.activo).length
  const inactivos = perfiles.filter(p => !p.activo).length

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 fade-in">
      {showModal && (
        <NuevoUsuarioModal onClose={() => setShowModal(false)} onCreated={load} />
      )}

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>Usuarios</h1>
          <p className="font-metric text-xs mt-0.5" style={{ color:'var(--text-dim)' }}>
            Gestion de perfiles y roles
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5"
            style={{ padding:'0.35rem 0.75rem', fontSize:'0.72rem' }}>
            <UserPlus size={12} /> Nuevo Usuario
          </button>
          <button onClick={load} className="btn-ghost flex items-center gap-1.5"
            style={{ padding:'0.35rem 0.75rem' }}>
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="kpi-card"><p className="kpi-value">{perfiles.length}</p><p className="kpi-label">Total</p></div>
          <div className="kpi-card"><p className="kpi-value">{activos}</p><p className="kpi-label">Activos</p></div>
          <div className="kpi-card" style={{ borderColor: inactivos > 0 ? 'rgba(245,158,11,0.2)' : undefined }}>
            <p className="kpi-value" style={{ color: inactivos > 0 ? 'var(--warn)' : 'var(--phosphor)' }}>{inactivos}</p>
            <p className="kpi-label">Inactivos</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }} />
        </div>
      ) : (
        <div className="glass rounded overflow-hidden" style={{ borderRadius:'3px' }}>
          <div className="overflow-x-auto">
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Telefono</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {perfiles.map(p => {
                  const isEditing = editingId === p.id
                  const esMiPerfil = p.id === perfilActual?.id
                  return (
                    <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.5 }}>
                      <td>
                        <p style={{ color:'var(--text)', fontWeight:500, fontSize:'0.82rem' }}>{p.nombre || '—'}</p>
                        {esMiPerfil && (
                          <span className="chip chip-green" style={{ fontSize:'0.55rem', marginTop:2 }}>Yo</span>
                        )}
                      </td>
                      <td style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{p.email}</td>
                      <td>
                        {isEditing ? (
                          <input className="input-dark" style={{ maxWidth:140, fontSize:'0.72rem', padding:'0.25rem 0.4rem' }}
                            placeholder="Ej: 5491112345678" value={editData.telefono}
                            onChange={e => setEditData(d => ({ ...d, telefono: e.target.value }))} />
                        ) : (
                          <span style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>{p.telefono || '—'}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select className="input-dark" style={{ maxWidth:140, fontSize:'0.72rem', padding:'0.25rem 0.4rem' }}
                            value={editData.rol} onChange={e => setEditData(d => ({ ...d, rol: e.target.value }))}>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : rolChip(p.rol)}
                      </td>
                      <td>
                        {isEditing ? (
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={editData.activo}
                              onChange={e => setEditData(d => ({ ...d, activo: e.target.checked }))}
                              style={{ accentColor:'var(--phosphor)' }} />
                            <span className="font-metric text-xs" style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>
                              {editData.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </label>
                        ) : (
                          p.activo
                            ? <span className="chip chip-green">Activo</span>
                            : <span className="chip chip-gray">Inactivo</span>
                        )}
                      </td>
                      <td>
                        {perfilActual?.rol?.toLowerCase() === 'admin' && (
                          <div className="flex items-center gap-1" style={{ flexWrap:'wrap' }}>
                            {isEditing ? (
                              <>
                                <button onClick={() => saveEdit(p)} disabled={saving}
                                  className="btn-primary" style={{ padding:'0.25rem 0.5rem', fontSize:'0.65rem' }}>
                                  {saving ? '...' : <Check size={11} />}
                                </button>
                                <button onClick={cancelEdit} className="btn-ghost" style={{ padding:'0.25rem 0.5rem' }}>
                                  <XIcon size={11} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => startEdit(p)} className="btn-ghost"
                                style={{ padding:'0.2rem 0.45rem', fontSize:'0.65rem' }}>
                                Editar
                              </button>
                            )}
                            {!isEditing && (
                              <>
                                <button
                                  title="Enviar reset de contraseña"
                                  onClick={() => adminAction('reset_password', p)}
                                  disabled={actionLoading === p.id + 'reset_password'}
                                  className="btn-ghost"
                                  style={{ padding:'0.2rem 0.45rem', display:'flex', alignItems:'center', gap:3, fontSize:'0.65rem', color:'#60A5FA' }}>
                                  <KeyRound size={11} />
                                </button>
                                <button
                                  title="Reenviar invitación"
                                  onClick={() => adminAction('resend_invite', p)}
                                  disabled={actionLoading === p.id + 'resend_invite'}
                                  className="btn-ghost"
                                  style={{ padding:'0.2rem 0.45rem', display:'flex', alignItems:'center', gap:3, fontSize:'0.65rem', color:'var(--phosphor)' }}>
                                  <Mail size={11} />
                                </button>
                                {!esMiPerfil && (
                                  <button
                                    title="Eliminar usuario"
                                    onClick={() => adminAction('delete_user', p)}
                                    disabled={actionLoading === p.id + 'delete_user'}
                                    className="btn-ghost"
                                    style={{ padding:'0.2rem 0.45rem', display:'flex', alignItems:'center', gap:3, fontSize:'0.65rem', color:'var(--alert)' }}>
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
