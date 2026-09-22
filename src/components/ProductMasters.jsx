import React, { useState } from 'react'

const kinds = [
  ['brand', 'Marcas'],
  ['manufacturer', 'Fabricantes / proveedores'],
  ['stock_unit', 'Unidades base de stock'],
]

export default function ProductMasters({ values, onSave, canEdit, canEditExisting = true }) {
  const [drafts, setDrafts] = useState({})
  const [newNames, setNewNames] = useState({})
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function save(value, key) {
    setSaving(key); setError(''); setNotice('')
    try {
      await onSave(value)
      if (!value.id) setNewNames(current => ({ ...current, [value.kind]:'' }))
      else setDrafts(current => ({ ...current, [value.id]:{ name:value.name, active:value.active } }))
      setNotice('Maestro actualizado.')
    } catch (cause) {
      setError(cause.message || 'No se pudo guardar el maestro.')
    } finally {
      setSaving('')
    }
  }

  return <section className="articulos-masters" aria-label="Edición de maestros de artículos">
    <h2>Maestros de artículos</h2>
    <p>Administrá las opciones de las fichas. Al renombrar una opción, las fichas que la usan se actualizan juntas. Desactivar conserva el historial.</p>
    {!canEditExisting && <p>Podés agregar opciones sin perder la ficha abierta. Para renombrar o desactivar, cerrá la ficha primero.</p>}
    {error && <p role="alert" className="articulos-error">{error}</p>}
    {notice && <p role="status" className="articulos-notice">{notice}</p>}
    {kinds.map(([kind, title]) => <section key={kind} className="articulos-master-group">
      <h3>{title}</h3>
      {values.filter(item => item.kind === kind).map(item => {
        const draft = drafts[item.id] || { name:item.name, active:item.active }
        return <div className="articulos-master-row" key={item.id}>
          <input className="input-dark" aria-label={`${title}: ${item.name}`} maxLength={150} value={draft.name} disabled={!canEdit || !canEditExisting || Boolean(saving)} onChange={event => setDrafts(current => ({ ...current, [item.id]:{ ...draft, name:event.target.value } }))} />
          <label><input type="checkbox" checked={draft.active} disabled={!canEdit || !canEditExisting || Boolean(saving)} onChange={event => setDrafts(current => ({ ...current, [item.id]:{ ...draft, active:event.target.checked } }))} /> Activo</label>
          {canEdit && <button type="button" className="btn-ghost" disabled={!canEditExisting || Boolean(saving) || !draft.name.trim()} onClick={() => save({ id:item.id, kind, name:draft.name.trim(), active:draft.active }, item.id)}>Guardar</button>}
        </div>
      })}
      {canEdit && <form className="articulos-master-row" onSubmit={event => { event.preventDefault(); save({ kind, name:(newNames[kind] || '').trim(), active:true }, `new-${kind}`) }}>
        <input className="input-dark" aria-label={`Nueva opción de ${title}`} maxLength={150} placeholder={`Agregar ${title.toLowerCase()}`} value={newNames[kind] || ''} disabled={Boolean(saving)} onChange={event => setNewNames(current => ({ ...current, [kind]:event.target.value }))} />
        <button type="submit" className="btn-primary" disabled={Boolean(saving) || !(newNames[kind] || '').trim()}>+ Agregar</button>
      </form>}
    </section>)}
  </section>
}
