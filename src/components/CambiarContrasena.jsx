import { useState } from 'react'
import { supabase, db } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function CambiarContrasena() {
  const { user, perfil, signOut } = useAuth()
  const [nueva, setNueva]         = useState('')
  const [confirma, setConfirma]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (nueva.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (nueva === '123456') return setError('No podés usar la contraseña temporal. Elegí una nueva.')
    if (nueva !== confirma) return setError('Las contraseñas no coinciden.')

    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password: nueva })
      if (authErr) throw authErr

      await db()
        .from('perfiles')
        .update({ must_change_password: false })
        .eq('id', user.id)

      // Recargar para que auth.jsx actualice el perfil
      window.location.reload()
    } catch (err) {
      setError(err.message || 'Error al cambiar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--abyss)', fontFamily: 'var(--font-mono)',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '40px 36px', width: 380, maxWidth: '90vw',
      }}>
        <div style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: 3, marginBottom: 4 }}>
          BITÁCORA IN SITU · FK
        </div>
        <h2 style={{ color: 'var(--text)', margin: '0 0 8px', fontSize: 18 }}>
          Cambiar contraseña
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px', lineHeight: 1.5 }}>
          Hola <strong style={{ color: 'var(--text)' }}>{perfil?.nombre || user?.email}</strong>.
          Por seguridad, necesitás elegir una contraseña nueva antes de continuar.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: 1 }}>
              NUEVA CONTRASEÑA
            </label>
            <input
              type="password"
              value={nueva}
              onChange={e => setNueva(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoFocus
              required
              style={{
                display: 'block', width: '100%', marginTop: 6,
                background: 'var(--abyss)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '10px 12px', color: 'var(--text)',
                fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: 1 }}>
              CONFIRMAR CONTRASEÑA
            </label>
            <input
              type="password"
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
              placeholder="Repetí la contraseña"
              required
              style={{
                display: 'block', width: '100%', marginTop: 6,
                background: 'var(--abyss)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '10px 12px', color: 'var(--text)',
                fontSize: 14, boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
              borderRadius: 4, padding: '8px 12px', color: '#ff5050', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--accent)', color: '#000', border: 'none',
              borderRadius: 4, padding: '11px 0', fontSize: 13, fontWeight: 700,
              letterSpacing: 1, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, marginTop: 4,
            }}
          >
            {loading ? 'GUARDANDO...' : 'GUARDAR CONTRASEÑA'}
          </button>

          <button
            type="button"
            onClick={signOut}
            style={{
              background: 'transparent', color: 'var(--text-muted)', border: 'none',
              fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0,
            }}
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
