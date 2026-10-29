import React from 'react'
import { fleetDate, fleetDateTime, interventionDate, interventionKind } from '../lib/flotaModel'
export default function FlotaHistorial({ report }) {
  if(!report) return null
  return <section style={{marginTop:20}}>
    <h3>Controles e historial completo</h3>
    <p>Última lectura registrada: {report.reading.km == null ? 'Sin registrar' : `${Number(report.reading.km).toLocaleString('es-AR')} km`} · {fleetDate(report.reading.fecha)} · {report.reading.fuente}. No certifica el odómetro actual.</p>
    {report.warnings.map(w=><p key={w} role="note" style={{color:'#f59e0b',marginTop:8}}>{w}</p>)}
    <p style={{marginTop:12}}>{report.tickets.length} registros vinculados, todos los estados.</p>
    {report.tickets.map(t=><details key={t.id} className="glass p-3 mt-2">
      <summary>#{t.numero} · {fleetDate(interventionDate(t))} · {interventionKind(t)} · {t.estado}</summary>
      <p>Incorporado: {fleetDateTime(t.created_at)} · Tipo: {t.tipo}</p>
      <p>{t.descripcion}</p><p>Trabajo: {t.trabajo_realizado || 'Sin registrar'}</p>
      <p>Diagnóstico / garantía informada: {t.diagnostico || 'Sin registrar'}</p>
      <p>Proveedor: {t.proveedor_nombre || 'Sin registrar'} · KM registrados: {t.lectura_km ?? 'Sin registrar'}</p>
      <p>Presupuesto: {t.presupuesto ?? t.costo_estimado ?? 'Sin registrar'} · No acredita pago.</p>
      <p>Costo real declarado: {t.costo_real ?? 'Sin constancia'}{t.costo_real!=null ? ' · verificar comprobante; no implica pago acreditado.' : ''}</p>
      {t.notas_costos && <p>{t.notas_costos}</p>}
      {t.evidencia_url && <a href={t.evidencia_url} target="_blank" rel="noreferrer">Documento de origen</a>}
      {(t.attachments || []).map((a,i)=><p key={i}><a href={a.url} target="_blank" rel="noreferrer">{a.nombre || 'Adjunto'}</a></p>)}
    </details>)}
  </section>
}
