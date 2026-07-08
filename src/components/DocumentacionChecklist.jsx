import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, FileCheck2, Save } from 'lucide-react'
import AdjuntosPanel from './AdjuntosPanel'
import {
  DOCUMENTACION_ESTADOS,
  DOCUMENTACION_AVISO_DIAS_DEFAULT,
  docEstadoMeta,
  docVencimientoInfo,
  getDocumentacionItems,
  upsertDocumentacionItem,
} from '../lib/documentacion'

const labelStyle = {
  color: 'var(--text-dim)',
  fontSize: '0.58rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: '0.35rem',
  fontFamily: "'Roboto Mono', monospace",
}

const inputStyle = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  borderRadius: 2,
  background: 'var(--surface)',
  border: '1px solid rgba(107,114,128,0.3)',
  color: 'var(--text)',
  fontSize: '0.74rem',
  boxSizing: 'border-box',
  outline: 'none',
}

function groupBySeccion(items) {
  return items.reduce((acc, item) => {
    const key = item.seccion || 'Documentación'
    acc[key] = acc[key] || []
    acc[key].push(item)
    return acc
  }, {})
}

export default function DocumentacionChecklist({ entityType, entityId, template = [], canEdit = false, title = 'Documentación' }) {
  const [rows, setRows] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!entityId) {
        setRows([])
        setDrafts({})
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await getDocumentacionItems(entityType, entityId)
        if (!mounted) return
        setRows(data)
        setDrafts(Object.fromEntries(data.map(r => [r.codigo, {
          estado: r.estado || 'pendiente',
          aviso_dias: r.aviso_dias ?? DOCUMENTACION_AVISO_DIAS_DEFAULT,
          fecha_vencimiento: r.fecha_vencimiento || '',
          observacion: r.observacion || '',
        }])))
      } catch (e) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [entityType, entityId])

  const merged = useMemo(() => {
    const byCode = Object.fromEntries(rows.map(r => [r.codigo, r]))
    return template.map(t => ({
      ...t,
      ...(byCode[t.codigo] || {}),
      estado: drafts[t.codigo]?.estado ?? byCode[t.codigo]?.estado ?? 'pendiente',
      aviso_dias: drafts[t.codigo]?.aviso_dias ?? byCode[t.codigo]?.aviso_dias ?? t.aviso_dias ?? DOCUMENTACION_AVISO_DIAS_DEFAULT,
      fecha_vencimiento: drafts[t.codigo]?.fecha_vencimiento ?? byCode[t.codigo]?.fecha_vencimiento ?? '',
      observacion: drafts[t.codigo]?.observacion ?? byCode[t.codigo]?.observacion ?? '',
    }))
  }, [template, rows, drafts])

  const grouped = groupBySeccion(merged)

  const updateDraft = (codigo, key, value) => {
    setDrafts(prev => ({
      ...prev,
      [codigo]: {
        estado: prev[codigo]?.estado || 'pendiente',
        aviso_dias: prev[codigo]?.aviso_dias ?? DOCUMENTACION_AVISO_DIAS_DEFAULT,
        fecha_vencimiento: prev[codigo]?.fecha_vencimiento || '',
        observacion: prev[codigo]?.observacion || '',
        [key]: value,
      },
    }))
  }

  const saveItem = async (item) => {
    setSavingKey(item.codigo)
    setError(null)
    try {
      const saved = await upsertDocumentacionItem({
        entity_type: entityType,
        entity_id: entityId,
        codigo: item.codigo,
        titulo: item.titulo,
        seccion: item.seccion || null,
        estado: item.estado,
        aviso_dias: item.aviso_dias,
        fecha_vencimiento: item.fecha_vencimiento || null,
        observacion: item.observacion || null,
      })
      setRows(prev => {
        const rest = prev.filter(r => r.codigo !== saved.codigo)
        return [...rest, saved]
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingKey(null)
    }
  }

  const downloadCalendarEvent = (item) => {
    if (!item.fecha_vencimiento) return
    const date = item.fecha_vencimiento.replaceAll('-', '')
    const aviso = Number(item.aviso_dias || DOCUMENTACION_AVISO_DIAS_DEFAULT)
    const uid = `${entityType}-${entityId}-${item.codigo}@bitacora-fk`
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bitacora In Situ//Documentacion//ES',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;VALUE=DATE:${date}`,
      `SUMMARY:Vence documentación: ${item.titulo}`,
      `DESCRIPTION:Renovar o verificar documentación. Aviso prudencial configurado: ${aviso} días. Estado: ${docEstadoMeta(item.estado).label}.`,
      `BEGIN:VALARM`,
      `TRIGGER:-P${aviso}D`,
      'ACTION:DISPLAY',
      `DESCRIPTION:Renovar documentación: ${item.titulo}`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vencimiento-${item.codigo}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const vencidos = merged.filter(i => ['vencido', 'hoy'].includes(docVencimientoInfo(i.fecha_vencimiento, i.aviso_dias).tipo)).length
  const proximos = merged.filter(i => docVencimientoInfo(i.fecha_vencimiento, i.aviso_dias).tipo === 'proximo').length
  const completos = merged.filter(i => i.estado === 'vigente').length

  return (
    <div className="space-y-4">
      <div className="glass p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-metric text-xs mb-1 flex items-center gap-2" style={{ color: 'var(--phosphor)', letterSpacing: '0.08em' }}>
              <FileCheck2 size={14} /> {title.toUpperCase()}
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
              Guardá cada ítem una vez y luego subí la evidencia desde "Adjuntos". El aviso define cuántos días antes debe considerarse próximo a renovar.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="chip" style={{ color: '#39FF14', borderColor: 'rgba(57,255,20,0.25)' }}>{completos} vigentes</span>
            <span className="chip" style={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)' }}>{proximos} próximos</span>
            <span className="chip" style={{ color: '#FF2A2A', borderColor: 'rgba(255,42,42,0.3)' }}>{vencidos} vencidos</span>
          </div>
        </div>
        {loading && <p className="mt-3" style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Cargando documentación...</p>}
        {error && <p className="mt-3" style={{ color: '#FF2A2A', fontSize: '0.75rem' }}>{error}</p>}
      </div>

      {!loading && Object.entries(grouped).map(([seccion, items]) => (
        <div key={seccion}>
          <p className="font-metric text-xs mb-2" style={{ color: 'var(--phosphor)', letterSpacing: '0.08em' }}>{seccion.toUpperCase()}</p>
          <div className="grid grid-cols-1 gap-3">
            {items.map(item => {
              const meta = docEstadoMeta(item.estado)
              const venc = docVencimientoInfo(item.fecha_vencimiento, item.aviso_dias)
              const persistedId = item.id
              return (
                <div key={item.codigo} className="glass p-4" style={{ borderColor: venc.tipo === 'vencido' ? 'rgba(255,42,42,0.25)' : venc.tipo === 'proximo' ? 'rgba(245,158,11,0.22)' : 'rgba(57,255,20,0.08)' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p style={{ color: 'var(--text)', fontSize: '0.84rem', fontWeight: 700 }}>{item.titulo}</p>
                      <p style={{ color: venc.color, fontSize: '0.68rem', marginTop: 3 }}>
                        {venc.tipo !== 'sin_fecha' && <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />}
                        {venc.label}
                      </p>
                    </div>
                    <span className="chip" style={{ color: meta.color, borderColor: `${meta.color}55` }}>{meta.label}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label style={labelStyle}>Estado</label>
                      <select disabled={!canEdit} value={item.estado} onChange={e => updateDraft(item.codigo, 'estado', e.target.value)} style={inputStyle}>
                        {DOCUMENTACION_ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Vencimiento</label>
                      <input disabled={!canEdit} type="date" value={item.fecha_vencimiento || ''} onChange={e => updateDraft(item.codigo, 'fecha_vencimiento', e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Avisar con días</label>
                      <input disabled={!canEdit} type="number" min="0" max="365" value={item.aviso_dias ?? DOCUMENTACION_AVISO_DIAS_DEFAULT} onChange={e => updateDraft(item.codigo, 'aviso_dias', e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Acciones</label>
                      <button disabled={!canEdit || savingKey === item.codigo} onClick={() => saveItem(item)} className="btn-primary flex items-center justify-center gap-1.5" style={{ width: '100%', fontSize: '0.68rem', opacity: !canEdit ? 0.45 : 1 }}>
                        <Save size={12} /> {savingKey === item.codigo ? 'Guardando...' : 'Guardar'}
                      </button>
                      {item.fecha_vencimiento && (
                        <button type="button" onClick={() => downloadCalendarEvent(item)} className="btn-ghost flex items-center justify-center gap-1.5 mt-2" style={{ width: '100%', fontSize: '0.64rem' }}>
                          <CalendarPlus size={11} /> Calendario
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label style={labelStyle}>Observación</label>
                    <textarea disabled={!canEdit} rows={2} value={item.observacion || ''} onChange={e => updateDraft(item.codigo, 'observacion', e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Notas, faltantes, responsable de actualización..." />
                  </div>

                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(57,255,20,0.08)' }}>
                    {persistedId ? (
                      <>
                        <p className="font-metric mb-2" style={{ color:'var(--phosphor)', fontSize:'0.62rem', letterSpacing:'0.08em' }}>ADJUNTOS / EVIDENCIA</p>
                        <AdjuntosPanel entityType="documentacion_item" entityId={persistedId} readOnly={!canEdit} />
                      </>
                    ) : (
                      <p style={{ color: 'var(--text-dim)', fontSize: '0.68rem' }}>Primero guardá el ítem. Después se habilita la carga de archivos, fotos, PDF o links como evidencia.</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
