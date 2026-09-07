import React, { useEffect, useRef, useState } from 'react'
import { Barcode, Package, Search } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { productResolver, findProduct, saveProduct, searchProducts, validateProduct, enrichProduct } from '../lib/productQueries'
import { missingProposals, applyProductProposals, displayProductSources, PRODUCT_FIELD_LABELS } from '../lib/productEnrichment'
import { barcodeType, normalizeBarcode, safeImageUrl, validCheckDigit } from '../lib/productBarcode'
import { uploadAdjunto } from '../lib/adjuntos'
import { useBackHandler } from '../lib/backStack'
import ProductBarcodeScanner from '../components/ProductBarcodeScanner'
import './Articulos.css'

const empty = barcode => ({ product_id:crypto.randomUUID(), barcode, name:'', description:'', brand:'', manufacturer:'', category:'', subcategory:'', image_url:'', ingredients:'', allergens:'', nutrition_text:'', country_of_origin:'', presentation:'', net_quantity:'', net_unit:'', units_per_package:'', packaging_level:'unknown', source:null })
const fields = [['name','Nombre del artículo *'],['brand','Marca'],['manufacturer','Fabricante'],['category','Categoría'],['subcategory','Subcategoría'],['country_of_origin','País de origen'],['presentation','Presentación / descripción del envase']]

export function RelevamientoArticulos() { return <Articulos initialMode="scan" /> }

export default function Articulos({ initialMode = 'list' }) {
  const { can, perfil } = useAuth()
  const writable = can('articulos')
  const [mode, setMode] = useState(initialMode)
  const [code, setCode] = useState('')
  const [scanner, setScanner] = useState(false)
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [warnings, setWarnings] = useState([])
  const [confirmedCode, setConfirmedCode] = useState(false)
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState('')
  const uploaded = useRef(null)
  const request = useRef(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [sourceUrl, setSourceUrl] = useState('')
  const [proposals, setProposals] = useState([])
  useBackHandler(() => {
    if (busyRef.current) return
    if (scanner) setScanner(false)
    else if (canLeave()) reset()
  }, Boolean(form || scanner))
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!file) { setFilePreview(''); return }
    const url = URL.createObjectURL(file); setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    if (!dirty) return
    const warn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (mode !== 'list' || form) return
    let stale = false
    setLoading(true); setListError('')
    searchProducts(query, page).then(result => { if (!stale) setRows(result) }).catch(e => {
      if (!stale) { setRows([]); setListError(`No se pudo cargar el maestro: ${e.message}`) }
    }).finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [query, page, mode, form, refresh])

  const reset = () => { setForm(null); setFile(null); uploaded.current = null; setDirty(false); setError(''); setWarnings([]); setConfirmedCode(false); setEditing(false); setProposals([]); setSourceUrl('') }
  const canLeave = () => !dirty || window.confirm('Hay cambios sin guardar. ¿Querés descartarlos?')
  const switchMode = next => { if (busyRef.current || !canLeave()) return; reset(); setMode(next); setNotice('') }
  const update = (key, value) => { setForm(f => ({ ...f, [key]:value })); setDirty(true) }
  async function completeMissing() {
    if (!form || !writable || busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setNotice(''); setProposals([])
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    try {
      const result = await enrichProduct(form.barcode, { signal:controller.signal, sourceUrl })
      if (controller.signal.aborted) return
      const found = missingProposals(form, result.products || [])
      setProposals(found); setWarnings(result.warnings || [])
      setNotice(found.length ? 'Revisá los datos propuestos y su fuente antes de aplicarlos.' : 'No se encontraron datos adicionales para los campos vacíos. Los datos actuales se conservaron.')
    } catch (e) { if (!controller.signal.aborted) setError(e.message || 'No se pudo completar la búsqueda.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  function acceptProposals() {
    setForm(current => applyProductProposals(current, proposals))
    setProposals([]); setDirty(true); setEditing(true)
    setNotice('Datos propuestos aplicados a campos vacíos. Revisá la ficha y guardá el artículo.')
  }
  async function lookup(value, localOnly = false) {
    if (busyRef.current || !canLeave()) return
    let barcode
    try { barcode = normalizeBarcode(value) } catch (e) { setError(e.message); return }
    busyRef.current = true; setBusy(true); setError(''); setNotice(''); setScanner(false)
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    try {
      const result = localOnly ? { product:await findProduct(barcode), origin:'local', warnings:[] } : await productResolver.resolve(barcode, { signal:controller.signal })
      if (controller.signal.aborted) return
      if (localOnly && !result.product) throw new Error('El artículo ya no está disponible. Actualizá el listado.')
      reset(); setCode(barcode); setWarnings(result.warnings || [])
      setForm(result.product ? { ...empty(barcode), ...result.product } : empty(barcode))
      setEditing(result.origin !== 'local' && writable)
      setDirty(result.origin !== 'local')
      setNotice(result.origin === 'local' ? 'Artículo encontrado en nuestro maestro.' : result.product ? 'Datos encontrados. Revisá la etiqueta y completá la presentación antes de guardar.' : 'Producto no identificado')
    } catch (e) { if (!controller.signal.aborted) setError(e.message || 'No se pudo buscar el artículo.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function save(next = false) {
    if (!writable || busyRef.current) return
    try {
      validateProduct(form)
      if (!validCheckDigit(form.barcode) && !confirmedCode) throw new Error('El dígito verificador no coincide. Revisá el código y confirmá que lo cotejaste con la etiqueta.')
    } catch (e) { setError(e.message); return }
    busyRef.current = true; setBusy(true); setError(''); setNotice('')
    let saved
    try {
      saved = await saveProduct(form)
      setForm(saved); setDirty(false)
      if (file) {
        // Save first: image failures never lose the article or falsely advance the scanner.
        if (!uploaded.current) uploaded.current = await uploadAdjunto('producto', saved.product_id, file, perfil?.nombre || 'usuario')
        saved = await saveProduct({ ...saved, image_url:uploaded.current.url })
        setForm(saved); setFile(null); uploaded.current = null
      }
      setEditing(false); setProposals([]); setRefresh(n => n + 1); setNotice('Artículo guardado en el maestro.')
      if (next) { reset(); setCode(''); setMode('scan'); setScanner(true) }
    } catch (e) {
      setDirty(true)
      setError(`${saved ? 'El artículo se guardó, pero falta completar la imagen. Reintentá guardar. ' : ''}${e.message || 'No se pudo guardar.'}`)
    } finally { busyRef.current = false; setBusy(false) }
  }
  const image = filePreview || safeImageUrl(form?.image_url)
  return <div className="articulos-view">
    <header><div><span className="articulos-eyebrow">MAESTRO DE PRODUCTOS</span><h1>{mode === 'scan' ? 'Relevamiento de artículos' : 'Artículos'}</h1><p>Identificá productos y registrá sus presentaciones.</p></div></header>
    <nav aria-label="Artículos" className="articulos-tabs">
      {writable && <button type="button" className={mode === 'scan' ? 'btn-primary' : 'btn-ghost'} disabled={busy} onClick={() => switchMode('scan')}><Barcode size={18} /> Relevamiento de artículos</button>}
      <button type="button" className={mode === 'list' ? 'btn-primary' : 'btn-ghost'} disabled={busy} onClick={() => switchMode('list')}><Package size={18} /> Artículos</button>
    </nav>
    {error && <p className="articulos-error" role="alert">{error}</p>}
    {notice && <p className="articulos-notice" role="status">{notice}</p>}
    {warnings.map((w, i) => <p key={i} className="articulos-warning">{w}</p>)}
    {busy && <p role="status">{form ? 'Guardando / consultando artículo…' : 'Buscando en el maestro y las fuentes disponibles…'}</p>}
    {!form && mode === 'scan' && <section className="articulos-card">
      <button type="button" className="btn-primary articulos-scan" disabled={busy} onClick={() => setScanner(true)}><Barcode size={28} /> ESCANEAR CÓDIGO</button>
      <form onSubmit={e => { e.preventDefault(); lookup(code) }} className="articulos-code">
        <label htmlFor="product-code">O ingresá el código manualmente</label>
        <div><input id="product-code" className="input-dark" inputMode="numeric" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder="EAN, UPC o GTIN-14" maxLength={14} disabled={busy} /><button className="btn-ghost" disabled={busy || !code}>Buscar</button></div>
      </form>
      <p>Se consulta primero nuestra base. Si el producto no está identificado, podés cargarlo manualmente.</p>
    </section>}
    {!form && mode === 'list' && <section>
      <form className="articulos-search" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(0); setRefresh(n => n + 1) }}>
        <label htmlFor="article-search">Buscar por código, nombre, marca o categoría</label>
        <div><input id="article-search" className="input-dark" value={search} maxLength={200} onChange={e => setSearch(e.target.value)} /><button className="btn-ghost" aria-label="Buscar artículos"><Search size={18} /></button></div>
      </form>
      {loading ? <p role="status">Cargando artículos…</p> : listError ? <p role="alert" className="articulos-error">{listError} <button className="btn-ghost" onClick={() => setRefresh(n => n + 1)}>Reintentar</button></p> : rows.length === 0 ? <p>No hay artículos para esta búsqueda.</p> : <div className="articulos-list">{rows.map(row => <button disabled={busy} className="articulos-card articulos-row" type="button" key={row.id} onClick={() => lookup(row.barcodes?.[0]?.barcode || '', true)}>
        {safeImageUrl(row.image_url) ? <img src={safeImageUrl(row.image_url)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Package size={32} />}
        <span><strong>{row.name}</strong><span>{row.brand || 'Sin marca registrada'} · {row.category || 'Sin categoría'}</span><span>{row.presentations?.map(p => p.presentation).filter(Boolean).join(' · ')}</span><code>{row.barcodes?.map(b => b.barcode).join(' · ')}</code></span><span>Ver ficha →</span>
      </button>)}</div>}
      <div className="articulos-actions"><button className="btn-ghost" disabled={page === 0 || loading || busy} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page + 1}</span><button className="btn-ghost" disabled={rows.length < 30 || loading || busy} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>
    </section>}
    {form && <section className="articulos-card">
      <div className="articulos-actions"><button type="button" className="btn-ghost" disabled={busy} onClick={() => { if (canLeave()) reset() }}>← Volver</button>{writable && !editing && <button type="button" className="btn-primary" disabled={busy} onClick={() => setEditing(true)}>EDITAR</button>}</div>
      <div className="articulos-product-head">{image ? <img src={image} alt={form.name || 'Imagen del artículo'} referrerPolicy="no-referrer" /> : <div className="articulos-placeholder"><Package size={40} /><span>Sin imagen</span></div>}<div><h2>{form.name || 'Nuevo artículo'}</h2><p>{form.brand || 'Marca sin completar'}</p><code>{form.barcode}</code><p>{barcodeType(form.barcode)} · {({ unit:'Unidad', case:'Caja / bulto', unknown:'Presentación por confirmar' })[form.packaging_level]}</p><p>{form.presentation}</p></div></div>
      {writable && <section className="articulos-enrichment" aria-label="Completar datos del artículo">
        <button type="button" className="btn-ghost" disabled={busy} onClick={completeMissing}>Completar datos faltantes</button>
        <p>Consulta fuentes adicionales y propone datos para campos vacíos. Se conservan tus correcciones.</p>
        <details><summary>Agregar una ficha de Precialo</summary><label>Enlace de Precialo (opcional)<input className="input-dark" type="url" disabled={busy} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://precialo.com.ar/p/..." /></label><p>Se comprueba que la ficha contenga el código exacto. Pegá el enlace y pulsá Completar datos faltantes.</p></details>
        {proposals.length > 0 && <div className="articulos-proposals">
          <h3>Datos propuestos</h3>
          {proposals.map((proposal,i) => <div key={i}><p>Fuente: <a href={proposal.source.source_url} target="_blank" rel="noreferrer">{proposal.source.provider}</a>{proposal.source.provider?.startsWith('Open ') && ' · ODbL / CC BY-SA'}</p><dl>{Object.entries(proposal.fields).map(([key,value]) => <div key={key}><dt>{PRODUCT_FIELD_LABELS[key]}</dt><dd>{key === 'image_url' ? <img src={safeImageUrl(value)} alt="Imagen propuesta" referrerPolicy="no-referrer" /> : key === 'packaging_level' ? ({ unit:'Unidad individual', case:'Caja / bulto' })[value] : String(value)}</dd></div>)}</dl></div>)}
          <div className="articulos-actions"><button type="button" className="btn-primary" disabled={busy} onClick={acceptProposals}>Aplicar datos propuestos</button><button type="button" className="btn-ghost" disabled={busy} onClick={() => setProposals([])}>Descartar propuestas</button></div>
        </div>}
      </section>}
      {!validCheckDigit(form.barcode) && <div className="articulos-warning">El dígito verificador no coincide. Cotejá todos los dígitos con la etiqueta.{editing && <label><input type="checkbox" checked={confirmedCode} onChange={e => setConfirmedCode(e.target.checked)} /> Revisé el código y confirmo que corresponde a la etiqueta.</label>}</div>}
      <form onSubmit={e => { e.preventDefault(); save(false) }}>
        <fieldset disabled={!editing || busy} className="articulos-fields">
          {fields.map(([key, label]) => <label key={key}>{label}<input className="input-dark" value={form[key] || ''} onChange={e => update(key, e.target.value)} maxLength={key === 'name' ? 500 : 2000} required={key === 'name'} /></label>)}
          <label>Nivel de empaque<select className="input-dark" value={form.packaging_level} onChange={e => update('packaging_level', e.target.value)}><option value="unknown">Por confirmar</option><option value="unit">Unidad individual</option><option value="case">Caja / bulto</option></select></label>
          <label>Contenido por unidad contenida<input className="input-dark" type="number" min="0.001" step="any" value={form.net_quantity ?? ''} onChange={e => update('net_quantity', e.target.value)} placeholder="Ej.: 8" /></label>
          <label>Unidad de contenido<select className="input-dark" value={form.net_unit || ''} onChange={e => update('net_unit', e.target.value)}><option value="">Sin definir</option>{['g','kg','mg','ml','l','unidad','m','cm'].map(unit => <option key={unit}>{unit}</option>)}</select></label>
          <label>Unidades contenidas por caja / bulto<input className="input-dark" type="number" min="1" step="1" value={form.units_per_package ?? ''} onChange={e => update('units_per_package', e.target.value)} placeholder="Ej.: 192" /></label>
          <p className="articulos-wide">Una caja de 192 sobres de 8 g se registra como 192 unidades contenidas y 8 g por unidad. Verificá esos datos en el envase.</p>
          {[['description','Descripción comercial'],['ingredients','Ingredientes'],['allergens','Alérgenos'],['nutrition_text','Información nutricional (incluí base, porción y unidades)']].map(([key,label]) => <label key={key} className="articulos-wide">{label}<textarea className="input-dark" rows={3} maxLength={20000} value={form[key] || ''} onChange={e => update(key, e.target.value)} placeholder="Sin información registrada" /></label>)}
          <label className="articulos-wide">Dirección de imagen (HTTPS)<input className="input-dark" type="url" value={form.image_url || ''} onChange={e => update('image_url', e.target.value)} /></label>
          {editing && <label className="articulos-wide">O tomar / subir foto (JPG, PNG o WebP, hasta 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const selected = e.target.files?.[0]; if (!selected) return; if (!['image/jpeg','image/png','image/webp'].includes(selected.type) || selected.size > 8 * 1024 * 1024) { setError('Elegí una imagen JPG, PNG o WebP de hasta 8 MB.'); e.target.value = ''; return } setFile(selected); uploaded.current = null; setDirty(true) }} /></label>}
        </fieldset>
        <div className="articulos-sources"><h3>Fuentes y actualización</h3><p>{form.updated_at ? `Última actualización: ${new Date(form.updated_at).toLocaleString('es-AR')}` : 'Todavía no guardado'}</p>{displayProductSources([...(form.source ? [form.source] : []), ...(form.sources || [])]).map((source,i) => <p key={source.id || i}>{safeImageUrl(source.source_url) ? <a href={source.source_url} target="_blank" rel="noreferrer">{source.provider}</a> : source.provider} · {new Date(source.retrieved_at).toLocaleString('es-AR')}{source.provider?.startsWith('Open ') && ' · ODbL (datos) / CC BY-SA (imágenes)'}</p>)}{!form.source && !form.sources?.length && <p>Carga manual: se registrará al guardar.</p>}</div>
        {editing && writable && <div className="articulos-actions"><button className="btn-primary" disabled={busy}>GUARDAR ARTÍCULO</button><button type="button" className="btn-ghost" disabled={busy} onClick={() => save(true)}>GUARDAR Y ESCANEAR SIGUIENTE</button></div>}
      </form>
    </section>}
    {scanner && <ProductBarcodeScanner onClose={() => setScanner(false)} onScan={barcode => { setScanner(false); lookup(barcode) }} />}
  </div>
}
