import { useState, useRef } from 'react'
import { X, Upload, Check, AlertCircle, RefreshCw, Users } from 'lucide-react'
import { bulkInsertContactos } from '../lib/queries'

// ── Parser CSV robusto (maneja comillas con comas adentro) ──
function parseCSV(text) {
  const lines = text.split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = parseCSVLine(line)
      const row = {}
      headers.forEach((h, i) => { row[h] = (vals[i] || '').trim() })
      return row
    })
}

function parseCSVLine(line) {
  const result = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// ── Mapeo de columnas Google Contacts → nuestra tabla ──────
// Soporta dos formatos: Google CSV nuevo (First Name/Last Name) y antiguo (Name)
function mapGoogleRow(row) {
  // Nombre: formato nuevo = First Name + Last Name; formato antiguo = Name
  const nombre =
    [row['First Name'], row['Middle Name'], row['Last Name']].map(s=>(s||'').trim()).filter(Boolean).join(' ') ||
    row['Name'] ||
    row['Nombre'] || ''

  const email =
    (row['E-mail 1 - Value'] || row['Email 1 - Value'] || row['email'] || '').trim()

  const telefono = cleanPhone(
    row['Phone 1 - Value'] ||
    row['Teléfono 1 - Valor'] ||
    row['Mobile Phone 1 - Value'] ||
    row['telefono'] || ''
  )

  // Cargo: puede venir en Organization Title o en Organization 1 - Title (formato antiguo)
  const cargo = (
    row['Organization Title'] ||
    row['Organization 1 - Title'] ||
    row['Job Title'] ||
    row['cargo'] || ''
  ).trim()

  // Empresa: para referencia interna en notas (no hay columna empresa en la tabla)
  // Lo concatenamos al cargo si hay org y no hay cargo
  const org = (row['Organization Name'] || row['Organization 1 - Name'] || '').trim()
  const cargoFinal = cargo || (org && org.toLowerCase().includes('fly') ? '' : org) || ''

  return { nombre, email, telefono, cargo: cargoFinal, activo: true }
}

function cleanPhone(p) {
  if (!p) return ''
  // Keep +, digits, spaces for international format
  return p.replace(/[^\d+\s\-]/g, '').trim()
}

// ── Chip de estado ──────────────────────────────────────────
function StatusChip({ status }) {
  if (status === 'nuevo')
    return <span style={{ fontSize:'0.58rem', padding:'1px 6px', borderRadius:3, background:'rgba(57,255,20,0.15)', color:'#39FF14', fontWeight:700 }}>NUEVO</span>
  if (status === 'actualizar')
    return <span style={{ fontSize:'0.58rem', padding:'1px 6px', borderRadius:3, background:'rgba(96,165,250,0.15)', color:'#60A5FA', fontWeight:700 }}>ACTUALIZAR</span>
  if (status === 'sin_datos')
    return <span style={{ fontSize:'0.58rem', padding:'1px 6px', borderRadius:3, background:'rgba(107,114,128,0.2)', color:'rgba(156,163,175,0.7)', fontWeight:700 }}>SIN DATOS</span>
  return null
}

export default function ImportarContactosModal({ existentes = [], onClose, onImported }) {
  const [step, setStep]         = useState('upload')   // upload | preview | done
  const [rows, setRows]         = useState([])          // parsed + mapped
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const emailsExistentes = new Set(existentes.map(c => c.email?.toLowerCase()).filter(Boolean))

  const processFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      alert('Seleccioná un archivo .csv exportado desde Google Contacts.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const rawRows = parseCSV(e.target.result)
      const mapped = rawRows
        .map(mapGoogleRow)
        .filter(r => r.nombre)   // descartar filas sin nombre
        .map(r => ({
          ...r,
          _status: !r.nombre
            ? 'sin_datos'
            : emailsExistentes.has(r.email?.toLowerCase())
              ? 'actualizar'
              : 'nuevo'
        }))

      setRows(mapped)
      // Pre-seleccionar todos excepto sin_datos
      setSelected(new Set(mapped.map((_, i) => i).filter(i => mapped[i]._status !== 'sin_datos')))
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }

  const toggleRow = (i) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    const eligible = rows.map((_, i) => i).filter(i => rows[i]._status !== 'sin_datos')
    setSelected(prev => prev.size === eligible.length ? new Set() : new Set(eligible))
  }

  const handleImport = async () => {
    const toImport = [...selected].map(i => {
      const { _status, ...rest } = rows[i]
      return rest
    })
    if (toImport.length === 0) return
    setLoading(true)
    try {
      const res = await bulkInsertContactos(toImport)
      setResult({ ok: res.length, total: toImport.length })
      setStep('done')
      onImported?.()
    } catch (err) {
      alert('Error al importar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const L = { color:'var(--text-dim)', fontSize:'0.6rem', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:'monospace' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass hud-corner fade-in rounded" style={{ borderRadius:3, width:'100%', maxWidth:700, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.9rem 1.25rem', borderBottom:'1px solid rgba(57,255,20,0.1)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Users size={14} style={{ color:'var(--phosphor)' }}/>
            <h2 className="font-title font-bold" style={{ color:'var(--text)', fontSize:'0.95rem' }}>
              Importar contactos desde Google
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding:'0.3rem' }}><X size={14}/></button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'1.25rem' }}>

          {/* ── PASO 1: Upload ── */}
          {step === 'upload' && (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {/* Instrucciones */}
              <div className="rounded p-3" style={{ background:'rgba(57,255,20,0.04)', border:'1px solid rgba(57,255,20,0.12)' }}>
                <p style={{ color:'var(--phosphor)', fontSize:'0.7rem', fontWeight:700, marginBottom:6 }}>
                  Cómo exportar desde Google Contacts:
                </p>
                {['1. Abrí contacts.google.com',
                  '2. Menú izquierdo → Exportar',
                  '3. Seleccioná los contactos o "Todos los contactos"',
                  '4. Formato: Google CSV → Exportar',
                  '5. Subí el archivo acá abajo'
                ].map(s => (
                  <p key={s} style={{ color:'var(--text-dim)', fontSize:'0.68rem', lineHeight:1.8 }}>{s}</p>
                ))}
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--phosphor)' : 'rgba(57,255,20,0.2)'}`,
                  borderRadius: 6,
                  padding: '2.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'rgba(57,255,20,0.06)' : 'transparent',
                  transition: 'all 0.2s'
                }}>
                <Upload size={28} style={{ color:'rgba(57,255,20,0.4)', margin:'0 auto 10px' }}/>
                <p style={{ color:'var(--text)', fontSize:'0.8rem', fontWeight:600 }}>
                  Arrastrá el CSV acá o hacé click para elegir
                </p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.65rem', marginTop:4 }}>
                  Solo archivos .csv exportados desde Google Contacts
                </p>
                <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
                  onChange={e => processFile(e.target.files[0])}/>
              </div>
            </div>
          )}

          {/* ── PASO 2: Preview ── */}
          {step === 'preview' && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Resumen */}
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {[
                  { label:'Total leídos', val: rows.length, color:'var(--text)' },
                  { label:'Nuevos', val: rows.filter(r=>r._status==='nuevo').length, color:'#39FF14' },
                  { label:'Ya existentes (actualizar)', val: rows.filter(r=>r._status==='actualizar').length, color:'#60A5FA' },
                  { label:'Sin datos suficientes', val: rows.filter(r=>r._status==='sin_datos').length, color:'rgba(107,114,128,0.6)' },
                ].map(k => (
                  <div key={k.label} style={{ padding:'6px 12px', borderRadius:4, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                    <p style={{ color:k.color, fontSize:'1rem', fontWeight:800, fontFamily:'monospace' }}>{k.val}</p>
                    <p style={{ color:'var(--text-dim)', fontSize:'0.58rem' }}>{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Tabla preview */}
              <div style={{ border:'1px solid rgba(255,255,255,0.07)', borderRadius:4, overflow:'hidden' }}>
                <div style={{ maxHeight:'38vh', overflowY:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.68rem' }}>
                    <thead>
                      <tr style={{ background:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                        <th style={{ padding:'6px 8px', textAlign:'center', width:32 }}>
                          <input type="checkbox"
                            checked={selected.size === rows.filter(r=>r._status!=='sin_datos').length && selected.size > 0}
                            onChange={toggleAll}
                            style={{ accentColor:'var(--phosphor)' }}/>
                        </th>
                        {['Estado','Nombre','Email','Teléfono','Cargo'].map(h=>(
                          <th key={h} style={{ padding:'6px 8px', textAlign:'left', ...L }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const disabled = row._status === 'sin_datos'
                        return (
                          <tr key={i}
                            onClick={() => !disabled && toggleRow(i)}
                            style={{
                              borderBottom:'1px solid rgba(255,255,255,0.04)',
                              background: selected.has(i) ? 'rgba(57,255,20,0.04)' : 'transparent',
                              opacity: disabled ? 0.4 : 1,
                              cursor: disabled ? 'default' : 'pointer',
                            }}>
                            <td style={{ padding:'5px 8px', textAlign:'center' }}>
                              <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)}
                                disabled={disabled} style={{ accentColor:'var(--phosphor)' }}
                                onClick={e=>e.stopPropagation()}/>
                            </td>
                            <td style={{ padding:'5px 8px' }}><StatusChip status={row._status}/></td>
                            <td style={{ padding:'5px 8px', color:'var(--text)', fontWeight:500, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {row.nombre}
                            </td>
                            <td style={{ padding:'5px 8px', color:'var(--text-dim)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {row.email || '—'}
                            </td>
                            <td style={{ padding:'5px 8px', color:'var(--text-dim)' }}>
                              {row.telefono || '—'}
                            </td>
                            <td style={{ padding:'5px 8px', color:'var(--text-dim)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {row.cargo || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ color:'var(--text-dim)', fontSize:'0.62rem' }}>
                {selected.size} contacto{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''} para importar.
                Contactos con email existente serán actualizados.
              </p>
            </div>
          )}

          {/* ── PASO 3: Done ── */}
          {step === 'done' && result && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'3rem 1rem', gap:16, textAlign:'center' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(57,255,20,0.1)', border:'2px solid rgba(57,255,20,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Check size={24} style={{ color:'var(--phosphor)' }}/>
              </div>
              <div>
                <p style={{ color:'var(--text)', fontWeight:700, fontSize:'1.1rem' }}>
                  {result.ok} contacto{result.ok !== 1 ? 's' : ''} importado{result.ok !== 1 ? 's' : ''}
                </p>
                <p style={{ color:'var(--text-dim)', fontSize:'0.72rem', marginTop:4 }}>
                  La base de datos de contactos fue actualizada correctamente.
                </p>
              </div>
              <button onClick={onClose} className="btn-primary">Cerrar</button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'done' && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.8rem 1.25rem', borderTop:'1px solid rgba(255,255,255,0.05)', flexShrink:0 }}>
            {step === 'preview' ? (
              <>
                <button onClick={() => setStep('upload')} className="btn-ghost" style={{ fontSize:'0.68rem' }}>
                  ← Volver
                </button>
                <button onClick={handleImport} disabled={loading || selected.size === 0} className="btn-primary"
                  style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {loading ? <><RefreshCw size={11} className="animate-spin"/> Importando...</> : `Importar ${selected.size} contacto${selected.size !== 1 ? 's' : ''}`}
                </button>
              </>
            ) : (
              <button onClick={onClose} className="btn-ghost" style={{ marginLeft:'auto' }}>Cancelar</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
