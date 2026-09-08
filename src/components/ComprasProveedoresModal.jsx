import { useEffect, useState } from 'react'
import { Plus, Save, Store, X } from 'lucide-react'
import { getComprasProveedores, saveComprasProveedor } from '../lib/comprasWorkflow'
import { mensajeError } from '../lib/errores'
import { toast } from '../lib/feedback'

const EMPTY = { razon_social:'', nombre_fantasia:'', cuit:'', codigo:'', contacto_nombre:'', telefono:'', whatsapp:'', email:'', direccion:'', localidad:'', provincia:'', codigo_postal:'', condicion_iva:'', condicion_compra:'', notas:'', activo:true }
const LABEL = { display:'block', color:'var(--text-dim)', fontSize:'.62rem', letterSpacing:'.07em', textTransform:'uppercase', marginBottom:4 }

export default function ComprasProveedoresModal({ userId, onClose, onChanged }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const load = async () => setItems(await getComprasProveedores({ includeInactive:true }))
  useEffect(() => { load().catch(error=>toast.error(mensajeError(error))) }, [])
  const set = (key,value) => setForm(current=>({ ...current, [key]:value }))
  const save = async event => {
    event.preventDefault(); setSaving(true)
    try {
      await saveComprasProveedor(form, userId)
      toast.ok(form.id ? 'Proveedor actualizado.' : 'Proveedor agregado.')
      setForm(EMPTY); await load(); onChanged?.()
    } catch (error) { toast.error('No se pudo guardar: ' + mensajeError(error)) }
    finally { setSaving(false) }
  }
  return <div className="modal-overlay" style={{zIndex:75}}>
    <div className="glass fade-in" style={{width:'min(980px,96vw)',maxHeight:'92vh',overflow:'auto',background:'var(--surface)',border:'1px solid rgba(57,255,20,.2)',borderRadius:5}}>
      <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1rem 1.2rem',borderBottom:'1px solid rgba(255,255,255,.08)',position:'sticky',top:0,background:'var(--surface)',zIndex:2}}>
        <div><h2 style={{color:'var(--text)',fontWeight:800,fontSize:'1rem',display:'flex',gap:7,alignItems:'center'}}><Store size={17}/> Proveedores de Compras</h2><p style={{color:'var(--text-dim)',fontSize:'.66rem',marginTop:3}}>Ficha básica y datos para compartir órdenes de compra.</p></div>
        <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar"><X size={16}/></button>
      </header>
      <div style={{display:'grid',gridTemplateColumns:'minmax(290px,.8fr) minmax(430px,1.2fr)',gap:14,padding:'1rem'}}>
        <section style={{display:'flex',flexDirection:'column',gap:6}}>
          <button type="button" className="btn-primary" onClick={()=>setForm(EMPTY)} style={{justifyContent:'center',marginBottom:4}}><Plus size={14}/> Nuevo proveedor</button>
          {items.map(item=><button type="button" key={item.id} onClick={()=>setForm(item)} style={{textAlign:'left',padding:'10px',background:form.id===item.id?'rgba(57,255,20,.08)':'rgba(255,255,255,.025)',border:`1px solid ${form.id===item.id?'rgba(57,255,20,.3)':'rgba(255,255,255,.07)'}`,borderRadius:4,color:'var(--text)',cursor:'pointer'}}>
            <strong style={{display:'block',fontSize:'.76rem'}}>{item.razon_social}</strong>
            <span style={{fontSize:'.62rem',color:'var(--text-dim)'}}>{[item.cuit,item.localidad,item.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}{!item.activo?' · INACTIVO':''}</span>
          </button>)}
          {!items.length && <p style={{color:'var(--text-dim)',fontSize:'.72rem',padding:12}}>Todavía no hay proveedores cargados.</p>}
        </section>
        <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <Field label="Razón social *"><input required className="input-dark" value={form.razon_social||''} onChange={e=>set('razon_social',e.target.value)}/></Field>
            <Field label="Nombre de fantasía"><input className="input-dark" value={form.nombre_fantasia||''} onChange={e=>set('nombre_fantasia',e.target.value)}/></Field>
            <Field label="CUIT"><input className="input-dark" value={form.cuit||''} onChange={e=>set('cuit',e.target.value)} placeholder="30-00000000-0"/></Field>
            <Field label="Código proveedor"><input className="input-dark" value={form.codigo||''} onChange={e=>set('codigo',e.target.value)}/></Field>
            <Field label="Contacto"><input className="input-dark" value={form.contacto_nombre||''} onChange={e=>set('contacto_nombre',e.target.value)}/></Field>
            <Field label="Email"><input type="email" className="input-dark" value={form.email||''} onChange={e=>set('email',e.target.value)}/></Field>
            <Field label="Teléfono"><input className="input-dark" value={form.telefono||''} onChange={e=>set('telefono',e.target.value)}/></Field>
            <Field label="WhatsApp"><input className="input-dark" value={form.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)} placeholder="+54 9 ..."/></Field>
            <Field label="Dirección"><input className="input-dark" value={form.direccion||''} onChange={e=>set('direccion',e.target.value)}/></Field>
            <Field label="Localidad"><input className="input-dark" value={form.localidad||''} onChange={e=>set('localidad',e.target.value)}/></Field>
            <Field label="Provincia"><input className="input-dark" value={form.provincia||''} onChange={e=>set('provincia',e.target.value)}/></Field>
            <Field label="Código postal"><input className="input-dark" value={form.codigo_postal||''} onChange={e=>set('codigo_postal',e.target.value)}/></Field>
            <Field label="Condición IVA"><input className="input-dark" value={form.condicion_iva||''} onChange={e=>set('condicion_iva',e.target.value)}/></Field>
            <Field label="Condición de compra"><input className="input-dark" value={form.condicion_compra||''} onChange={e=>set('condicion_compra',e.target.value)}/></Field>
          </div>
          <Field label="Notas"><textarea rows={3} className="input-dark" value={form.notas||''} onChange={e=>set('notas',e.target.value)}/></Field>
          <label style={{color:'var(--text)',fontSize:'.7rem',display:'flex',gap:7,alignItems:'center'}}><input type="checkbox" checked={form.activo!==false} onChange={e=>set('activo',e.target.checked)} style={{accentColor:'var(--phosphor)'}}/> Proveedor activo</label>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,borderTop:'1px solid rgba(255,255,255,.07)',paddingTop:10}}><button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button><button type="submit" className="btn-primary" disabled={saving}><Save size={14}/>{saving?'Guardando…':'Guardar proveedor'}</button></div>
        </form>
      </div>
    </div>
  </div>
}

function Field({ label, children }) { return <div><label style={LABEL}>{label}</label>{children}</div> }
