import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { getDirectorio, saveDirectorioContacto, removeDirectorioContacto, getPerfiles } from '../lib/queries'
import { confirmar } from '../lib/feedback'

// ─── Labels por módulo ────────────────────────────────────────────────────────
const MODULO_META = {
  rrhh:          { label: 'Recursos Humanos',  desc: 'Consultas, solicitudes y gestiones de RRHH' },
  mantenimiento: { label: 'Mantenimiento',      desc: 'Técnicos, proveedores y contactos de emergencia técnica' },
  flota:         { label: 'Flota',              desc: 'Grúas, seguros vehiculares, ART flota y soporte' },
  compras:       { label: 'Compras',            desc: 'Equipo de compras y proveedores clave' },
  calidad:       { label: 'Calidad',            desc: 'Referentes de calidad, auditorías y BPM' },
  emergencias:   { label: 'Emergencias',        desc: 'Números de emergencia y servicios críticos' },
}

const ICONOS_SUGERIDOS = ['📞','💬','🛡️','📩','💰','🔐','🤱','👥','🚑','🚒','🚓','⚠️','🔧','🚛','📋','👷','🏥','🔑','📌','🧯']

const FORM_VACIO = { nombre:'', descripcion:'', telefono:'', tel:'', wa:'', email:'', icono:'📞', perfil_id:'', orden:0 }

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const IcoPhone = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11.5 19.79 19.79 0 010 2.82 2 2 0 011.77.64h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L5.91 8.09a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
const IcoWA   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
const IcoMail = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
const IcoEdit = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoTrash= () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>

// ─── ContactCard ─────────────────────────────────────────────────────────────
function ContactCard({ c, canEdit, onEdit, onDelete, perfilesMap }) {
  const perfilName = c.perfil_id && perfilesMap[c.perfil_id]
    ? `${perfilesMap[c.perfil_id].nombre || ''} ${perfilesMap[c.perfil_id].apellido || ''}`.trim()
    : null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid rgba(57,255,20,0.08)',
      borderRadius: 7,
      padding: '0.85rem 1rem',
      display: 'flex', alignItems: 'center', gap: '0.85rem',
    }}>
      {/* Ícono */}
      <div style={{ width:38, height:38, flexShrink:0, borderRadius:8, background:'rgba(57,255,20,0.07)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>
        {c.icono}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <p style={{ color:'var(--text)', fontWeight:700, fontSize:'0.83rem' }}>{c.nombre}</p>
          {perfilName && (
            <span style={{ fontSize:'0.6rem', color:'var(--phosphor)', opacity:0.7, background:'rgba(57,255,20,0.08)', padding:'1px 5px', borderRadius:3 }}>
              👤 {perfilName}
            </span>
          )}
        </div>
        {c.descripcion && <p style={{ color:'var(--text-dim)', fontSize:'0.68rem', lineHeight:1.4, margin:'2px 0 4px' }}>{c.descripcion}</p>}
        <p style={{ color:'var(--phosphor)', fontFamily:'monospace', fontSize:'0.72rem', opacity:0.8 }}>{c.telefono}</p>
      </div>

      {/* Botones acción */}
      <div style={{ display:'flex', gap:5, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end' }}>
        <a href={`tel:+${c.tel}`} title="Llamar" style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.22)', color:'var(--phosphor)', borderRadius:4, padding:'0.32rem 0.65rem', fontSize:'0.65rem', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
          <IcoPhone /> Llamar
        </a>
        {c.wa && (
          <a href={`https://wa.me/${c.wa}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.22)', color:'#25d366', borderRadius:4, padding:'0.32rem 0.65rem', fontSize:'0.65rem', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
            <IcoWA /> WhatsApp
          </a>
        )}
        {c.email && (
          <a href={`mailto:${c.email}`} title="Enviar email" style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(99,179,237,0.08)', border:'1px solid rgba(99,179,237,0.22)', color:'#63b3ed', borderRadius:4, padding:'0.32rem 0.65rem', fontSize:'0.65rem', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
            <IcoMail /> Email
          </a>
        )}
        {canEdit && (
          <>
            <button onClick={onEdit} title="Editar" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-dim)', borderRadius:4, cursor:'pointer' }}><IcoEdit /></button>
            <button onClick={onDelete} title="Eliminar" style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, background:'rgba(255,42,42,0.07)', border:'1px solid rgba(255,42,42,0.18)', color:'#ff6b6b', borderRadius:4, cursor:'pointer' }}><IcoTrash /></button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Modal Agregar / Editar ───────────────────────────────────────────────────
function ContactoModal({ contacto, modulo, perfiles, onClose, onSaved }) {
  const [form, setForm] = useState({
    modulo,
    nombre:      contacto?.nombre      || '',
    descripcion: contacto?.descripcion || '',
    telefono:    contacto?.telefono    || '',
    tel:         contacto?.tel         || '',
    wa:          contacto?.wa          || '',
    email:       contacto?.email       || '',
    icono:       contacto?.icono       || '📞',
    perfil_id:   contacto?.perfil_id   || '',
    orden:       contacto?.orden       ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-rellenar tel desde telefono: quitar espacios/guiones, agregar 549 si es número corto
  const autoTel = (raw) => {
    const digits = raw.replace(/\D/g, '')
    if (digits.length <= 10) return '549' + digits
    if (digits.startsWith('0')) return '54' + digits.slice(1)
    return digits
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setErr('El nombre es obligatorio'); return }
    if (!form.telefono.trim()) { setErr('El teléfono (display) es obligatorio'); return }
    if (!form.tel.trim()) { setErr('El campo TEL (para llamadas) es obligatorio'); return }
    setSaving(true)
    setErr('')
    try {
      await saveDirectorioContacto({
        id: contacto?.id,
        ...form,
        perfil_id: form.perfil_id || null,
        orden: Number(form.orden) || 0,
      })
      onSaved()
    } catch (e) {
      setErr(e.message || 'Error al guardar')
      setSaving(false)
    }
  }

  const labelStyle = { color:'var(--text-dim)', fontSize:'0.68rem', display:'block', marginBottom:4, fontWeight:600, letterSpacing:'0.05em' }
  const inputStyle = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:4, color:'var(--text)', fontSize:'0.8rem', padding:'0.45rem 0.65rem', width:'100%', outline:'none', boxSizing:'border-box' }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:90, background:'rgba(0,0,0,0.6)' }} />
      <div style={{
        position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:91,
        width:'min(520px, 94vw)', maxHeight:'90vh', overflowY:'auto',
        background:'var(--surface)', borderRadius:10, padding:'1.5rem',
        border:'1px solid rgba(57,255,20,0.15)', boxShadow:'0 24px 80px rgba(0,0,0,0.7)',
      }}>
        <h3 style={{ color:'var(--phosphor)', fontWeight:800, fontSize:'0.95rem', marginBottom:'1.25rem' }}>
          {contacto ? '✏️ Editar contacto' : '➕ Nuevo contacto'} · {MODULO_META[modulo]?.label}
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'0.85rem' }}>
            {/* Ícono */}
            <div>
              <label style={labelStyle}>ÍCONO</label>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                {ICONOS_SUGERIDOS.map(ico => (
                  <button key={ico} type="button" onClick={() => set('icono', ico)}
                    style={{ fontSize:'1.15rem', background: form.icono===ico ? 'rgba(57,255,20,0.18)' : 'rgba(255,255,255,0.04)', border: form.icono===ico ? '1px solid var(--phosphor)' : '1px solid rgba(255,255,255,0.08)', borderRadius:4, padding:'2px 5px', cursor:'pointer' }}>
                    {ico}
                  </button>
                ))}
              </div>
              <input style={inputStyle} value={form.icono} onChange={e => set('icono', e.target.value)} placeholder="O escribí cualquier emoji" />
            </div>

            {/* Orden */}
            <div>
              <label style={labelStyle}>ORDEN (número)</label>
              <input type="number" style={inputStyle} value={form.orden} onChange={e => set('orden', e.target.value)} min={0} />
            </div>
          </div>

          {/* Nombre */}
          <div style={{ marginBottom:'0.85rem' }}>
            <label style={labelStyle}>NOMBRE *</label>
            <input style={inputStyle} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: ART, Técnico Electricidad..." required />
          </div>

          {/* Descripción */}
          <div style={{ marginBottom:'0.85rem' }}>
            <label style={labelStyle}>DESCRIPCIÓN</label>
            <input style={inputStyle} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Para qué sirve este contacto" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'0.85rem' }}>
            {/* Teléfono display */}
            <div>
              <label style={labelStyle}>TELÉFONO (display) *</label>
              <input style={inputStyle} value={form.telefono} onChange={e => {
                set('telefono', e.target.value)
                if (!contacto) set('tel', autoTel(e.target.value))
              }} placeholder="Ej: 3513628059" required />
            </div>

            {/* TEL para link */}
            <div>
              <label style={labelStyle}>TEL (link de llamada) *</label>
              <input style={inputStyle} value={form.tel} onChange={e => set('tel', e.target.value)} placeholder="Ej: 5493513628059" required />
              <p style={{ color:'rgba(57,255,20,0.4)', fontSize:'0.6rem', marginTop:3 }}>Se autocompleta al escribir el teléfono</p>
            </div>
          </div>

          {/* WA + Email */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'0.85rem' }}>
            <div>
              <label style={labelStyle}>WHATSAPP (wa.me, opcional)</label>
              <input style={inputStyle} value={form.wa} onChange={e => set('wa', e.target.value)} placeholder="Ej: 5493513628059" />
            </div>
            <div>
              <label style={labelStyle}>EMAIL (opcional)</label>
              <input type="email" style={inputStyle} value={form.email} onChange={e => set('email', e.target.value)} placeholder="Ej: contacto@empresa.com" />
            </div>
          </div>

          {/* Perfil vinculado */}
          <div style={{ marginBottom:'1.25rem' }}>
            <label style={labelStyle}>USUARIO DEL SISTEMA (opcional)</label>
            <select style={{ ...inputStyle, cursor:'pointer' }} value={form.perfil_id} onChange={e => set('perfil_id', e.target.value)}>
              <option value="">— Sin vincular —</option>
              {perfiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.apellido || ''} {p.rol ? `(${p.rol})` : ''}
                </option>
              ))}
            </select>
            <p style={{ color:'rgba(57,255,20,0.4)', fontSize:'0.6rem', marginTop:3 }}>
              Vinculá este contacto a un usuario ya cargado en el sistema
            </p>
          </div>

          {err && <p style={{ color:'#ff6b6b', fontSize:'0.75rem', marginBottom:'0.75rem' }}>{err}</p>}

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button type="button" onClick={onClose} style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text-dim)', borderRadius:4, padding:'0.5rem 1rem', fontSize:'0.78rem', cursor:'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ background:'var(--phosphor)', color:'#0A0A0E', border:'none', borderRadius:4, padding:'0.5rem 1.2rem', fontSize:'0.78rem', fontWeight:700, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : contacto ? 'Guardar cambios' : 'Agregar contacto'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── ContactosTab — componente principal ─────────────────────────────────────
/**
 * Props:
 *   modulo — 'rrhh' | 'mantenimiento' | 'flota' | 'emergencias'
 */
export default function ContactosTab({ modulo }) {
  const { rol } = useAuth()
  const canEdit = ['admin', 'editor'].includes(rol)
  const meta = MODULO_META[modulo] || { label: 'Contactos', desc: '' }

  const [contactos, setContactos] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [perfilesMap, setPerfilesMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | {contacto}

  const load = useCallback(async () => {
    setLoading(true)
    setDbError(null)
    try {
      const data = await getDirectorio(modulo)
      setContactos(data)
    } catch (e) {
      setDbError(e.message)
    } finally {
      setLoading(false)
    }
  }, [modulo])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!canEdit) return
    getPerfiles().then(list => {
      setPerfiles(list || [])
      const map = {}
      for (const p of list || []) map[p.id] = p
      setPerfilesMap(map)
    }).catch(() => {})
  }, [canEdit])

  const handleDelete = async (id) => {
    if (!await confirmar({ mensaje: '¿Eliminar este contacto del directorio?', peligro: true, confirmText: 'Eliminar' })) return
    await removeDirectorioContacto(id)
    load()
  }

  const handleSaved = () => { setEditing(null); load() }

  return (
    <div style={{ padding:'1.25rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1.25rem', gap:8 }}>
        <div>
          <h2 style={{ color:'var(--text)', fontWeight:800, fontSize:'1rem', marginBottom:3 }}>{meta.label}</h2>
          <p style={{ color:'var(--text-dim)', fontSize:'0.73rem' }}>{meta.desc}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing('new')}
            style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6, background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.25)', color:'var(--phosphor)', borderRadius:5, padding:'0.45rem 0.9rem', fontSize:'0.72rem', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}
          >
            + Agregar
          </button>
        )}
      </div>

      {/* Estados */}
      {loading && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:80 }}>
          <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid var(--phosphor)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
        </div>
      )}

      {!loading && dbError && (
        <div style={{ background:'rgba(255,42,42,0.07)', border:'1px solid rgba(255,42,42,0.2)', borderRadius:6, padding:'1rem', color:'#ff6b6b', fontSize:'0.78rem' }}>
          <p style={{ fontWeight:700, marginBottom:4 }}>Error al cargar contactos</p>
          <p style={{ opacity:0.8 }}>{dbError}</p>
          {dbError.includes('does not exist') && (
            <p style={{ marginTop:8, color:'rgba(255,255,255,0.5)', fontSize:'0.7rem' }}>
              La tabla directorio_contactos no existe. Corré el archivo <strong>sql_directorio_contactos.sql</strong> en Supabase.
            </p>
          )}
        </div>
      )}

      {!loading && !dbError && contactos.length === 0 && (
        <div style={{ textAlign:'center', padding:'2.5rem 1rem', border:'1px dashed rgba(57,255,20,0.12)', borderRadius:6, color:'var(--text-dim)', fontSize:'0.78rem', lineHeight:1.7 }}>
          <p style={{ fontSize:'1.5rem', marginBottom:8 }}>📋</p>
          <p style={{ fontWeight:600, color:'var(--text)', marginBottom:4 }}>Sin contactos cargados</p>
          {canEdit
            ? <p>Usá el botón <strong>+ Agregar</strong> para cargar el primer contacto de este módulo.</p>
            : <p>El administrador aún no cargó contactos para esta área.</p>
          }
        </div>
      )}

      {!loading && !dbError && contactos.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.55rem' }}>
          {contactos.map(c => (
            <ContactCard
              key={c.id}
              c={c}
              canEdit={canEdit}
              onEdit={() => setEditing(c)}
              onDelete={() => handleDelete(c.id)}
              perfilesMap={perfilesMap}
            />
          ))}
        </div>
      )}

      {!loading && !dbError && canEdit && contactos.length > 0 && (
        <p style={{ color:'rgba(57,255,20,0.22)', fontSize:'0.6rem', marginTop:'1rem', textAlign:'right' }}>
          Solo admin y editor pueden agregar o editar contactos
        </p>
      )}

      {/* Modal */}
      {editing && (
        <ContactoModal
          contacto={editing === 'new' ? null : editing}
          modulo={modulo}
          perfiles={perfiles}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
