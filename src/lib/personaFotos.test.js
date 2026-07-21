import { describe, expect, it } from 'vitest'
import { PERSONA_FOTO_MAX_BYTES, personaFotoThumbPath, validarPersonaFoto } from './personaFotos'

describe('validarPersonaFoto', () => {
  it('acepta formatos de imagen habilitados dentro del límite', () => {
    expect(() => validarPersonaFoto({ type:'image/jpeg', size:1024 })).not.toThrow()
    expect(() => validarPersonaFoto({ type:'image/png', size:PERSONA_FOTO_MAX_BYTES })).not.toThrow()
    expect(() => validarPersonaFoto({ type:'image/webp', size:2048 })).not.toThrow()
  })

  it('rechaza archivos que no son imagen o superan 5 MB', () => {
    expect(() => validarPersonaFoto({ type:'application/pdf', size:1024 })).toThrow('JPG, PNG o WebP')
    expect(() => validarPersonaFoto({ type:'image/jpeg', size:PERSONA_FOTO_MAX_BYTES + 1 })).toThrow('5 MB')
  })
})

describe('personaFotoThumbPath', () => {
  it('deriva una miniatura WebP junto al original', () => {
    expect(personaFotoThumbPath('personas/42/perfil-123.jpeg')).toBe('personas/42/perfil-123-thumb.webp')
    expect(personaFotoThumbPath('personas/42/perfil-123.webp')).toBe('personas/42/perfil-123-thumb.webp')
  })

  it('no intenta derivar miniaturas de URLs externas', () => {
    expect(personaFotoThumbPath('https://example.com/foto.jpg')).toBeNull()
  })
})
