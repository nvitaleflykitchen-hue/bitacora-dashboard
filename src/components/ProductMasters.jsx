import React, { useState } from 'react'

const kinds = [
  ['brand', 'Marcas'],
  ['manufacturer', 'Fabricantes / proveedores'],
  ['stock_unit', 'Unidades base de stock'],
  ['category', 'Categorías'],
  ['subcategory', 'Subcategorías'],
  ['ingredient', 'Ingredientes'],
  ['presentation', 'Presentaciones / envases'],
]
const contentUnits = ['g', 'kg', 'mg', 'ml', 'l', 'unidad', 'm', 'cm']

export default function ProductMasters({ values, onSave, canEdit, canEditExisting = true }) {
  const [drafts, setDrafts] = useState({})
  const [newValues, setNewValues] = useState({})
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState({})

  async function save(value, key) {
    setSaving(key); setError(''); setNotice('')
    try {
      await onSave(value)
      if (!value.id) setNewValues(current => ({ ...current, [value.kind]:{ name:'', parent_id:current[value.kind]?.parent_id || '', unit:current[value.kind]?.unit || '' } }))
      else setDrafts(current => ({ ...current, [value.id]:{ name:value.name, active:value.active, parent_id:value.parent_id || '', unit:value.unit || '' } }))
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
    {kinds.map(([kind, title]) => {
      const term = (search[kind] || '').trim().toLocaleLowerCase('es-AR')
      const matching = values.filter(item => item.kind === kind && item.name.toLocaleLowerCase('es-AR').includes(term))
      return <section key={kind} className="articulos-master-group">
      <h3>{title}</h3>
      {kind === 'ingredient' && <p>La unidad de cada ingrediente completa automáticamente la unidad de contenido de sus artículos.</p>}
      {values.filter(item => item.kind === kind).length > 50 && <label className="articulos-master-search">Buscar en {title.toLocaleLowerCase('es-AR')}<input className="input-dark" type="search" value={search[kind] || ''} onChange={event => setSearch(current => ({ ...current, [kind]:event.target.value }))} placeholder={`Buscar entre ${values.filter(item => item.kind === kind).length} opciones`} /></label>}
      {matching.length > 50 && <p className="articulos-master-hint">Mostrando 50 de {matching.length} opciones. Escribí para encontrar las restantes.</p>}
      {matching.slice(0, 50).map(item => {
        const draft = drafts[item.id] || { name:item.name, active:item.active, parent_id:item.parent_id || '', unit:item.unit || '' }
        return <div className="articulos-master-row" key={item.id}>
          <input className="input-dark" aria-label={`${title}: ${item.name}`} maxLength={150} value={draft.name} disabled={!canEdit || !canEditExisting || Boolean(saving)} onChange={event => setDrafts(current => ({ ...current, [item.id]:{ ...draft, name:event.target.value } }))} />
          {kind === 'subcategory' && <select className="input-dark" aria-label={`Categoría de ${item.name}`} value={draft.parent_id} disabled={!canEdit || !canEditExisting || Boolean(saving)} onChange={event => setDrafts(current => ({ ...current, [item.id]:{ ...draft, parent_id:event.target.value } }))}><option value="">Elegir categoría</option>{values.filter(option => option.kind === 'category' && (option.active || option.id === draft.parent_id)).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>}
          {kind === 'ingredient' && <select className="input-dark" aria-label={`Unidad de ${item.name}`} value={draft.unit} disabled={!canEdit || !canEditExisting || Boolean(saving)} onChange={event => setDrafts(current => ({ ...current, [item.id]:{ ...draft, unit:event.target.value } }))}><option value="">Elegir unidad</option>{contentUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select>}
          <label><input type="checkbox" checked={draft.active} disabled={!canEdit || !canEditExisting || Boolean(saving)} onChange={event => setDrafts(current => ({ ...current, [item.id]:{ ...draft, active:event.target.checked } }))} /> Activo</label>
          {canEdit && <button type="button" className="btn-ghost" disabled={!canEditExisting || Boolean(saving) || !draft.name.trim() || (kind === 'subcategory' && !draft.parent_id) || (kind === 'ingredient' && !draft.unit)} onClick={() => save({ id:item.id, kind, name:draft.name.trim(), active:draft.active, parent_id:draft.parent_id || null, unit:draft.unit || null }, item.id)}>Guardar</button>}
        </div>
      })}
      {canEdit && <form className="articulos-master-row" onSubmit={event => { event.preventDefault(); const draft = newValues[kind] || {}; save({ kind, name:(draft.name || '').trim(), active:true, parent_id:draft.parent_id || null, unit:draft.unit || null }, `new-${kind}`) }}>
        <input className="input-dark" aria-label={`Nueva opción de ${title}`} maxLength={150} placeholder={`Agregar ${title.toLowerCase()}`} value={newValues[kind]?.name || ''} disabled={Boolean(saving)} onChange={event => setNewValues(current => ({ ...current, [kind]:{ ...current[kind], name:event.target.value } }))} />
        {kind === 'subcategory' && <select className="input-dark" aria-label="Categoría de nueva subcategoría" value={newValues[kind]?.parent_id || ''} disabled={Boolean(saving)} onChange={event => setNewValues(current => ({ ...current, [kind]:{ ...current[kind], parent_id:event.target.value } }))}><option value="">Elegir categoría</option>{values.filter(option => option.kind === 'category' && option.active).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select>}
        {kind === 'ingredient' && <select className="input-dark" aria-label="Unidad del nuevo ingrediente" value={newValues[kind]?.unit || ''} disabled={Boolean(saving)} onChange={event => setNewValues(current => ({ ...current, [kind]:{ ...current[kind], unit:event.target.value } }))}><option value="">Elegir unidad</option>{contentUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select>}
        <button type="submit" className="btn-primary" disabled={Boolean(saving) || !(newValues[kind]?.name || '').trim() || (kind === 'subcategory' && !newValues[kind]?.parent_id) || (kind === 'ingredient' && !newValues[kind]?.unit)}>+ Agregar</button>
      </form>}
    </section>})}
  </section>
}
