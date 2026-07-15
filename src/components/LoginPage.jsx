import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { APP_VERSION } from '../data/releases'

function FKLogo({ size = 'md' }) {
  const big = size === 'lg'
  return (
    <svg width={big ? 240 : 158} height={big ? 81 : 54} viewBox="-3 -10 216 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 14 60 A 130 130 0 0 0 194 24"
        stroke="white" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
      <circle cx="194" cy="24" r="6" fill="#F97316"/>
      <text x="10" y="66"
        fontFamily="'Space Grotesk',Arial,sans-serif" fontWeight="800"
        fontSize="30" fill="#F97316">FLY</text>
      <text x="72" y="66"
        fontFamily="'Space Grotesk',Arial,sans-serif" fontWeight="800"
        fontSize="30" fill="white">KITCHEN</text>
    </svg>
  )
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err.message || 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--abyss)' }}>
      {/* Scanline */}
      <div className="scanline" />

      {/* Grid bg */}
      <div style={{
        position:'fixed', inset:0, backgroundImage:
          'linear-gradient(rgba(57,255,20,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,255,20,0.03) 1px, transparent 1px)',
        backgroundSize:'40px 40px', pointerEvents:'none',
      }} />

      {/* Panel */}
      <div className="glass hud-corner fade-in w-full max-w-sm mx-4 p-8 rounded"
        style={{ borderRadius: '4px' }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* logo removido */}
          <p className="font-metric text-xs mt-3 tracking-widest"
            style={{ color:'var(--phosphor)', opacity:0.9 }}>
            FLY GESTIÓN
          </p>
          <p className="font-metric text-xs mt-0.5 tracking-widest"
            style={{ color:'rgba(57,255,20,0.45)', fontSize:'0.6rem' }}>
            PLATAFORMA INTEGRAL
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-metric text-xs tracking-widest uppercase mb-1.5 block"
              style={{ color:'var(--text-dim)' }}>
              Email
            </label>
            <input
              type="email"
              required
              className="input-dark"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@flykitchen.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="font-metric text-xs tracking-widest uppercase mb-1.5 block"
              style={{ color:'var(--text-dim)' }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              className="input-dark"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-xs font-metric px-3 py-2 rounded"
              style={{ background:'rgba(255,42,42,0.1)', border:'1px solid rgba(255,42,42,0.3)', color:'var(--alert)' }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
            style={{ padding:'0.6rem 1rem', fontSize:'0.75rem' }}
          >
            {loading ? '[ AUTENTICANDO... ]' : '[ LOGIN ]'}
          </button>
        </form>

        <p className="font-metric text-center mt-6"
          style={{ fontSize:'0.6rem', color:'rgba(57,255,20,0.2)', letterSpacing:'0.15em' }}>
          FLY KITCHEN · FLY GESTIÓN v{APP_VERSION}
        </p>
      </div>
    </div>
  )
}
