import { useEffect, useState } from 'react'
import { Camera, ImagePlus, Trash2 } from 'lucide-react'
import { eliminarPersonaFoto, getPersonaFotoUrls, guardarPersonaFoto } from '../lib/personaFotos'
import { mensajeError } from '../lib/errores'
import { confirmar, toast } from '../lib/feedback'

function initials(persona) {
  return [persona?.nombre, persona?.apellido]
    .filter(Boolean)
    .map(value => String(value).trim()[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'
}

export function PersonaAvatar({ persona, size = 64 }) {
  const [src, setSrc] = useState(null)
  const [originalSrc, setOriginalSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setFailed(false)
    if (!persona?.foto_url) {
      setSrc(null)
      setOriginalSrc(null)
      return () => { active = false }
    }
    getPersonaFotoUrls(persona.foto_url)
      .then(({ thumbnail, original }) => {
        if (!active) return
        setOriginalSrc(original)
        setSrc(thumbnail || original)
      })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [persona?.foto_url])

  const style = {
    width:size, height:size, minWidth:size, borderRadius:'50%', overflow:'hidden',
    border:'1px solid rgba(57,255,20,0.28)', background:'rgba(57,255,20,0.08)',
    display:'flex', alignItems:'center', justifyContent:'center',
  }
  if (src && !failed) {
    return <div style={style}><img src={src} alt={`Foto de ${persona?.nombre || 'persona'}`} loading="lazy" decoding="async" onError={() => { if (originalSrc && src !== originalSrc) setSrc(originalSrc); else setFailed(true) }} style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>
  }
  return <div style={style} aria-label={`Sin foto. Iniciales ${initials(persona)}`}><span className="font-title" style={{ color:'var(--phosphor)', fontWeight:800, fontSize:size * 0.32 }}>{initials(persona)}</span></div>
}

export function PersonaFotoEditor({ persona, onChanged, compact = false, showAvatar = true }) {
  const [saving, setSaving] = useState(false)

  const processFile = async file => {
    if (!file) return
    setSaving(true)
    try {
      await guardarPersonaFoto(persona.id, file, persona.foto_url)
      toast.ok('Foto actualizada.')
      onChanged?.()
    } catch (error) {
      toast.error(mensajeError(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!(await confirmar({ titulo:'Eliminar foto', mensaje:'La ficha volverá a mostrar las iniciales.', peligro:true, confirmText:'Eliminar foto' }))) return
    setSaving(true)
    try {
      await eliminarPersonaFoto(persona.id, persona.foto_url)
      toast.ok('Foto eliminada.')
      onChanged?.()
    } catch (error) {
      toast.error(mensajeError(error))
    } finally {
      setSaving(false)
    }
  }

  const buttonStyle = { fontSize:'0.68rem', display:'inline-flex', alignItems:'center', gap:5, cursor:saving?'wait':'pointer' }
  return (
    <div style={{ display:'flex', alignItems:'center', gap:compact?10:14, padding:compact?'0.5rem 0':'0.75rem', marginBottom:compact?0:'0.75rem' }}>
      {showAvatar && <PersonaAvatar persona={persona} size={compact ? 58 : 76} />}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        <label className="btn-primary" style={buttonStyle}>
          <Camera size={13} /> Tomar foto
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={saving} onChange={event => { processFile(event.target.files?.[0]); event.target.value = '' }} style={{ display:'none' }} />
        </label>
        <label className="btn-ghost" style={buttonStyle}>
          <ImagePlus size={13} /> Elegir archivo
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={event => { processFile(event.target.files?.[0]); event.target.value = '' }} style={{ display:'none' }} />
        </label>
        {persona.foto_url && <button type="button" className="btn-ghost" disabled={saving} onClick={remove} style={{ ...buttonStyle, color:'var(--alert)' }}><Trash2 size={13} /> Eliminar</button>}
        <p style={{ width:'100%', color:'var(--text-dim)', fontSize:'0.6rem', margin:0 }}>JPG, PNG o WebP · máximo 5 MB</p>
      </div>
    </div>
  )
}
