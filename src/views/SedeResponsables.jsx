import { useState, useEffect } from 'react'
import { getSedes, getContactos, getAllSedeContactos, upsertSedeContacto, deleteSedeContacto, updateContacto, linkContactoToPerfil, getPerfiles } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { MessageCircle, Mail, Plus, Trash2, RefreshCw, Users, Upload, Pencil, Link, X, Check } from 'lucide-react'
import ImportarContactosModal from '../components/ImportarContactosModal'

const ROLES = ['Responsable','Jefe de cocina','Encargado','Supervisor','Técnico','Administrativo','Otro']

// Mapeo categoría → rol sugerido en el sistema
const ROL_SUGERIDO = {
  'Responsable':    'Encargado',
  'Jefe de cocina': 'Encargado',
  'Encargado':      'Encargado',
  'Supervisor':     'Editor',
  'Técnico':        'Consultor',
  'Administrativo': 'Consultor',
  'Otro':           'Consultor',
}

function EditContactoModal({ item, perfiles, onClose, onSaved }) {
  const c = item.contactos
  const [form, setForm] = useState({
    nombre:   c.nombre   || '',
    cargo:    c.cargo    || '',
    empresa:  c.empresa  || '',
    telefono: c.telefono || '',
    email:    c.email    || '',
  })
  const [perfilId, setPerfilId]   = useState(c.perfil_id || '')
  const [saving, setSaving]       = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [syncOk, setSyncOk]       = useState(false)
  const [error, setError]         = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await updateContacto(c.id, form)
      onSaved()
    } catch(err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleVincular = async () => {
    setSyncing(true); setError(null)
    try {
      await linkContactoToPerfil(c.id, perfilId || null)
      setSyncOk(true)
      setTimeout(() => { setSyncOk(false); onSaved() }, 1500)
    } catch(err) { setError(err.message) }
    finally { setSyncing(false) }
  }

  const perfilVinculado = perfiles.find(p => p.id === perfilId)
  const rolSugerido = ROL_SUGERIDO[item.rol] || 'Consultor'

  const FIELD = { color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em', display:'block', marginBottom:3 }
  const INP   = { padding:'0.4rem 0.6rem', borderRadius:4, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'var(--text)', fontSize:'0.78rem', width:'100%', colorScheme:'dark', fontFamily:'inherit' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass fade-in" style={{ width:'100%', maxWidth:480, borderRadius:4, background:'var(--surface)', border:'1px solid rgba(57,255,20,0.15)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 1.25rem', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="font-title font-bold" style={{ color:'var(--text)', fontSize:'0.95rem' }}>Editar Contacto</p>
            <p style={{ color:'var(--phosphor)', fontSize:'0.62rem', opacity:0.6 }}>{item.rol} · {item.sedes?.nombre || ''}</p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding:'0.3rem' }}><X size={14}/></button>
        </div>

        <div style={{ padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {/* Info del contacto */}
          <form onSubmit={handleSave}>
            <p style={{ color:'rgba(57,255,20,0.4)', fontSize:'0.58rem', letterSpacing:'0.1em', fontFamily:'monospace', marginBottom:'0.75rem' }}>DATOS DEL CONTACTO</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={FIELD}>NOMBRE *</label>
                <input style={INP} value={form.nombre} onChange={e=>set('nombre',e.target.value)} required />
              </div>
              <div>
                <label style={FIELD}>CARGO</label>
                <input style={INP} value={form.cargo} onChange={e=>set('cargo',e.target.value)} placeholder="Ej: Jefe de turno" />
              </div>
              <div>
                <label style={FIELD}>TELÉFONO</label>
                <input style={INP} value={form.telefono} onChange={e=>set('telefono',e.target.value)} placeholder="+549..." />
              </div>
              <div>
                <label style={FIELD}>EMAIL</label>
                <input style={INP} type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="Ej: juan.perez@flykitchen.com" />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={FIELD}>EMPRESA / PROVEEDOR</label>
                <input style={INP} value={form.empresa} onChange={e=>set('empresa',e.target.value)} placeholder="Dejar vacío si es FK" />
              </div>
            </div>
            {error && <p style={{ color:'var(--alert)', fontSize:'0.68rem', marginBottom:8 }}>{error}</p>}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ fontSize:'0.72rem' }}>Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize:'0.72rem' }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>

          {/* Vincular usuario del sistema */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'1.25rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:'0.75rem' }}>
              <Link size={12} style={{ color:'var(--phosphor)' }}/>
              <p style={{ color:'rgba(57,255,20,0.4)', fontSize:'0.58rem', letterSpacing:'0.1em', fontFamily:'monospace' }}>ACCESO AL SISTEMA</p>
            </div>

            {perfilVinculado && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0.5rem 0.75rem', background:'rgba(57,255,20,0.06)', border:'1px solid rgba(57,255,20,0.15)', borderRadius:4, marginBottom:10 }}>
                <Check size={12} style={{ color:'var(--phosphor)', flexShrink:0 }}/>
                <div>
                  <p style={{ color:'var(--phosphor)', fontSize:'0.75rem', fontWeight:600 }}>{perfilVinculado.nombre}</p>
                  <p style={{ color:'var(--text-dim)', fontSize:'0.6rem' }}>{perfilVinculado.email} · Rol: {perfilVinculado.rol}</p>
                </div>
              </div>
            )}

            <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <label style={FIELD}>USUARIO DEL SISTEMA</label>
                <select style={INP} value={perfilId} onChange={e=>setPerfilId(e.target.value)}>
                  <option value="">— Sin vincular —</option>
                  {perfiles.filter(p=>p.activo).map(p=>(
                    <option key={p.id} value={p.id}>{p.nombre} · {p.rol}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleVincular}
                disabled={syncing || syncOk}
                style={{
                  padding:'0.4rem 0.85rem', borderRadius:4, fontSize:'0.72rem', fontWeight:600, cursor:'pointer',
                  background: syncOk ? 'rgba(57,255,20,0.15)' : 'rgba(57,255,20,0.1)',
                  border: `1px solid rgba(57,255,20,${syncOk?'0.5':'0.25'})`,
                  color: 'var(--phosphor)', whiteSpace:'nowrap', flexShrink:0,
                }}>
                {syncOk ? '✓ Sincronizado' : syncing ? 'Sincronizando...' : 'Vincular + Sync sedes'}
              </button>
            </div>
            {perfilId && (
              <p style={{ color:'var(--text-dim)', fontSize:'0.62rem', marginTop:6 }}>
                Al sincronizar, el usuario <strong style={{color:'var(--text)'}}>{perfiles.find(p=>p.id===perfilId)?.nombre}</strong> recibirá
                acceso automático a las sedes donde este contacto está asignado.
                Rol sugerido para esta categoría: <strong style={{color:'var(--phosphor)'}}>{rolSugerido}</strong>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactoRow({ item, onDelete, onEdit }) {
  const c = item.contactos
  if (!c) return null
  const openWA = () => {
    if (!c.telefono) return alert('Sin teléfono registrado.')
    const phone = c.telefono.replace(/\D/g,'').replace(/^0/,'')
    window.open(`https://wa.me/549${phone}`, '_blank')
  }
  const openMail = () => {
    if (!c.email) return alert('Sin email registrado.')
    window.open(`mailto:${c.email}`, '_blank')
  }
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'0.6rem 0.75rem',
      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
      borderRadius:5, marginBottom:5
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <p style={{ color:'var(--text)', fontSize:'0.8rem', fontWeight:600 }}>{c.nombre}</p>
          {c.perfil_id && (
            <span title="Vinculado al sistema" style={{ display:'inline-flex', alignItems:'center', gap:2, background:'rgba(57,255,20,0.1)', border:'1px solid rgba(57,255,20,0.25)', borderRadius:10, padding:'0 5px', fontSize:'0.55rem', color:'var(--phosphor)' }}>
              <Link size={8}/> sistema
            </span>
          )}
        </div>
        <p style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>
          {item.rol}{c.cargo ? ` · ${c.cargo}` : ''}{c.empresa ? ` · ${c.empresa}` : ''}
        </p>
        {(c.telefono || c.email) && (
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'0.6rem', marginTop:1 }}>
            {c.telefono}{c.telefono && c.email ? ' · ' : ''}{c.email}
          </p>
        )}
      </div>
      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
        {c.telefono && (
          <button onClick={openWA} title="WhatsApp"
            style={{ background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.25)', color:'#25D366',
              borderRadius:4, padding:'0.25rem 0.5rem', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:'0.62rem' }}>
            <MessageCircle size={11}/> WA
          </button>
        )}
        {c.email && (
          <button onClick={openMail} title="Email"
            style={{ background:'rgba(99,179,237,0.1)', border:'1px solid rgba(99,179,237,0.25)', color:'#63B3ED',
              borderRadius:4, padding:'0.25rem 0.5rem', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:'0.62rem' }}>
            <Mail size={11}/> Email
          </button>
        )}
        <button onClick={() => onEdit(item)} title="Editar"
          style={{ background:'rgba(57,255,20,0.07)', border:'1px solid rgba(57,255,20,0.2)', color:'var(--phosphor)',
            borderRadius:4, padding:'0.25rem 0.4rem', cursor:'pointer', display:'flex', alignItems:'center' }}>
          <Pencil size={11}/>
        </button>
        {onDelete && <button onClick={() => onDelete(item.id)} title="Quitar"
          style={{ background:'rgba(255,80,80,0.08)', border:'1px solid rgba(255,80,80,0.2)', color:'rgba(255,80,80,0.6)',
            borderRadius:4, padding:'0.25rem 0.4rem', cursor:'pointer', display:'flex', alignItems:'center' }}>
          <Trash2 size={11}/>
        </button>}
      </div>
    </div>
  )
}

function AddContactoForm({ sedeId, contactos, perfiles, existingIds, onAdded, onCancel }) {
  const [sel, setSel]     = useState('')   // "c:ID" for contacto, "p:ID" for perfil
  const [rol, setRol]     = useState('Responsable')
  const [saving, setSaving] = useState(false)

  // Perfiles que YA tienen un contacto vinculado (no los mostramos doble)
  const perfIdsConContacto = new Set(contactos.map(c => c.perfil_id).filter(Boolean))
  const availContactos = contactos.filter(c => !existingIds.includes(c.id))
  // Perfiles sin contacto y que no estén ya asignados por su perfil_id
  const availPerfiles  = (perfiles||[]).filter(p =>
    p.activo && !perfIdsConContacto.has(p.id) &&
    !existingIds.some(eid => contactos.find(cc => cc.id === eid && cc.perfil_id === p.id))
  )

  const handle = async () => {
    if (!sel) return
    setSaving(true)
    try {
      let contactoId
      if (sel.startsWith('c:')) {
        contactoId = parseInt(sel.slice(2))
      } else {
        // perfil sin contacto → crear contacto automáticamente
        const pid = sel.slice(2)
        const perfil = perfiles.find(p => p.id === pid)
        const { data: newC, error } = await supabase.schema('bitacora').from('contactos').insert({
            nombre: perfil.nombre,
            email:  perfil.email,
            telefono: perfil.telefono || null,
            cargo: perfil.rol || null,
            perfil_id: perfil.id,
            activo: true,
          }).select().single()
        if (error) throw error
        contactoId = newC.id
      }
      await upsertSedeContacto({ sede_id: sedeId, contacto_id: contactoId, rol, activo: true })
      onAdded()
    } catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end', padding:'0.75rem', background:'rgba(57,255,20,0.03)', border:'1px solid rgba(57,255,20,0.12)', borderRadius:5, marginBottom:8 }}>
      <div style={{ flex:2, minWidth:160 }}>
        <label style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em', display:'block', marginBottom:3 }}>CONTACTO / USUARIO *</label>
        <select className="input-dark" value={sel} onChange={e=>setSel(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {availContactos.length > 0 && (
            <optgroup label="── Contactos">
              {availContactos.map(c=><option key={'c:'+c.id} value={'c:'+c.id}>{c.nombre}{c.cargo?` · ${c.cargo}`:''}</option>)}
            </optgroup>
          )}
          {availPerfiles.length > 0 && (
            <optgroup label="── Usuarios del sistema">
              {availPerfiles.map(p=><option key={'p:'+p.id} value={'p:'+p.id}>👤 {p.nombre} ({p.rol})</option>)}
            </optgroup>
          )}
        </select>
      </div>
      <div style={{ flex:1, minWidth:130 }}>
        <label style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em', display:'block', marginBottom:3 }}>ROL EN SEDE</label>
        <select className="input-dark" value={rol} onChange={e=>setRol(e.target.value)}>
          {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div style={{ display:'flex', gap:5 }}>
        <button onClick={handle} disabled={!sel||saving} className="btn-primary" style={{ fontSize:'0.7rem', padding:'0.35rem 0.75rem' }}>
          {saving?'...':'Agregar'}
        </button>
        <button onClick={onCancel} className="btn-ghost" style={{ fontSize:'0.7rem', padding:'0.35rem 0.6rem' }}>✕</button>
      </div>
    </div>
  )
}

export default function SedeResponsables() {
  const { rol, sedeIds } = useAuth()
  const canWrite = rol === 'admin' || rol === 'editor'
  const [sedes, setSedes]           = useState([])
  const [contactos, setContactos]   = useState([])
  const [perfiles, setPerfiles]     = useState([])
  const [asignados, setAsignados]   = useState([])
  const [sedeSel, setSedeSel]       = useState(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [loading, setLoading]       = useState(true)

  const load = async () => {
    setLoading(true)
    const [s, c, a, p] = await Promise.all([getSedes(), getContactos(), getAllSedeContactos(), getPerfiles()])
    setSedes(s); setContactos(c); setAsignados(a); setPerfiles(p)
    if (!sedeSel && s.length > 0) setSedeSel(s[0])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const sedesFilt = (rol === 'encargado' && sedeIds?.length > 0)
    ? sedes.filter(s => sedeIds.includes(s.id))
    : sedes
  const sedeItems = asignados.filter(a => a.sede_id === sedeSel?.id)
  const existingIds = sedeItems.map(a => a.contacto_id || a.contactos?.id).filter(Boolean)

  const handleDelete = async (id) => {
    if (!confirm('¿Quitar responsable de esta sede?')) return
    await deleteSedeContacto(id)
    load()
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 fade-in">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
        <div>
          <h1 className="font-title font-bold text-lg" style={{ color:'var(--text)' }}>Responsables por Sede</h1>
          <p style={{ fontSize:'0.62rem', color:'rgba(57,255,20,0.5)', fontFamily:'monospace', letterSpacing:'0.1em' }}>
            CONTACTOS · ASIGNACIÓN · COMUNICACIÓN DIRECTA
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} className="btn-ghost" style={{ padding:'0.4rem' }}>
            <RefreshCw size={13}/>
          </button>
          <button onClick={() => setShowImport(true)} className="btn-ghost"
            style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.7rem', padding:'0.4rem 0.75rem' }}>
            <Upload size={12}/> Importar Google
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'3rem 0' }}>
          <div className="w-7 h-7 rounded-full border-2 animate-spin"
            style={{ borderColor:'var(--phosphor)', borderTopColor:'transparent' }}/>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:16, alignItems:'start' }}>
          {/* Sidebar sedes */}
          <div className="glass rounded" style={{ borderRadius:3, overflow:'hidden' }}>
            <div style={{ padding:'0.6rem 0.75rem', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.1em', fontFamily:'monospace' }}>SEDES</p>
            </div>
            {sedesFilt.map(s => {
              const count = asignados.filter(a=>a.sede_id===s.id).length
              const sel = sedeSel?.id === s.id
              return (
                <button key={s.id} onClick={()=>{ setSedeSel(s); setShowAdd(false) }}
                  style={{
                    width:'100%', textAlign:'left', padding:'0.6rem 0.75rem',
                    background: sel ? 'rgba(57,255,20,0.08)' : 'transparent',
                    borderLeft: sel ? '2px solid var(--phosphor)' : '2px solid transparent',
                    borderBottom:'1px solid rgba(255,255,255,0.04)',
                    color: sel ? 'var(--phosphor)' : 'var(--text)', cursor:'pointer',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                  }}>
                  <span style={{ fontSize:'0.75rem', fontWeight: sel?600:400 }}>{s.nombre}</span>
                  {count > 0 && (
                    <span style={{ fontSize:'0.6rem', background:'rgba(57,255,20,0.15)', color:'var(--phosphor)', borderRadius:10, padding:'0px 6px' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Panel derecho */}
          {sedeSel && (
            <div className="glass rounded" style={{ borderRadius:3, padding:'1rem 1.25rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <div>
                  <h2 style={{ color:'var(--text)', fontWeight:700, fontSize:'1rem' }}>{sedeSel.nombre}</h2>
                  <p style={{ color:'var(--text-dim)', fontSize:'0.65rem' }}>
                    {sedeItems.length === 0 ? 'Sin responsables asignados' : `${sedeItems.length} responsable${sedeItems.length!==1?'s':''}`}
                  </p>
                </div>
                {canWrite && (
                <button onClick={()=>setShowAdd(v=>!v)} className="btn-primary"
                  style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.7rem', padding:'0.4rem 0.9rem' }}>
                  <Plus size={12}/> Agregar
                </button>
                )}
              </div>

              {showAdd && (
                <AddContactoForm
                  sedeId={sedeSel.id}
                  contactos={contactos}
                  perfiles={perfiles}
                  existingIds={existingIds}
                  onAdded={()=>{ setShowAdd(false); load() }}
                  onCancel={()=>setShowAdd(false)}
                />
              )}

              {sedeItems.length === 0 && !showAdd ? (
                <div style={{ textAlign:'center', padding:'2.5rem 0', color:'rgba(255,255,255,0.15)' }}>
                  <Users size={32} style={{ margin:'0 auto 0.75rem' }}/>
                  <p style={{ fontSize:'0.75rem' }}>Sin responsables — hacé click en Agregar</p>
                </div>
              ) : (
                sedeItems.map(item=>(
                  <ContactoRow
                    key={item.id}
                    item={item}
                    onDelete={canWrite ? handleDelete : null}
                    onEdit={setEditItem}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {editItem && (
        <EditContactoModal
          item={editItem}
          perfiles={perfiles}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); load() }}
        />
      )}

      {showImport && (
        <ImportarContactosModal
          existentes={contactos}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}
