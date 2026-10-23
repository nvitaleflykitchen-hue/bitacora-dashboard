import React, { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import LoginPage from './LoginPage'

function Consent() {
  const { user, loading } = useAuth()
  const [details, setDetails] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const request = new URLSearchParams(window.location.search).get('request') ?? ''
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/mcp-consent?request=${encodeURIComponent(request)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Solicitud no disponible'); setDetails(data) })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => controller.abort()
  }, [request])
  async function decide(approve) {
    setBusy(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Tu sesión venció. Iniciá sesión nuevamente.')
      const response = await fetch('/api/mcp-consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ request, approve }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo autorizar')
      const target = new URL(data.redirect_url)
      if (target.protocol !== 'https:' || target.origin !== details.redirect_origin) throw new Error('Destino de autorización no válido')
      window.location.assign(target.href)
    } catch (e) { setError(e.message); setBusy(false) }
  }
  if (loading) return <p role="status">Verificando sesión…</p>
  if (!user) return <LoginPage />
  return <main style={{ maxWidth: 620, margin: '8vh auto', padding: 28, fontSize: 16 }}>
    <h1>Conectar Fly Gestión</h1>
    <p>Sesión: {user.email}</p>
    {details && <>
      <h2>{details.client_name}</h2>
      <p>Destino de la conexión: <strong>{details.redirect_origin}</strong>. El nombre lo informa la aplicación solicitante; verificá que sea la conexión que acabás de iniciar.</p>
      <p>Permitirá consultar auditorías, acciones CAPA, novedades de cadena de frío y checklists de las sedes autorizadas: {details.sede_ids.join(', ')}.</p>
      <p>Acceso de solo lectura durante un máximo de 30 días. No permite editar ni borrar registros. No comparte tu contraseña ni la clave de Supabase.</p>
      <p>Podés revocarlo desvinculando la app en Gemini o solicitando al administrador que retire tu autorización MCP.</p>
      <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => decide(false)}>Cancelar conexión</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => decide(true)}>{busy ? 'Procesando…' : 'Autorizar consultas'}</button>
      </div>
    </>}
    {!details && !error && <p role="status">Cargando solicitud…</p>}
    {error && <p role="alert">{error}</p>}
  </main>
}

export default function McpConnect() {
  return <AuthProvider><Consent /></AuthProvider>
}
