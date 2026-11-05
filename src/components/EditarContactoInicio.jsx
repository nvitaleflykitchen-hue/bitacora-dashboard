import React, { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { guardarContactoInicio, eliminarContactoInicio } from '../lib/saveContactoInicio'

function Editor({ contacto, onClose }) {
  const dialog = useRef(null)
  const [form, setForm] = useState({
    nombre: contacto._persona?.nombre || contacto.nombre || '',
    apellido: contacto._persona?.apellido || '',
    telefono: contacto.telefono || '', email: contacto.email || '', whatsapp: Boolean(contacto.wa),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  async function save(event) {
    event.preventDefault()
    if (confirmDelete || saving) return
    setSaving(true)
    setError('')
    try {
      await guardarContactoInicio(supabase, contacto, form)
      window.dispatchEvent(new Event('directorio-updated'))
      onClose()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  async function remove() {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await eliminarContactoInicio(supabase, contacto.id)
      window.dispatchEvent(new Event('directorio-updated'))
      onClose()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  return (
    <dialog ref={dialog} aria-labelledby="editar-contacto-title" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}
      className="rounded-lg p-5 w-full max-w-md" style={{ background: 'var(--surface)', color: 'var(--text)', maxWidth: 'min(28rem, 94vw)' }}>
      <form onSubmit={save}>
        <h2 id="editar-contacto-title" className="font-bold mb-2">Editar contacto</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
          {contacto._perfilId || contacto._persona ? 'Los cambios también se aplican a la ficha vinculada de Usuarios/Equipo. ' : ''}
          El correo de acceso no se modifica.
        </p>
        <fieldset disabled={saving} className="space-y-3">
          {[['nombre', contacto._persona ? 'Nombre' : 'Nombre completo'], ...(contacto._persona ? [['apellido', 'Apellido']] : []), ['telefono', 'Teléfono'], ['email', 'Correo de contacto']].map(([key, label]) => (
            <label key={key} className="block text-sm">{label}
              <input className="input-dark w-full mt-1" type={key === 'email' ? 'email' : key === 'telefono' ? 'tel' : 'text'}
                required={key === 'nombre' || key === 'telefono'} value={form[key]} onChange={event => set(key, event.target.value)} />
            </label>
          ))}
          {!contacto._perfilId && !contacto._persona && <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.whatsapp} onChange={event => set('whatsapp', event.target.checked)} />Este número tiene WhatsApp</label>}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {confirmDelete ? <div className="rounded border border-red-400 p-3 space-y-3" role="group" aria-label="Confirmar eliminación">
            <p className="text-sm">¿Eliminar a <strong>{contacto.nombre}</strong> del directorio de contactos? Su ficha de Equipo y su cuenta de acceso se conservan.</p>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className="btn-ghost" onClick={() => { setConfirmDelete(false); setError('') }}>Volver</button>
              <button type="button" className="btn-ghost text-red-400" onClick={remove}>{saving ? 'Eliminando…' : 'Confirmar eliminación'}</button>
            </div>
          </div> : <div className="flex flex-wrap justify-end gap-3 pt-3">
            <button type="button" className="btn-ghost text-red-400 mr-auto" onClick={() => { setConfirmDelete(true); setError('') }}>Eliminar contacto</button>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>}
        </fieldset>
      </form>
    </dialog>
  )
}

export default function EditarContactoInicio({ contacto }) {
  const { rol } = useAuth()
  const [editing, setEditing] = useState(false)
  if (rol !== 'admin') return null
  return <>
    <button type="button" title="Editar contacto" aria-label={`Editar contacto ${contacto.nombre}`} onClick={() => setEditing(true)}
      style={{ color: 'var(--phosphor)', border: '1px solid var(--border)', borderRadius: 5, padding: 6, flexShrink: 0 }}><Pencil size={13} /></button>
    {editing && <Editor contacto={contacto} onClose={() => setEditing(false)} />}
  </>
}
