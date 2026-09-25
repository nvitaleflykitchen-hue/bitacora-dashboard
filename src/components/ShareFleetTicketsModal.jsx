import { useEffect, useMemo, useState } from 'react'
import { Copy, Mail, MessageCircle, X } from 'lucide-react'
import { getDirectorio } from '../lib/queries'
import { toast } from '../lib/feedback'
import { fleetTicketEmailHref, fleetTicketMessage, fleetTicketWhatsappHref } from '../lib/fleetTicketSharing'

const box = { background:'var(--surface)', border:'1px solid rgba(255,255,255,0.14)', color:'var(--text)', borderRadius:4 }

export default function ShareFleetTicketsModal({ tickets, initialIds, onClose }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialIds.map(String)))
  const [contacts, setContacts] = useState([])
  const [contactId, setContactId] = useState('')
  const [contactError, setContactError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    getDirectorio('flota').then(list => {
      if (!active) return
      setContacts(list)
      setContactId(list[0]?.id ? String(list[0].id) : '')
    }).catch(error => {
      if (active) setContactError(error.message || 'No se pudo cargar la agenda de Flota.')
    })
    return () => { active = false }
  }, [])

  const visible = useMemo(() => tickets.filter(ticket => `${ticket.numero || ticket.id} ${ticket.activo_nombre || ''} ${ticket.descripcion || ''} ${ticket.sede || ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))), [tickets, search])
  const selected = useMemo(() => tickets.filter(ticket => selectedIds.has(String(ticket.id))), [tickets, selectedIds])
  const contact = contacts.find(item => String(item.id) === contactId)
  const message = fleetTicketMessage(selected, contact?.nombre, window.location.origin)
  const whatsapp = fleetTicketWhatsappHref(contact, message)
  const email = fleetTicketEmailHref(contact, selected, message)

  const toggle = id => setSelectedIds(previous => {
    const next = new Set(previous)
    if (next.has(String(id))) next.delete(String(id))
    else next.add(String(id))
    return next
  })
  const selectVisible = () => setSelectedIds(previous => new Set([...previous, ...visible.map(ticket => String(ticket.id))]))

  const copy = async () => {
    if (!message) return
    try {
      await navigator.clipboard.writeText(message)
      toast.ok('Resumen copiado. Podés pegarlo donde lo necesites.')
    } catch {
      toast.error('No se pudo copiar el resumen. Seleccionalo desde la vista previa.')
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Compartir tickets de Flota" style={{ position:'fixed', inset:0, zIndex:1001, background:'rgba(0,0,0,0.78)', display:'flex', justifyContent:'center', alignItems:'center', padding:16 }}>
      <div style={{ ...box, width:'min(780px, 100%)', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ flex:1 }}>
            <h2 style={{ fontSize:'1rem', fontWeight:700, margin:0 }}>Compartir tickets de vehículos</h2>
            <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', margin:'3px 0 0' }}>Elegí los casos y el contacto de Flota. Revisá el texto antes de enviarlo.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn-ghost"><X size={16}/></button>
        </div>
        <div style={{ overflowY:'auto', padding:'16px 20px', display:'grid', gap:14 }}>
          <div>
            <label htmlFor="fleet-share-contact" style={{ display:'block', fontSize:'0.7rem', fontWeight:700, marginBottom:5 }}>Destinatario · Agenda de Flota</label>
            <select id="fleet-share-contact" value={contactId} onChange={event => setContactId(event.target.value)} style={{ ...box, width:'100%', padding:'9px 10px' }}>
              {!contacts.length && <option value="">Sin contactos disponibles</option>}
              {contacts.map(item => <option key={item.id} value={item.id}>{item.nombre}{item.descripcion ? ` · ${item.descripcion}` : ''}</option>)}
            </select>
            {contactError && <p role="alert" style={{ color:'#ff8a8a', fontSize:'0.7rem', margin:'5px 0 0' }}>{contactError}</p>}
            {!contactError && !contacts.length && <p style={{ color:'var(--text-dim)', fontSize:'0.7rem', margin:'5px 0 0' }}>Agregá al responsable en Flota → Contactos para dirigirle el mensaje. También podés copiarlo.</p>}
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:7 }}>
              <strong style={{ fontSize:'0.75rem' }}>Tickets seleccionados: {selected.length}</strong>
              <div style={{ display:'flex', gap:6 }}>
                <button type="button" className="btn-ghost" onClick={selectVisible}>Seleccionar visibles</button>
                <button type="button" className="btn-ghost" onClick={() => setSelectedIds(new Set())}>Quitar selección</button>
              </div>
            </div>
            <input aria-label="Buscar tickets para compartir" placeholder="Buscar por vehículo, número, sede o problema…" value={search} onChange={event => setSearch(event.target.value)} style={{ ...box, width:'100%', padding:'9px 10px', marginBottom:7 }} />
            <div style={{ ...box, maxHeight:210, overflowY:'auto', padding:5 }}>
              {visible.map(ticket => <label key={ticket.id} style={{ display:'flex', alignItems:'flex-start', gap:9, cursor:'pointer', padding:'7px 8px', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:'0.72rem' }}>
                <input type="checkbox" checked={selectedIds.has(String(ticket.id))} onChange={() => toggle(ticket.id)} style={{ accentColor:'#39ff14', marginTop:3 }} />
                <span><strong>#{ticket.numero || ticket.id} · {ticket.activo_nombre || 'Vehículo sin identificar'}</strong><br/><span style={{ color:'var(--text-dim)' }}>{ticket.descripcion || 'Sin descripción'}</span></span>
              </label>)}
              {!visible.length && <p style={{ padding:10, color:'var(--text-dim)', fontSize:'0.72rem' }}>No hay tickets para esta búsqueda.</p>}
            </div>
          </div>
          <div>
            <label htmlFor="fleet-share-preview" style={{ display:'block', fontSize:'0.7rem', fontWeight:700, marginBottom:5 }}>Mensaje para revisar</label>
            <textarea id="fleet-share-preview" readOnly value={message} placeholder="Seleccioná uno o más tickets para preparar el mensaje." style={{ ...box, width:'100%', minHeight:160, padding:10, resize:'vertical', fontSize:'0.72rem', lineHeight:1.5 }} />
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,0.1)', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color:'var(--text-dim)', fontSize:'0.68rem', flex:1 }}>El envío se confirma en WhatsApp o en tu programa de correo.</span>
          <button type="button" className="btn-ghost" disabled={!message} onClick={copy}><Copy size={13}/> Copiar</button>
          {email && <a className="btn-ghost" href={email} style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5 }}><Mail size={13}/> Email</a>}
          {whatsapp && <a className="btn-primary" href={whatsapp} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:5 }}><MessageCircle size={13}/> WhatsApp</a>}
        </div>
      </div>
    </div>
  )
}
