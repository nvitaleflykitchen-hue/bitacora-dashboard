import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const STORAGE = 'fly-credential-delivery-encrypted-v1'
const bytes64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
export default function CredentialDelivery() {
  const { perfil } = useAuth()
  const [open, setOpen] = useState(false)
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [running, setRunning] = useState(false)
  const busy = useRef(false)
  const [results, setResults] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || '[]') } catch { return [] }
  })
  if (perfil?.rol !== 'admin') return null

  const load = async e => {
    try {
      const next = JSON.parse(await e.target.files[0].text())
      if (next.project_id !== 'mixyhfdlzjarvszinytk' || !next.public_key || !Array.isArray(next.people)) throw new Error('Archivo de preparación inválido.')
      await crypto.subtle.importKey('jwk', next.public_key, { name:'RSA-OAEP', hash:'SHA-1' }, false, ['encrypt'])
      if (next.people.some(p => !p.persona_id || !['create','reset'].includes(p.action))) throw new Error('Acciones inválidas.')
      setManifest(next); setError('')
    } catch (e) { setError(e.message) }
  }
  const download = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'entrega-cifrada-por-sede.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const run = async () => {
    if (busy.current || !manifest) return
    busy.current = true; setRunning(true); setError('')
    let rows = [...results]
    const persist = row => {
      rows = [...rows.filter(r => !(r.persona_id === row.persona_id && r.batch_id === row.batch_id)), row]
      localStorage.setItem(STORAGE, JSON.stringify(rows))
      setResults([...rows])
    }
    try {
      // Verify local storage before any account mutation. Only ciphertext is persisted.
      localStorage.setItem(STORAGE, JSON.stringify(rows))
      if (Date.now() - Date.parse(manifest.audited_at) > 24*3600*1000) throw new Error('Relevamiento vencido. Actualizalo antes de ejecutar.')
      const key = await crypto.subtle.importKey('jwk', manifest.public_key, {name:'RSA-OAEP',hash:'SHA-1'}, false, ['encrypt'])
      for (let i=0; i<manifest.people.length; i++) {
        const p = manifest.people[i]
        if (rows.some(r => r.batch_id === manifest.batch_id && r.persona_id === p.persona_id && ['creado','restablecido'].includes(r.status))) continue
        setProgress(`${i+1}/${manifest.people.length}: ${p.nombre}`)
        const record = { batch_id:manifest.batch_id, key_id:manifest.public_key.n, persona_id:p.persona_id, nombre:p.nombre, email:p.auth_email || p.email, sedes:(p.sedes || []).map(s=>s.nombre), sede_ids:p.sede_ids, rol:p.action === 'create' ? 'operario' : p.rol }
        try {
          const current = await supabase.schema('bitacora').rpc('get_persona_for_user_enable',{p_persona_id:p.persona_id}).single()
          if (current.error || !current.data?.activo) throw new Error('Persona inactiva o no disponible.')
          if (p.action === 'create' && (current.data.perfil_id || current.data.email?.trim().toLowerCase() !== p.email.trim().toLowerCase())) throw new Error('La ficha cambió desde el relevamiento. Revisar antes de continuar.')
          if (JSON.stringify([...(current.data.sede_ids || [])].sort()) !== JSON.stringify([...(p.sede_ids || [])].sort())) throw new Error('Las sedes cambiaron desde el relevamiento.')
          if (p.action === 'create') {
            const {data,error:fnError} = await supabase.functions.invoke('create-user-direct',{body:{persona_id:p.persona_id,rol:'operario'}})
            if (fnError || data?.error || !data?.data?.temp_password) throw new Error(data?.error || 'No se recibió una nueva credencial. Revisar la cuenta antes de reintentar.')
            const created = data.data
            record.password_cifrado = bytes64(await crypto.subtle.encrypt({name:'RSA-OAEP'},key,new TextEncoder().encode(created.temp_password)))
            created.temp_password = null
            record.user_id = created.user.id
            record.email = created.user.email
            record.status = 'creado'
            persist(record)
          } else {
            const random = crypto.getRandomValues(new Uint8Array(24))
            let password = 'Fk9!' + bytes64(random).replace(/[+/=]/g,'X')
            record.password_cifrado = bytes64(await crypto.subtle.encrypt({name:'RSA-OAEP'},key,new TextEncoder().encode(password)))
            record.user_id = p.auth_id
            record.status = 'pendiente_verificacion'
            persist(record)
            const {data,error:fnError} = await supabase.functions.invoke('prepare-temporary-password',{body:{persona_id:p.persona_id,user_id:p.auth_id,password}})
            password = null
            if (fnError || data?.error || !data?.success) throw new Error(data?.error || 'Restablecimiento no confirmado. Revisar cuenta.')
            record.status = 'restablecido'
            persist(record)
          }
        } catch (e) {
          // Do not log network responses, request bodies, or credentials.
          persist({...record,status:'error',error:e.message})
        }
      }
      setProgress('Preparación finalizada. Descargá la entrega cifrada para verificarla e incorporarla al visor.')
    } catch (e) { setError(e.message) }
    finally { busy.current=false; setRunning(false) }
  }
  return <section style={{margin:'12px 0'}}>
    <button className="btn-ghost" onClick={()=>setOpen(!open)} disabled={running}>Entrega de credenciales por sede</button>
    {open && <div className="glass" style={{padding:20,marginTop:12}}>
      <h2>Preparar entrega individual</h2>
      <p>Cargá el relevamiento aprobado. Las altas usan el rol Operario; las cuentas existentes conservan sus permisos. Las claves se descargan cifradas para abrirlas en el visor de Windows.</p>
      <label>Archivo de preparación <input aria-label="Archivo de preparación" type="file" accept=".json" onChange={load} disabled={running}/></label>
      {manifest && <p>{manifest.people.length} personas preparadas · relevamiento {new Date(manifest.audited_at).toLocaleString('es-AR')}</p>}
      <div style={{display:'flex',gap:12,marginTop:12,flexWrap:'wrap'}}>
        <button className="btn-primary" disabled={!manifest || running} onClick={run}>{running?'Preparando…':'Preparar cuentas y claves'}</button>
        <button className="btn-ghost" disabled={!results.length || running} onClick={download}>Descargar entrega cifrada</button>
      </div>
      <p role="status">{progress}</p>
      {error && <p role="alert">{error}</p>}
      <p>{results.filter(r=>['creado','restablecido'].includes(r.status)).length} preparadas · {results.filter(r=>r.status==='error').length} requieren revisión</p>
      <ul>{results.filter(r=>r.status==='error').map(r=><li key={r.persona_id}>{r.nombre}: {r.error}</li>)}</ul>
    </div>}
  </section>
}

