import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Barcode, Package, Search } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { productResolver, findProduct, saveProduct, searchProducts, validateProduct, enrichProduct, downloadProductsXlsx, recordBarcodeSearch, listKioskSites, loadProductSiteSettings, saveProductSiteSetting } from '../lib/productQueries'
import { missingProposals, applyProductProposals, displayProductSources, PRODUCT_FIELD_LABELS } from '../lib/productEnrichment'
import { barcodeType, normalizeBarcode, safeImageUrl, validCheckDigit } from '../lib/productBarcode'
import { uploadAdjunto } from '../lib/adjuntos'
import { useBackHandler } from '../lib/backStack'
import ProductBarcodeScanner from '../components/ProductBarcodeScanner'
import './Articulos.css'

const empty = barcode => ({ product_id:crypto.randomUUID(), barcode, name:'', description:'', brand:'', manufacturer:'', category:'', subcategory:'', image_url:'', ingredients:'', allergens:'', nutrition_text:'', country_of_origin:'', presentation:'', net_quantity:'', net_unit:'', units_per_package:'', packaging_level:'unknown', rne:'', rnpa:'', storage_conditions:'', related_barcodes:[], source:null, stock_unit:'unidad', stock_factor:'1', presentation_active:true, status:'verified' })
const fields = [['name','Nombre del artículo *'],['brand','Marca'],['manufacturer','Fabricante'],['category','Categoría'],['subcategory','Subcategoría'],['country_of_origin','País de origen'],['rne','RNE'],['rnpa','RNPA'],['presentation','Presentación / descripción del envase']]
const packagingLabels = { unit:'Unidad', pack:'Pack', box:'Caja', case:'Caja / bulto', pallet:'Pallet', unknown:'Presentación por confirmar' }

export function RelevamientoArticulos() { return <Articulos initialMode="scan" /> }

export default function Articulos({ initialMode = 'list', onNavigate, embedded = false }) {
  const { can, perfil } = useAuth()
  const writable = can('articulos')
  const canConfigureKiosk = can('kiosco', 'configure')
  const isDeposito = perfil?.rol === 'deposito'
  const [mode, setMode] = useState(isDeposito ? 'scan' : initialMode)
  const [code, setCode] = useState('')
  const [scanner, setScanner] = useState(false)
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const codeInput = useRef(null)
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
  const [exporting, setExporting] = useState(false)
  const [listError, setListError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [sourceUrl, setSourceUrl] = useState('')
  const [proposals, setProposals] = useState([])
  const [kioskSites, setKioskSites] = useState([])
  const [siteSettings, setSiteSettings] = useState({})
  const [siteConfigBusy, setSiteConfigBusy] = useState(null)
  const [siteConfigError, setSiteConfigError] = useState('')
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
  useEffect(() => {
    if (mode === 'scan' && !form && !scanner && !busy) codeInput.current?.focus()
  }, [mode, form, scanner, busy])
  useEffect(() => {
    let stale = false
    listKioskSites().then(data => { if (!stale) setKioskSites(data) }).catch(() => { if (!stale) setKioskSites([]) })
    return () => { stale = true }
  }, [])
  useEffect(() => {
    if (!form?.expected_updated_at || !form?.presentation_id) { setSiteSettings({}); return }
    let stale = false
    setSiteConfigError('')
    loadProductSiteSettings(form.product_id, form.presentation_id).then(data => {
      if (stale) return
      setSiteSettings(Object.fromEntries(data.map(item => [item.sede_id, {
        ...item,
        sale_price:item.sale_price ?? '', reference_cost:item.reference_cost ?? '', stock_minimum:item.stock_minimum ?? 0,
      }])))
    }).catch(e => { if (!stale) setSiteConfigError(e.message || 'No se pudo cargar la configuración por sede.') })
    return () => { stale = true }
  }, [form?.expected_updated_at, form?.presentation_id, form?.product_id])

  const reset = () => { setForm(null); setCode(''); setFile(null); uploaded.current = null; setDirty(false); setError(''); setWarnings([]); setConfirmedCode(false); setEditing(false); setProposals([]); setSourceUrl('') }
  const canLeave = () => !dirty || window.confirm('Hay cambios sin guardar. ¿Querés descartarlos?')
  const goBack = () => {
    if (busyRef.current || !canLeave()) return
    reset()
    if (onNavigate) onNavigate('inicio')
    else window.history.back()
  }
  const switchMode = next => { if (busyRef.current || !canLeave()) return; reset(); setMode(next); setNotice('') }
  const update = (key, value) => { setForm(f => ({ ...f, [key]:value })); setDirty(true) }
  const addRelatedBarcode = () => {
    setForm(current => ({ ...current, related_barcodes:[...(current.related_barcodes || []), { barcode:'',presentation:'',packaging_level:'unit',stock_factor:'1',units_per_package:'' }] }))
    setDirty(true)
  }
  const updateRelatedBarcode = (index, key, value) => {
    setForm(current => ({ ...current, related_barcodes:(current.related_barcodes || []).map((item,i) => i === index ? { ...item,[key]:value } : item) }))
    setDirty(true)
  }
  const removeUnsavedBarcode = index => {
    setForm(current => ({ ...current, related_barcodes:(current.related_barcodes || []).filter((_,i) => i !== index) }))
    setDirty(true)
  }
  const updateSiteSetting = (sedeId, key, value) => setSiteSettings(current => ({
    ...current,
    [sedeId]:{
      sale_price:'', reference_cost:'', stock_minimum:0, currency:'ARS', active:false,
      ...(current[sedeId] || {}), [key]:value,
    },
  }))
  async function saveSiteSetting(site) {
    if (!form?.presentation_id || siteConfigBusy) return
    setSiteConfigBusy(site.id); setSiteConfigError('')
    try {
      const saved = await saveProductSiteSetting({
        ...(siteSettings[site.id] || {}), sede_id:site.id, product_id:form.product_id, presentation_id:form.presentation_id,
      })
      setSiteSettings(current => ({ ...current, [site.id]:{ ...saved, sale_price:saved.sale_price ?? '', reference_cost:saved.reference_cost ?? '' } }))
      setNotice(`Configuración de ${site.nombre} guardada.`)
    } catch (e) { setSiteConfigError(e.message || 'No se pudo guardar la configuración de la sede.') }
    finally { setSiteConfigBusy(null) }
  }
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
  async function exportXlsx() {
    if (exporting || loading) return
    setExporting(true); setListError('')
    try { const result = await downloadProductsXlsx(query); setNotice(`Excel descargado: ${result.count} filas de artículos y ${result.sources} fuentes.`) }
    catch (e) { setListError(`No se pudo descargar el Excel: ${e.message}`) }
    finally { setExporting(false) }
  }
  function acceptProposals() {
    setForm(current => applyProductProposals(current, proposals))
    setProposals([]); setDirty(true); setEditing(true)
    setNotice('Datos propuestos aplicados a campos vacíos. Revisá la ficha y guardá el artículo.')
  }
  async function lookup(value, localOnly = false) {
    if (busyRef.current || !canLeave()) return
    let barcode
    try { barcode = normalizeBarcode(value) } catch (e) { setCode(''); setError(e.message); codeInput.current?.focus(); return }
    setCode('')
    busyRef.current = true; setBusy(true); setError(''); setNotice(''); setScanner(false)
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    const started = performance.now()
    try {
      const result = localOnly ? { product:await findProduct(barcode), origin:'local', warnings:[] } : await productResolver.resolve(barcode, { signal:controller.signal })
      if (controller.signal.aborted) return
      if (localOnly && !result.product) throw new Error('El artículo ya no está disponible. Actualizá el listado.')
      reset(); setWarnings(result.warnings || [])
      setForm(result.product ? { ...empty(barcode), ...result.product } : empty(barcode))
      setEditing(result.origin !== 'local' && writable)
      setDirty(result.origin !== 'local')
      setNotice(result.origin === 'local' ? 'Artículo encontrado en nuestro maestro.' : result.product ? 'Datos encontrados. Revisá la etiqueta y completá la presentación antes de guardar.' : 'Producto no identificado')
      recordBarcodeSearch({ barcode, found:Boolean(result.product), sourceCode:result.origin === 'local' ? 'INTERNAL' : result.product?.source?.source_code || 'NOT_FOUND', durationMs:performance.now()-started }).catch(()=>{})
    } catch (e) { if (!controller.signal.aborted) { setError(e.message || 'No se pudo buscar el artículo.'); recordBarcodeSearch({ barcode, found:false, sourceCode:'ERROR', durationMs:performance.now()-started, errorMessage:e.message }).catch(()=>{}) } }
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
      if (next) { reset(); setMode('scan'); setScanner(false) }
    } catch (e) {
      setDirty(true)
      setError(`${saved ? 'El artículo se guardó, pero falta completar la imagen. Reintentá guardar. ' : ''}${e.message || 'No se pudo guardar.'}`)
    } finally { busyRef.current = false; setBusy(false) }
  }
  const image = filePreview || safeImageUrl(form?.image_url)
  return <div className="articulos-view">
    {!embedded && <button type="button" className="btn-ghost articulos-back" disabled={busy} onClick={goBack}><ArrowLeft size={18} /> Volver atrás</button>}
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
        <label htmlFor="product-code">Escaneá con pistola o ingresá el código manualmente</label>
        <div><input ref={codeInput} id="product-code" className="input-dark" inputMode="numeric" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder="Listo para escanear · EAN, UPC o GTIN-14" maxLength={14} disabled={busy} /><button className="btn-ghost" disabled={busy || !code}>Buscar</button></div>
      </form>
      <p>Se consulta primero nuestra base. Si el producto no está identificado, podés cargarlo manualmente.</p>
    </section>}
    {!form && mode === 'list' && <section>
      <div className="articulos-actions"><button type="button" className="btn-ghost" disabled={exporting || loading} onClick={exportXlsx}>Descargar base en Excel</button></div>
      <form className="articulos-search" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(0); setRefresh(n => n + 1) }}>
        <label htmlFor="article-search">Buscar por código, nombre, marca o categoría</label>
        <div><input id="article-search" className="input-dark" value={search} maxLength={200} onChange={e => setSearch(e.target.value)} /><button className="btn-ghost" aria-label="Buscar artículos"><Search size={18} /></button></div>
      </form>
      {loading ? <p role="status">Cargando artículos…</p> : listError ? <p role="alert" className="articulos-error">{listError} <button className="btn-ghost" onClick={() => setRefresh(n => n + 1)}>Reintentar</button></p> : rows.length === 0 ? <p>No hay artículos para esta búsqueda.</p> : <div className="articulos-list">{rows.map(row => <button disabled={busy} className="articulos-card articulos-row" type="button" key={row.id} onClick={() => lookup(row.barcodes?.[0]?.barcode || '', true)}>
        {safeImageUrl(row.image_url) ? <img src={safeImageUrl(row.image_url)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Package size={32} />}
        <span><strong>{row.name}</strong><span>{row.internal_code || 'Código interno pendiente'} · {row.brand || 'Sin marca registrada'} · {row.category || 'Sin categoría'}</span><span>{row.presentations?.map(p => p.presentation).filter(Boolean).join(' · ')}</span><code>{row.barcodes?.map(b => b.barcode).join(' · ')}</code></span><span>Ver ficha →</span>
      </button>)}</div>}
      <div className="articulos-actions"><button className="btn-ghost" disabled={page === 0 || loading || busy} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page + 1}</span><button className="btn-ghost" disabled={rows.length < 30 || loading || busy} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>
    </section>}
    {form && <section className="articulos-card">
      <div className="articulos-actions"><button type="button" className="btn-ghost" disabled={busy} onClick={() => { if (canLeave()) reset() }}>← Volver</button>{writable && !editing && <button type="button" className="btn-primary" disabled={busy} onClick={() => setEditing(true)}>EDITAR</button>}</div>
      <div className="articulos-product-head">{image ? <img src={image} alt={form.name || 'Imagen del artículo'} referrerPolicy="no-referrer" /> : <div className="articulos-placeholder"><Package size={40} /><span>Sin imagen</span></div>}<div><h2>{form.name || 'Nuevo artículo'}</h2><p>{form.internal_code || 'El código interno se asignará al guardar'} · {form.brand || 'Marca sin completar'}</p><code>{form.barcode}</code><p>{barcodeType(form.barcode)} · {packagingLabels[form.packaging_level]}</p><p>{form.presentation}</p></div></div>
      {form.related_barcodes?.length > 0 && <div className="articulos-related"><h3>Códigos relacionados del mismo producto</h3>{form.related_barcodes.map(item => <p key={item.barcode}><code>{item.barcode}</code> · {barcodeType(item.barcode)} · {packagingLabels[item.packaging_level] || item.packaging_level}{item.units_per_package ? ` · ${item.units_per_package} unidades` : ''}</p>)}<p>Al guardar, estos códigos quedarán vinculados a la misma ficha.</p></div>}
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
          <label>Código interno<input className="input-dark" value={form.internal_code || 'Se asigna automáticamente'} readOnly /></label>
          <label>Estado del artículo<select className="input-dark" value={form.status || 'verified'} onChange={e => update('status',e.target.value)}><option value="verified">Activo / verificado</option><option value="pending">Pendiente de verificación</option><option value="inactive">Inactivo</option></select></label>
          {fields.map(([key, label]) => <label key={key}>{label}<input className="input-dark" value={form[key] || ''} onChange={e => update(key, e.target.value)} maxLength={key === 'name' ? 500 : 2000} required={key === 'name'} /></label>)}
          <label>Unidad base de stock<input className="input-dark" value={form.stock_unit || ''} onChange={e => update('stock_unit',e.target.value)} maxLength={30} placeholder="Ej.: unidad" /></label>
          <label>Factor de stock de esta presentación<input className="input-dark" type="number" min="0.001" step="any" value={form.stock_factor ?? ''} onChange={e => update('stock_factor',e.target.value)} /><span className="articulos-help">Cuántas unidades base representa este código. Ej.: una caja de 12 = 12.</span></label>
          <label>Nivel de empaque<select className="input-dark" value={form.packaging_level} onChange={e => update('packaging_level', e.target.value)}><option value="unknown">Por confirmar</option><option value="unit">Unidad individual</option><option value="pack">Pack</option><option value="box">Caja</option><option value="case">Caja / bulto</option><option value="pallet">Pallet</option></select></label>
          <label>Contenido por unidad contenida<input className="input-dark" type="number" min="0.001" step="any" value={form.net_quantity ?? ''} onChange={e => update('net_quantity', e.target.value)} placeholder="Ej.: 8" /></label>
          <label>Unidad de contenido<select className="input-dark" value={form.net_unit || ''} onChange={e => update('net_unit', e.target.value)}><option value="">Sin definir</option>{['g','kg','mg','ml','l','unidad','m','cm'].map(unit => <option key={unit}>{unit}</option>)}</select></label>
          <label>Unidades contenidas por caja / bulto<input className="input-dark" type="number" min="1" step="1" value={form.units_per_package ?? ''} onChange={e => update('units_per_package', e.target.value)} placeholder="Ej.: 192" /></label>
          <p className="articulos-wide">Una caja de 192 sobres de 8 g se registra como 192 unidades contenidas y 8 g por unidad. Verificá esos datos en el envase.</p>
          <section className="articulos-wide articulos-barcodes-editor">
            <div className="articulos-section-title"><div><h3>Códigos adicionales</h3><p>Asociá otros EAN, UPC o GTIN-14 a este mismo producto y definí cuántas unidades base representa cada presentación.</p></div>{editing && <button type="button" className="btn-ghost" onClick={addRelatedBarcode}>+ Agregar código</button>}</div>
            {(form.related_barcodes || []).map((item,index) => <div className="articulos-barcode-line" key={item.id || `${index}-${item.barcode}`}>
              <label>Código<input className="input-dark" inputMode="numeric" maxLength={14} value={item.barcode || ''} onChange={e => updateRelatedBarcode(index,'barcode',e.target.value)} /></label>
              <label>Presentación<input className="input-dark" value={item.presentation || ''} onChange={e => updateRelatedBarcode(index,'presentation',e.target.value)} placeholder="Ej.: Caja x 12" /></label>
              <label>Empaque<select className="input-dark" value={item.packaging_level || 'unknown'} onChange={e => updateRelatedBarcode(index,'packaging_level',e.target.value)}><option value="unit">Unidad</option><option value="pack">Pack</option><option value="box">Caja</option><option value="case">Bulto</option><option value="pallet">Pallet</option><option value="unknown">Por confirmar</option></select></label>
              <label>Factor<input className="input-dark" type="number" min="0.001" step="any" value={item.stock_factor ?? item.units_per_package ?? 1} onChange={e => updateRelatedBarcode(index,'stock_factor',e.target.value)} /></label>
              {editing && !item.id && <button type="button" className="btn-ghost" onClick={() => removeUnsavedBarcode(index)}>Quitar</button>}
              {item.id && <span className="articulos-code-saved">Registrado</span>}
            </div>)}
            {!(form.related_barcodes || []).length && <p>No hay códigos adicionales asociados.</p>}
          </section>
          {[['description','Descripción comercial'],['ingredients','Ingredientes'],['allergens','Alérgenos'],['nutrition_text','Información nutricional (incluí base, porción y unidades)']].map(([key,label]) => <label key={key} className="articulos-wide">{label}<textarea className="input-dark" rows={3} maxLength={20000} value={form[key] || ''} onChange={e => update(key, e.target.value)} placeholder="Sin información registrada" /></label>)}
          <label className="articulos-wide">Condiciones de conservación<textarea className="input-dark" rows={2} maxLength={2000} value={form.storage_conditions || ''} onChange={e => update('storage_conditions',e.target.value)} placeholder="Ej.: conservar refrigerado entre 2 °C y 8 °C" /></label>
          <label className="articulos-wide articulos-checkbox"><input type="checkbox" checked={form.presentation_active !== false} onChange={e => update('presentation_active',e.target.checked)} /> Presentación disponible</label>
          <label className="articulos-wide">Dirección de imagen (HTTPS)<input className="input-dark" type="url" value={form.image_url || ''} onChange={e => update('image_url', e.target.value)} /></label>
          {editing && <label className="articulos-wide">O tomar / subir foto (JPG, PNG o WebP, hasta 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const selected = e.target.files?.[0]; if (!selected) return; if (!['image/jpeg','image/png','image/webp'].includes(selected.type) || selected.size > 8 * 1024 * 1024) { setError('Elegí una imagen JPG, PNG o WebP de hasta 8 MB.'); e.target.value = ''; return } setFile(selected); uploaded.current = null; setDirty(true) }} /></label>}
        </fieldset>
        <div className="articulos-sources"><h3>Fuentes y actualización</h3><p>{form.updated_at ? `Última actualización: ${new Date(form.updated_at).toLocaleString('es-AR')}` : 'Todavía no guardado'}</p>{displayProductSources([...(form.source ? [form.source] : []), ...(form.sources || [])]).map((source,i) => <p key={source.id || i}>{safeImageUrl(source.source_url) ? <a href={source.source_url} target="_blank" rel="noreferrer">{source.provider}</a> : source.provider} · {new Date(source.retrieved_at).toLocaleString('es-AR')}{source.provider?.startsWith('Open ') && ' · ODbL (datos) / CC BY-SA (imágenes)'}</p>)}{!form.source && !form.sources?.length && <p>Carga manual: se registrará al guardar.</p>}</div>
        {editing && writable && <div className="articulos-actions"><button className="btn-primary" disabled={busy}>GUARDAR ARTÍCULO</button><button type="button" className="btn-ghost" disabled={busy} onClick={() => save(true)}>GUARDAR Y ESCANEAR SIGUIENTE</button></div>}
      </form>
      {form.expected_updated_at && <section className="articulos-site-settings" aria-label="Configuración Kiosco por sede">
        <h3>Configuración Kiosco por sede</h3>
        <p>El maestro es global. Precio, costo de referencia, mínimo y disponibilidad se guardan de forma independiente para esta presentación en cada sede asignada con Kiosco habilitado.</p>
        {siteConfigError && <p className="articulos-error" role="alert">{siteConfigError}</p>}
        {!kioskSites.length ? <p>No tenés sedes asignadas con Kiosco habilitado.</p> : <div className="articulos-site-grid">
          {kioskSites.map(site => {
            const setting = siteSettings[site.id] || { sale_price:'',reference_cost:'',stock_minimum:0,currency:'ARS',active:false }
            return <article key={site.id} className="articulos-site-card">
              <div><strong>{site.nombre}</strong><span>{site.tipo}</span></div>
              <label>Precio de venta<input className="input-dark" type="number" min="0" step="0.01" disabled={!canConfigureKiosk || siteConfigBusy === site.id} value={setting.sale_price} onChange={e => updateSiteSetting(site.id,'sale_price',e.target.value)} /></label>
              <label>Costo de referencia<input className="input-dark" type="number" min="0" step="0.01" disabled={!canConfigureKiosk || siteConfigBusy === site.id} value={setting.reference_cost} onChange={e => updateSiteSetting(site.id,'reference_cost',e.target.value)} /></label>
              <label>Stock mínimo<input className="input-dark" type="number" min="0" step="any" disabled={!canConfigureKiosk || siteConfigBusy === site.id} value={setting.stock_minimum} onChange={e => updateSiteSetting(site.id,'stock_minimum',e.target.value)} /></label>
              <label className="articulos-checkbox"><input type="checkbox" disabled={!canConfigureKiosk || siteConfigBusy === site.id} checked={Boolean(setting.active)} onChange={e => updateSiteSetting(site.id,'active',e.target.checked)} /> Disponible para vender</label>
              {canConfigureKiosk && <button type="button" className="btn-ghost" disabled={Boolean(siteConfigBusy)} onClick={() => saveSiteSetting(site)}>{siteConfigBusy === site.id ? 'Guardando…' : 'Guardar sede'}</button>}
            </article>
          })}
        </div>}
      </section>}
    </section>}
    {scanner && <ProductBarcodeScanner onClose={() => setScanner(false)} onScan={barcode => { setScanner(false); lookup(barcode) }} />}
  </div>
}
