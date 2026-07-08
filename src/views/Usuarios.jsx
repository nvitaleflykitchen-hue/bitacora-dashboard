import { useState, useEffect, useCallback } from 'react'
import { getPerfilesConDirectorio, upsertPerfil, getGrupos, getSedes } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { RefreshCw, Check, X as XIcon, UserPlus, Mail, Trash2, KeyRound } from 'lucide-react'
import { useAuth } from '../lib/auth'
import PageHeader from '../components/PageHeader'

const ROLES = ['admin','editor','encargado','consultor','grupo','sede','operario','flota','mnt_editor']
const ROL_LABEL = { admin: 'Admin', editor: 'Editor', encargado: 'Encargado', consultor: 'Consultor', grupo: 'Grupo', sede: 'Sede', operario: 'Operario', flota: 'Flota', mnt_editor: 'Gestión Mantenimiento' }

function rolChip(rol) {
  const label = ROL_LABEL[rol] || rol
  if (rol === 'admin')      return <span className="chip chip-red">{label}</span>
  if (rol === 'encargado')  return <span className="chip chip-yellow">{label}</span>
  if (rol === 'editor')     return <span className="chip chip-blue">{label}</span>
  return <span className="chip chip-gray">{label}</span>
}

function NuevoUsuarioModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', rol: 'editor' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const verifyPerfilCreado = async (email) => {
    const normalized = String(email || '').trim().toLowerCase()
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase
        .schema('bitacora')
        .from('perfiles')
        .select('id,email,rol,activo')
        .ilike('email', normalized)
        .maybeSingle()
      if (data?.id) return data
      if (error && error.code !== 'PGRST116') throw error
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    return null
  }

  const handleInvitar = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.email) { setError('Nombre y email son obligatorios.'); return }
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-direct`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ email: form.email, nombre: form.nombre, rol: form.rol, telefono: form.telefono })
        }
      )
      const raw = await res.text()
      let json = {}
      try { json = raw ? JSON.parse(raw) : {} } catch { /* respuesta no JSON */ }
      if (!res.ok) {
        let detail = json.error || json.message || raw || `Error HTTP ${res.status}`
        if (typeof detail === 'string' && detail.includes('already been registered')) {
          detail = 'Este email ya pertenece a un usuario registrado. Buscalo en la lista y editá su perfil en lugar de crear uno nuevo.'
        }
        throw new Error(detail)
      }
      let perfilCreado = await verifyPerfilCreado(form.email)
      if (!perfilCreado) {
        // Fallback: Si la edge function falló en crear el perfil (ej. por problema de esquema o RLS),
        // intentamos crearlo desde el frontend si nos devolvió el ID del usuario de Auth.
        const userId = json?.data?.user?.id || json?.user?.id || json?.id;
        if (userId) {
          const { data: newPerfil, error: insertError } = await supabase
            .schema('bitacora')
            .from('perfiles')
            .insert({
              id: userId,
              email: form.email,
              nombre: form.nombre,
              rol: form.rol,
              telefono: form.telefono || null,
              activo: true
            })
            .select()
            .maybeSingle()
            
          if (newPerfil) perfilCreado = newPerfil
          else console.error("Error fallback insert perfil:", insertError)
        }
      }
      
      if (!perfilCreado) {
        throw new Error(`La invitacion fue aceptada, pero no se creo el perfil. Edge fn response: ${JSON.stringify(json).substring(0, 100)}...`)
      }
      setOk(true)
      onCreated() // Refresca la tabla por detrás, pero deja el modal abierto
    } catch (err) {
      setError(err.message)
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

        <div className="mb-4 p-3 rounded" style={{ background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.12)' }}>
          <p className="font-metric" style={{ color: 'var(--text)', fontSize: '0.7rem' }}>Alta directa (sin envio de email)</p>
          <p className="font-metric mt-1" style={{ color: 'var(--text-dim)', fontSize: '0.63rem', lineHeight: 1.5 }}>
            El usuario ingresa con la contrasena temporal 123456 y el sistema le obligara a cambiarla al instante.
          </p>
        </div>

        {ok ? (
          <div className="text-center py-4">
            <p className="font-metric" style={{ color: 'var(--phosphor)', fontSize: '0.8rem' }}>
              Usuario creado exitosamente: {form.email}
            </p>
            <p className="font-metric mt-1 mb-5" style={{ color: 'var(--text-dim)', fontSize: '0.65rem' }}>
              Informale al usuario que su contrasena temporal es 123456.
            </p>
            
            <div className="flex flex-col gap-3 justify-center items-center">
              <button 
                type="button" 
                className="btn-primary w-full flex items-center justify-center gap-2" 
                onClick={() => {
                  const text = `Hola ${form.nombre}! Ya tenés acceso a la app de Fly Kitchen.\n\nLink: https://bitacora-dashboard.vercel.app\nUsuario: ${form.email}\nContraseña temporal: 123456\n\nEl sistema te pedirá cambiar tu contraseña la primera vez que ingreses.`;
                  navigator.clipboard.writeText(text);
                  alert('¡Datos copiados al portapapeles!');
                }}
              >
                Copiar accesos al portapapeles
              </button>
              
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(`Hola ${form.nombre}! Ya tenés acceso a la app de Fly Kitchen.\n\nLink: https://bitacora-dashboard.vercel.app\nUsuario: ${form.email}\nContraseña temporal: 123456\n\nEl sistema te pedirá cambiar tu contraseña la primera vez que ingreses.`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary w-full flex items-center justify-center gap-2" 
                style={{ background: '#25D366', borderColor: '#25D366', color: '#000' }}
              >
                Enviar por WhatsApp
              </a>

              <button type="button" onClick={onClose} className="btn-ghost w-full mt-2">Cerrar</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvitar} className="space-y-3">
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
            <div>
              <label className="font-metric text-xs mb-1 block" style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>ROL</label>
              <select className="input-dark w-full" value={form.rol} onChange={e => set('rol', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {error && (
              <p className="font-metric text-xs" style={{ color: 'var(--alert)', fontSize: '0.7rem' }}>{error}</p>
            )}

            <p className="font-metric" style={{ color: 'var(--text-dim)', fontSize: '0.63rem', lineHeight: 1.5 }}>
              El usuario podra ingresar con 123456 y debera elegir una contrasena nueva inmediatamente.
            </p>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? 'Creando...' : 'Crear usuario'}
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
  const [grupos, setGrupos]     = useState([])
  const [sedes, setSedes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData]   = useState({})
  const [saving, setSaving]       = useState(false)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [perfilesData, gruposData, sedesData] = await Promise.all([
        getPerfilesConDirectorio(), getGrupos(), getSedes(),
      ])
      setPerfiles(perfilesData); setGrupos(gruposData); setSedes(sedesData)
    }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (p) => {
    setEditingId(p.id)
    setEditData({ email: p.email || '', rol: p.rol, activo: p.activo, telefono: p.telefono || '', grupo_id: p.grupo_id || '', sede_ids: p.sede_ids || [] })
  }

  const handleGrupoChange = (grupoId) => {
    setEditData(d => {
      if (!grupoId) return { ...d, grupo_id: '' }
      const sedesDelGrupo = sedes.filter(s => String(s.grupo_id) === String(grupoId)).map(s => s.id)
      return { ...d, grupo_id: grupoId, sede_ids: sedesDelGrupo }
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditData({}) }

  const saveEdit = async (p) => {
    setSaving(true)
    try {
      const nuevoEmail = (editData.email || '').trim()
      const cambiaEmail = nuevoEmail && nuevoEmail !== p.email
      if (cambiaEmail) {
        // El email de login (auth.users) vive en Supabase Auth, separado del
        // perfil. Hay que cambiarlo primero vía la edge function (admin API);
        // si esto falla, no tocamos el perfil para no dejarlos desincronizados.
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-actions`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: 'update_email', userId: p.id, newEmail: nuevoEmail }),
          }
        )
        const raw = await res.text()
        let json = {}
        try { json = raw ? JSON.parse(raw) : {} } catch { /* ignore */ }
        if (!res.ok) throw new Error(json.error || json.message || raw || `Error HTTP ${res.status}`)
      }
      await upsertPerfil({
        id: p.id,
        email: cambiaEmail ? nuevoEmail : p.email,
        nombre: p.nombre,
        rol: editData.rol,
        activo: editData.activo,
        telefono: editData.telefono || null,
        grupo_id: editData.grupo_id || null,
        sede_ids: editData.sede_ids || [],
      })
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
      const raw = await res.text()
      let json = {}
      try { json = raw ? JSON.parse(raw) : {} } catch { /* ignore */ }
      if (!res.ok) {
        let errStr = json.error || json.message || raw || `Error HTTP ${res.status}`
        if (typeof errStr === 'string' && errStr.includes('already been registered')) {
          errStr = 'El usuario ya está registrado/activo. Para darle acceso, enviá un link de recuperación de contraseña (ícono de llave) en lugar de reenviar la invitación.'
        }
        throw new Error(errStr + (json.debug ? ' | debug: ' + JSON.stringify(json.debug) : ''))
      }

      if (action === 'reset_password') {
        // La API de Supabase devuelve un action_link al usar generateLink para recovery.
        const link = json.link || (json.data && (json.data.action_link || json.data.properties?.action_link)) || (typeof json.data === 'string' ? json.data : null)
        if (link) {
          prompt('Link de recuperación generado. Cópielo y envíeselo al usuario:', link)
        } else {
          alert(json.message || 'Se generó la solicitud de recuperación.')
        }
      } else {
        alert(json.message || 'Listo')
      }
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

      <PageHeader title="Usuarios" subtitle="Gestión de perfiles y roles">
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
      </PageHeader>

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
                  <th>Grupo / Sedes</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {perfiles.map(p => {
                  const isEditing = editingId === p.id
                  const esMiPerfil = p.id === perfilActual?.id
                  return (
                    <tr key={p.id} style={{
                      opacity: p.activo ? 1 : 0.5,
                      background: p.posible_duplicado ? 'rgba(245,158,11,0.035)' : undefined,
                    }}>
                      <td>
                        <p style={{ color:'var(--text)', fontWeight:500, fontSize:'0.82rem' }}>{p.nombre || '—'}</p>
                        {p.posible_duplicado && (
                          <span className="chip chip-yellow" title="Mismo nombre en más de una cuenta. Revisar antes de desactivar o eliminar."
                            style={{ fontSize:'0.52rem', marginTop:3 }}>
                            Posible duplicado · {p.duplicados_nombre} cuentas
                          </span>
                        )}
                        {esMiPerfil && (
                          <span className="chip chip-green" style={{ fontSize:'0.55rem', marginTop:2 }}>Yo</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input className="input-dark" style={{ maxWidth:190, fontSize:'0.72rem', padding:'0.25rem 0.4rem' }}
                            placeholder="email@flykitchen.com.ar" value={editData.email}
                            title="Cambiar esto cambia también el email de login del usuario"
                            onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} />
                        ) : (
                          <span style={{ color:'var(--text-dim)', fontSize:'0.75rem' }}>{p.email}</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input className="input-dark" style={{ maxWidth:140, fontSize:'0.72rem', padding:'0.25rem 0.4rem' }}
                            placeholder="Ej: 5491112345678" value={editData.telefono}
                            onChange={e => setEditData(d => ({ ...d, telefono: e.target.value }))} />
                        ) : (
                          <span style={{ color:'var(--text-dim)', fontSize:'0.72rem' }}>
                            {p.telefono || '—'}
                            {p.telefono_origen && p.telefono_origen !== 'perfil' && (
                              <small style={{ display:'block', color:'rgba(57,255,20,0.5)', fontSize:'0.52rem', marginTop:2 }}>
                                desde {p.telefono_origen === 'equipo' ? 'Equipo' : 'Contactos'}
                              </small>
                            )}
                          </span>
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
                          <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:160 }}>
                            <select className="input-dark" style={{ fontSize:'0.7rem', padding:'0.2rem 0.35rem' }}
                              value={editData.grupo_id} onChange={e => handleGrupoChange(e.target.value)}>
                              <option value="">— Sin grupo —</option>
                              {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                            </select>
                            <select multiple className="input-dark" size={3}
                              style={{ fontSize:'0.65rem', padding:'0.15rem 0.3rem' }}
                              value={(editData.sede_ids || []).map(String)}
                              onChange={e => setEditData(d => ({
                                ...d,
                                sede_ids: Array.from(e.target.selectedOptions).map(o => Number(o.value)),
                              }))}>
                              {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                          </div>
                        ) : (
                          p.grupo_id
                            ? <span className="chip chip-gray" style={{ fontSize:'0.62rem' }}>
                                {grupos.find(g => g.id === p.grupo_id)?.nombre || `Grupo #${p.grupo_id}`} · {(p.sede_ids||[]).length} sede{(p.sede_ids||[]).length!==1?'s':''}
                              </span>
                            : (p.sede_ids?.length
                                ? <span style={{ color:'var(--text-dim)', fontSize:'0.68rem' }}>
                                    {p.sede_ids.length} sede{p.sede_ids.length!==1?'s':''}
                                  </span>
                                : <span style={{ color:'var(--text-dim)' }}>—</span>)
                        )}
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
