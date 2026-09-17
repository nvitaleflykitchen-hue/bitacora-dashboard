import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Barcode, Boxes, ClipboardList, History, Minus, PackagePlus, Plus, Printer, ReceiptText, Search, ShoppingCart, Trash2, XCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { listKioskSites } from '../lib/productQueries'
import {
  annulSale, confirmReceipt, confirmSale, finalizeInventoryCount, getKioskIndicators,
  getSaleDetail, listInventoryCounts, listInventoryMovements, listKioskCatalog,
  listReceipts, listSales, localDate, money, saveInventoryCountLine, startInventoryCount,
} from '../lib/kioskQueries'
import Articulos from './Articulos'
import './Kiosco.css'

const tabs = [
  ['venta','Venta',ShoppingCart],['reposicion','Reposición',PackagePlus],['inventario','Inventario',ClipboardList],
  ['stock','Stock',Boxes],['ventas','Ventas',ReceiptText],['movimientos','Movimientos',History],['articulos','Artículos',Barcode],
]
const today = () => new Date().toISOString().slice(0,10)
const cartKey = siteId => `fly:kiosk:cart:${siteId}`

function CatalogPicker({ rows, onPick, empty = 'No se encontraron artículos.' }) {
  if (!rows.length) return <p className="kiosk-empty">{empty}</p>
  return <div className="kiosk-picker">{rows.map(row => <button type="button" key={row.presentation_id} onClick={() => onPick(row)}>
    <span><strong>{row.name}</strong><small>{row.internal_code} · {row.presentation || 'Presentación principal'}</small><small>{(row.barcodes || []).join(' · ')}</small></span>
    <span><strong>{money(row.sale_price,row.currency)}</strong><small>Stock {Number(row.stock_current)}</small></span>
  </button>)}</div>
}

function QuantityButtons({ value, onChange, onRemove }) {
  return <div className="kiosk-qty">
    <button type="button" aria-label="Disminuir cantidad" onClick={() => value<=1 ? onRemove() : onChange(value-1)}><Minus size={16}/></button>
    <input aria-label="Cantidad" type="number" min="0.001" step="any" value={value} onChange={e => onChange(Math.max(0.001,Number(e.target.value)||1))}/>
    <button type="button" aria-label="Aumentar cantidad" onClick={() => onChange(value+1)}><Plus size={16}/></button>
    <button type="button" aria-label="Quitar artículo" onClick={onRemove}><Trash2 size={16}/></button>
  </div>
}

function ScannerSearch({ label, busy, onSearch, inputRef, actionLabel = 'Agregar' }) {
  const [term,setTerm]=useState('')
  const inputId=`kiosk-search-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`
  const submit=async e=>{e.preventDefault();if(!term.trim())return;const keep=await onSearch(term.trim());if(keep!==false)setTerm('');queueMicrotask(()=>inputRef?.current?.focus())}
  return <form className="kiosk-scan" onSubmit={submit}>
    <label htmlFor={inputId}>{label}<span>El lector escribe el código y confirma con Enter.</span></label>
    <div><Barcode size={22}/><input id={inputId} ref={inputRef} autoFocus autoComplete="off" inputMode="search" value={term} disabled={busy} onChange={e=>setTerm(e.target.value)} placeholder="Escanear código o buscar por nombre…"/><button disabled={busy||!term.trim()}>{actionLabel}</button></div>
  </form>
}

function CurrentSale({ site, catalog, reloadCatalog, indicators, reloadIndicators, canSell, onOpenArticles }) {
  const inputRef=useRef(null)
  const [cart,setCart]=useState([]),[results,setResults]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [paying,setPaying]=useState(false),[method,setMethod]=useState('EFECTIVO'),[received,setReceived]=useState(''),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState(null)
  useEffect(()=>{try{setCart(JSON.parse(localStorage.getItem(cartKey(site.id))||'[]'))}catch{setCart([])};setReceipt(null);setResults([])},[site.id])
  useEffect(()=>{localStorage.setItem(cartKey(site.id),JSON.stringify(cart))},[cart,site.id])
  const total=useMemo(()=>cart.reduce((sum,item)=>sum+Number(item.sale_price)*Number(item.quantity),0),[cart])
  const add=row=>{setError('');setResults([]);if(!row.active)return setError('El artículo no está habilitado para vender en esta sede.');if(Number(row.stock_current)<=0)return setError(`${row.name} no tiene stock.`);setCart(items=>{const found=items.find(x=>x.presentation_id===row.presentation_id);if(found){if((found.quantity+1)*Number(row.stock_factor)>Number(row.stock_current)){setError(`No hay más stock disponible de ${row.name}.`);return items}return items.map(x=>x.presentation_id===row.presentation_id?{...x,quantity:x.quantity+1}:x)}return[...items,{...row,quantity:1,barcode:row.barcodes?.[0]||''}]});setNotice(`${row.name} agregado.`)}
  const search=async term=>{setBusy(true);setError('');try{const rows=await listKioskCatalog(site.id,term);const exact=rows.find(r=>(r.barcodes||[]).includes(term));if(exact||rows.length===1)add(exact||rows[0]);else{setResults(rows);if(!rows.length)setError('Producto no registrado o no configurado para esta sede.')}}catch(e){setError(e.message)}finally{setBusy(false)}}
  const updateQty=(id,quantity)=>setCart(items=>items.map(x=>x.presentation_id===id?{...x,quantity:Math.min(quantity,Number(x.stock_current)/Number(x.stock_factor))}:x))
  const charge=async()=>{if(!cart.length||busy)return;setBusy(true);setError('');try{const sale=await confirmSale({sedeId:site.id,items:cart.map(x=>({presentation_id:x.presentation_id,quantity:x.quantity,barcode:x.barcode})),paymentMethod:method,received:method==='EFECTIVO'?received:total});const detail=await getSaleDetail(sale.id);setReceipt(detail);setCart([]);setPaying(false);setReceived('');await Promise.all([reloadCatalog(),reloadIndicators()]);setNotice(`Venta ${sale.operation_number} registrada.`)}catch(e){setError(e.message||'No se pudo confirmar la venta.')}finally{setBusy(false);queueMicrotask(()=>inputRef.current?.focus())}}
  return <div className="kiosk-workspace">
    <section className="kiosk-main-panel">
      <ScannerSearch label="Venta actual" busy={busy} onSearch={search} inputRef={inputRef}/>
      {error&&<div className="kiosk-error" role="alert">{error}{error.includes('no registrado')&&<button type="button" onClick={onOpenArticles}>Crear artículo</button>}</div>}
      {notice&&<p className="kiosk-notice" role="status">{notice}</p>}
      {results.length>1&&<CatalogPicker rows={results} onPick={add}/>} 
      {!cart.length?<div className="kiosk-hero-empty"><ShoppingCart size={48}/><h2>Listo para vender</h2><p>Escaneá el primer producto. El foco vuelve automáticamente al lector.</p></div>:<div className="kiosk-ticket-lines">{cart.map(item=><article key={item.presentation_id}>
        <div><strong>{item.name}</strong><small>{item.presentation||item.internal_code}</small></div>
        <QuantityButtons value={item.quantity} onChange={q=>updateQty(item.presentation_id,q)} onRemove={()=>setCart(c=>c.filter(x=>x.presentation_id!==item.presentation_id))}/>
        <span>{money(item.sale_price*item.quantity,item.currency)}</span>
      </article>)}</div>}
    </section>
    <aside className="kiosk-checkout">
      <div className="kiosk-kpis"><span>Ventas hoy<strong>{money(indicators.sales_today)}</strong></span><span>Operaciones<strong>{indicators.operations_today||0}</strong></span><span>Stock bajo<strong>{indicators.low_stock||0}</strong></span></div>
      <div className="kiosk-total"><span>TOTAL</span><strong>{money(total)}</strong></div>
      {!paying?<><button className="kiosk-charge" disabled={!cart.length||!canSell||busy} onClick={()=>setPaying(true)}>COBRAR</button>{cart.length>0&&<button className="btn-ghost" onClick={()=>{setCart([]);setResults([])}}>Cancelar venta</button>}</>:<div className="kiosk-payment">
        <h3>Cobro</h3><label>Medio de pago<select value={method} onChange={e=>setMethod(e.target.value)}>{['EFECTIVO','TARJETA','TRANSFERENCIA','OTRO'].map(x=><option key={x}>{x}</option>)}</select></label>
        {method==='EFECTIVO'&&<><label>Importe recibido<input type="number" min={total} step="0.01" value={received} onChange={e=>setReceived(e.target.value)}/></label><p>Vuelto: <strong>{money(Math.max(0,Number(received)-total))}</strong></p></>}
        <button className="kiosk-charge" disabled={busy||(method==='EFECTIVO'&&Number(received)<total)} onClick={charge}>{busy?'PROCESANDO…':'CONFIRMAR COBRO'}</button><button className="btn-ghost" disabled={busy} onClick={()=>setPaying(false)}>Volver</button>
      </div>}
    </aside>
    {receipt&&<div className="kiosk-modal" role="dialog" aria-label="Comprobante de venta"><div className="kiosk-receipt"><button className="kiosk-close" onClick={()=>setReceipt(null)}>×</button><h2>COMPROBANTE INTERNO</h2><p>{receipt.operation_number} · {localDate(receipt.created_at)}</p>{receipt.items?.map(i=><div key={i.id}><span>{i.description} × {Number(i.quantity)}</span><strong>{money(i.subtotal)}</strong></div>)}<div className="kiosk-receipt-total"><span>Total</span><strong>{money(receipt.total)}</strong></div><p>{receipt.payments?.[0]?.method} · Cajero {receipt.cashier_id?.slice(0,8)}</p><button className="btn-primary" onClick={()=>window.print()}><Printer size={16}/> Imprimir</button></div></div>}
  </div>
}

function Replenishment({ site, catalog, reloadCatalog, canReplenish }) {
  const inputRef=useRef(null);const[items,setItems]=useState([]),[results,setResults]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[observation,setObservation]=useState(''),[reference,setReference]=useState(''),[history,setHistory]=useState([])
  const loadHistory=useCallback(()=>listReceipts(site.id).then(setHistory).catch(e=>setError(e.message)),[site.id]);useEffect(()=>{setItems([]);loadHistory()},[site.id,loadHistory])
  const add=row=>{setResults([]);setItems(old=>old.some(x=>x.presentation_id===row.presentation_id)?old.map(x=>x.presentation_id===row.presentation_id?{...x,quantity:x.quantity+1}:x):[...old,{...row,quantity:1,unit_cost:row.reference_cost??''}])}
  const search=async term=>{setBusy(true);setError('');try{const rows=await listKioskCatalog(site.id,term),exact=rows.find(r=>(r.barcodes||[]).includes(term));if(exact||rows.length===1)add(exact||rows[0]);else{setResults(rows);if(!rows.length)setError('Producto no registrado para esta sede.')}}catch(e){setError(e.message)}finally{setBusy(false)}}
  const confirm=async()=>{setBusy(true);setError('');try{const result=await confirmReceipt({sedeId:site.id,items:items.map(x=>({presentation_id:x.presentation_id,quantity:x.quantity,unit_cost:x.unit_cost===''?null:x.unit_cost,barcode:x.barcodes?.[0]})),observation,reference});setItems([]);setObservation('');setReference('');setNotice(`Reposición ${result.operation_number} confirmada.`);await Promise.all([reloadCatalog(),loadHistory()])}catch(e){setError(e.message)}finally{setBusy(false);queueMicrotask(()=>inputRef.current?.focus())}}
  return <section className="kiosk-section"><div className="kiosk-section-head"><div><h2>Ingreso / Reposición</h2><p>Escaneá varios artículos y confirmalos juntos. El stock final nunca se escribe manualmente.</p></div></div><ScannerSearch label="Agregar mercadería" busy={busy} onSearch={search} inputRef={inputRef}/>{error&&<p className="kiosk-error">{error}</p>}{notice&&<p className="kiosk-notice">{notice}</p>}{results.length>0&&<CatalogPicker rows={results} onPick={add}/>}<div className="kiosk-operation-list">{items.map(item=><article key={item.presentation_id}><div><strong>{item.name}</strong><small>Stock actual {Number(item.stock_current)} · factor {Number(item.stock_factor)}</small></div><label>Cantidad recibida<input type="number" min="0.001" step="any" value={item.quantity} onChange={e=>setItems(xs=>xs.map(x=>x.presentation_id===item.presentation_id?{...x,quantity:Number(e.target.value)}:x))}/></label><label>Costo unitario<input type="number" min="0" step="0.01" value={item.unit_cost} onChange={e=>setItems(xs=>xs.map(x=>x.presentation_id===item.presentation_id?{...x,unit_cost:e.target.value}:x))}/></label><button onClick={()=>setItems(xs=>xs.filter(x=>x.presentation_id!==item.presentation_id))}><Trash2 size={16}/></button></article>)}</div>{items.length>0&&<div className="kiosk-confirm-bar"><input placeholder="Referencia / remito" value={reference} onChange={e=>setReference(e.target.value)}/><input placeholder="Observación opcional" value={observation} onChange={e=>setObservation(e.target.value)}/><button disabled={!canReplenish||busy} onClick={confirm}>CONFIRMAR REPOSICIÓN ({items.length})</button></div>}<h3>Últimas reposiciones</h3><div className="kiosk-history">{history.map(r=><article key={r.id}><strong>{r.operation_number}</strong><span>{localDate(r.created_at)}</span><span>{r.items?.length||0} artículos</span><small>{r.observation||r.reference||'Sin observaciones'}</small></article>)}</div></section>
}

function InventoryCounts({ site, catalog, reloadCatalog, canCount }) {
  const inputRef=useRef(null);const[counts,setCounts]=useState([]),[current,setCurrent]=useState(null),[results,setResults]=useState([]),[selected,setSelected]=useState(null),[physical,setPhysical]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const load=useCallback(async()=>{const rows=await listInventoryCounts(site.id);setCounts(rows);setCurrent(rows.find(x=>x.status==='EN_PROCESO')||null)},[site.id]);useEffect(()=>{load().catch(e=>setError(e.message))},[load])
  const start=async()=>{setBusy(true);try{await startInventoryCount(site.id);await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  const choose=row=>{setSelected(row);setResults([]);setPhysical('');queueMicrotask(()=>document.getElementById('physical-count')?.focus())}
  const search=async term=>{setBusy(true);setError('');try{const rows=await listKioskCatalog(site.id,term),exact=rows.find(r=>(r.barcodes||[]).includes(term));if(exact||rows.length===1)choose(exact||rows[0]);else{setResults(rows);if(!rows.length)setError('Producto no configurado para esta sede.')}}catch(e){setError(e.message)}finally{setBusy(false)}}
  const save=async()=>{if(!selected||physical==='')return;setBusy(true);try{await saveInventoryCountLine({countId:current.id,presentationId:selected.presentation_id,physicalQuantity:physical,barcode:selected.barcodes?.[0]});setSelected(null);setPhysical('');setNotice('Conteo guardado. Podés continuar más tarde.');await load()}catch(e){setError(e.message)}finally{setBusy(false);queueMicrotask(()=>inputRef.current?.focus())}}
  const finish=async()=>{if(!confirm('¿Finalizar el relevamiento? Quedará cerrado y se generarán los ajustes trazables.'))return;setBusy(true);try{await finalizeInventoryCount(current.id);setNotice('Relevamiento finalizado y stock ajustado.');await Promise.all([load(),reloadCatalog()])}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="kiosk-section"><div className="kiosk-section-head"><div><h2>Inventario físico</h2><p>Declarás lo encontrado; el sistema calcula la diferencia y el ajuste al cerrar.</p></div>{!current&&<button className="btn-primary" disabled={!canCount||busy} onClick={start}>NUEVO RELEVAMIENTO</button>}</div>{error&&<p className="kiosk-error">{error}</p>}{notice&&<p className="kiosk-notice">{notice}</p>}{current&&<><div className="kiosk-count-banner"><span>EN PROCESO desde {localDate(current.started_at)}</span><strong>{current.items?.length||0} artículos contados</strong></div><ScannerSearch label="Escanear o buscar artículo a contar" busy={busy} onSearch={search} inputRef={inputRef}/>{results.length>0&&<CatalogPicker rows={results} onPick={choose}/>} {selected&&<div className="kiosk-count-entry"><div><strong>{selected.name}</strong><span>Teórico ahora: {Number(selected.stock_current)}</span></div><label>Cantidad física encontrada<input id="physical-count" type="number" min="0" step="any" value={physical} onChange={e=>setPhysical(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();save()}}}/></label><button className="btn-primary" disabled={busy||physical===''} onClick={save}>Guardar conteo</button></div>}<div className="kiosk-differences"><div className="kiosk-table-row kiosk-table-head"><span>Artículo</span><span>Teórico al contar</span><span>Físico</span><span>Diferencia</span></div>{current.items?.map(i=>{const diff=Number(i.physical_quantity)-Number(i.theoretical_at_count);return <div className="kiosk-table-row" key={i.id}><span>{i.description}</span><span>{Number(i.theoretical_at_count)}</span><span>{Number(i.physical_quantity)}</span><strong className={diff<0?'neg':diff>0?'pos':''}>{diff>0?'+':''}{diff}</strong></div>})}</div><button className="kiosk-finish" disabled={busy||!current.items?.length} onClick={finish}>FINALIZAR RELEVAMIENTO</button></>}<h3>Historial</h3><div className="kiosk-history">{counts.filter(c=>c.status==='FINALIZADO').map(c=><article key={c.id}><strong>{localDate(c.started_at)}</strong><span>{c.items?.length||0} artículos</span><span>FINALIZADO</span><small>{c.items?.filter(i=>Number(i.difference)!==0).length||0} diferencias</small></article>)}</div></section>
}

function StockView({ catalog, loading, onReload }) {
  const[filter,setFilter]=useState('TODOS'),[term,setTerm]=useState('');const rows=catalog.filter(r=>{const stock=Number(r.stock_current),min=Number(r.stock_minimum);if(filter==='SIN_STOCK'&&stock!==0)return false;if(filter==='BAJO'&&!(stock>0&&stock<=min))return false;if(filter==='NORMAL'&&stock<=min)return false;return !term||`${r.name} ${r.internal_code} ${r.category}`.toLowerCase().includes(term.toLowerCase())})
  return <section className="kiosk-section"><div className="kiosk-section-head"><div><h2>Stock por sede</h2><p>Saldo teórico calculado desde movimientos. No existe edición directa.</p></div><button className="btn-ghost" onClick={onReload}>Actualizar</button></div><div className="kiosk-filters"><input placeholder="Buscar artículo…" value={term} onChange={e=>setTerm(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}><option>TODOS</option><option value="NORMAL">NORMAL</option><option value="BAJO">STOCK BAJO</option><option value="SIN_STOCK">SIN STOCK</option></select></div>{loading?<p>Cargando…</p>:<div className="kiosk-stock-grid">{rows.map(r=>{const stock=Number(r.stock_current),min=Number(r.stock_minimum),status=stock===0?'SIN STOCK':stock<=min?'STOCK BAJO':'NORMAL';return <article key={r.presentation_id} className={status==='NORMAL'?'normal':status==='STOCK BAJO'?'low':'none'}><div><strong>{r.name}</strong><small>{r.internal_code} · {r.presentation}</small><small>{r.category||'Sin categoría'}</small></div><b>{stock}</b><span>{status}</span><dl><dt>Mínimo</dt><dd>{min}</dd><dt>Costo</dt><dd>{money(r.reference_cost)}</dd><dt>Precio</dt><dd>{money(r.sale_price)}</dd></dl></article>})}</div>}</section>
}

function SalesHistory({ site, canAnnul, reloadCatalog, reloadIndicators }) {
  const[from,setFrom]=useState(today()),[to,setTo]=useState(today()),[rows,setRows]=useState([]),[detail,setDetail]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const load=useCallback(async()=>{setBusy(true);try{setRows(await listSales(site.id,from,to))}catch(e){setError(e.message)}finally{setBusy(false)}},[site.id,from,to]);useEffect(()=>{load()},[load])
  const open=async sale=>{setBusy(true);try{setDetail(await getSaleDetail(sale.id))}catch(e){setError(e.message)}finally{setBusy(false)}}
  const annul=async()=>{const reason=prompt('Motivo de la anulación:');if(!reason)return;setBusy(true);try{await annulSale(detail.id,reason);setDetail(await getSaleDetail(detail.id));await Promise.all([load(),reloadCatalog(),reloadIndicators()])}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <section className="kiosk-section"><div className="kiosk-section-head"><div><h2>Ventas</h2><p>Historial, comprobantes y anulaciones con restitución automática de stock.</p></div></div><div className="kiosk-filters"><label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button onClick={load}>Buscar</button></div>{error&&<p className="kiosk-error">{error}</p>}<div className="kiosk-history sales">{rows.map(s=><button key={s.id} onClick={()=>open(s)}><strong>{s.operation_number}</strong><span>{localDate(s.created_at)}</span><span>{s.payment_method}</span><b>{money(s.total)}</b><small className={s.status==='ANULADA'?'neg':''}>{s.status}</small></button>)}</div>{detail&&<div className="kiosk-modal"><div className="kiosk-receipt wide"><button className="kiosk-close" onClick={()=>setDetail(null)}>×</button><h2>{detail.operation_number}</h2><p>{localDate(detail.created_at)} · {detail.status}</p>{detail.items?.map(i=><div key={i.id}><span>{i.description} × {Number(i.quantity)}</span><strong>{money(i.subtotal)}</strong></div>)}<div className="kiosk-receipt-total"><span>Total</span><strong>{money(detail.total)}</strong></div>{detail.status==='ANULADA'&&<p className="kiosk-error">Anulada: {detail.annulment_reason}</p>}<div className="kiosk-actions"><button onClick={()=>window.print()}><Printer size={16}/> Comprobante</button>{detail.status==='COMPLETADA'&&canAnnul&&<button className="danger" disabled={busy} onClick={annul}><XCircle size={16}/> Anular venta</button>}</div></div></div>}</section>
}

function Movements({ site }) {const[rows,setRows]=useState([]),[term,setTerm]=useState(''),[error,setError]=useState('');const load=useCallback(()=>listInventoryMovements(site.id,term).then(setRows).catch(e=>setError(e.message)),[site.id,term]);useEffect(()=>{load()},[load]);return <section className="kiosk-section"><div className="kiosk-section-head"><div><h2>Movimientos</h2><p>Libro auditable de cada cambio de stock.</p></div></div><form className="kiosk-filters" onSubmit={e=>{e.preventDefault();load()}}><input placeholder="Artículo, código o tipo…" value={term} onChange={e=>setTerm(e.target.value)}/><button><Search size={16}/> Buscar</button></form>{error&&<p className="kiosk-error">{error}</p>}<div className="kiosk-movements">{rows.map(m=><article key={m.id}><span>{localDate(m.created_at)}</span><strong>{m.name}</strong><span>{m.movement_type}</span><b className={Number(m.quantity_delta)<0?'neg':'pos'}>{Number(m.quantity_delta)>0?'+':''}{Number(m.quantity_delta)}</b><small>{Number(m.stock_before)} → {Number(m.stock_after)}</small></article>)}</div></section>}

export default function Kiosco() {
  const { can }=useAuth();const[sites,setSites]=useState([]),[siteId,setSiteId]=useState(''),[tab,setTab]=useState('venta'),[catalog,setCatalog]=useState([]),[indicators,setIndicators]=useState({}),[loading,setLoading]=useState(true),[error,setError]=useState('')
  useEffect(()=>{listKioskSites().then(rows=>{setSites(rows);setSiteId(current=>current&&rows.some(x=>String(x.id)===String(current))?current:String(rows[0]?.id||''))}).catch(e=>setError(e.message))},[])
  const site=sites.find(x=>String(x.id)===String(siteId))
  const reloadCatalog=useCallback(async()=>{if(!siteId)return[];setLoading(true);try{const rows=await listKioskCatalog(siteId);setCatalog(rows);return rows}finally{setLoading(false)}},[siteId])
  const reloadIndicators=useCallback(async()=>{if(siteId)setIndicators(await getKioskIndicators(siteId))},[siteId])
  useEffect(()=>{if(siteId)Promise.all([reloadCatalog(),reloadIndicators()]).catch(e=>setError(e.message))},[siteId,reloadCatalog,reloadIndicators])
  if(error&&!sites.length)return <div className="kiosk-shell"><p className="kiosk-error">{error}</p></div>
  if(!site)return <div className="kiosk-shell"><div className="kiosk-no-access"><Archive size={44}/><h1>Kiosco no disponible</h1><p>Tu usuario no tiene una sede asignada con Kiosco habilitado.</p></div></div>
  return <div className="kiosk-shell"><header className="kiosk-header"><div><span>KIOSCO · OPERACIÓN MULTISEDE</span><h1>Kiosco</h1><p>Ventas, mercadería, inventario y control en un solo lugar.</p></div><label>Sede operativa<select value={siteId} onChange={e=>setSiteId(e.target.value)}>{sites.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label></header><nav className="kiosk-tabs" aria-label="Secciones Kiosco">{tabs.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={17}/>{label}</button>)}</nav>
    {tab==='venta'&&<CurrentSale site={site} catalog={catalog} reloadCatalog={reloadCatalog} indicators={indicators} reloadIndicators={reloadIndicators} canSell={can('kiosco','sell')} onOpenArticles={()=>setTab('articulos')}/>} 
    {tab==='reposicion'&&<Replenishment site={site} catalog={catalog} reloadCatalog={reloadCatalog} canReplenish={can('kiosco','replenish')}/>} 
    {tab==='inventario'&&<InventoryCounts site={site} catalog={catalog} reloadCatalog={reloadCatalog} canCount={can('kiosco','count')}/>} 
    {tab==='stock'&&<StockView catalog={catalog} loading={loading} onReload={reloadCatalog}/>} 
    {tab==='ventas'&&<SalesHistory site={site} canAnnul={can('kiosco','annul')} reloadCatalog={reloadCatalog} reloadIndicators={reloadIndicators}/>} 
    {tab==='movimientos'&&<Movements site={site}/>} 
    {tab==='articulos'&&<Articulos embedded/>}
  </div>
}
