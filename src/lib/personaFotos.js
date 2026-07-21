import { supabase } from './supabase'

export const PERSONA_FOTOS_BUCKET = 'fotos-personal'
export const PERSONA_FOTO_MAX_BYTES = 5 * 1024 * 1024
export const PERSONA_FOTO_THUMB_SIZE = 256
const SIGNED_URL_TTL_SECONDS = 60 * 60
const SIGNED_URL_CACHE_MS = 55 * 60 * 1000
const signedUrlCache = new Map()
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function validarPersonaFoto(file) {
  if (!file) throw new Error('Seleccioná una imagen.')
  if (!MIME_EXTENSIONS[file.type]) throw new Error('La foto debe ser JPG, PNG o WebP.')
  if (file.size > PERSONA_FOTO_MAX_BYTES) throw new Error('La foto no puede superar los 5 MB.')
}

export function personaFotoThumbPath(storagePath) {
  if (!storagePath || /^https?:\/\//i.test(storagePath)) return null
  return storagePath.replace(/\.[^./]+$/, '-thumb.webp')
}

function signedUrl(storagePath, transform = null) {
  const cacheKey = transform ? `${storagePath}:${JSON.stringify(transform)}` : storagePath
  const cached = signedUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.promise
  const promise = supabase.storage
    .from(PERSONA_FOTOS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, transform ? { transform } : undefined)
    .then(({ data, error }) => {
      if (error) throw error
      return data?.signedUrl || null
    })
    .catch(error => {
      signedUrlCache.delete(cacheKey)
      throw error
    })
  signedUrlCache.set(cacheKey, { promise, expiresAt:Date.now() + SIGNED_URL_CACHE_MS })
  return promise
}

export async function getPersonaFotoUrl(storagePath) {
  if (!storagePath) return null
  if (/^https?:\/\//i.test(storagePath)) return storagePath
  return signedUrl(storagePath)
}

export async function getPersonaFotoUrls(storagePath) {
  if (!storagePath) return { thumbnail:null, original:null }
  if (/^https?:\/\//i.test(storagePath)) return { thumbnail:null, original:storagePath }
  const [thumbnail, original] = await Promise.all([
    signedUrl(storagePath, { width:PERSONA_FOTO_THUMB_SIZE, height:PERSONA_FOTO_THUMB_SIZE, resize:'cover', quality:70 }),
    signedUrl(storagePath),
  ])
  return { thumbnail, original }
}

function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo procesar la foto.')) }
    image.src = url
  })
}

export async function crearPersonaFotoThumbnail(file) {
  const image = await cargarImagen(file)
  const size = PERSONA_FOTO_THUMB_SIZE
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('No se pudo generar la miniatura.')),
      'image/webp',
      0.78,
    )
  })
}

export async function guardarPersonaFoto(personaId, file, fotoAnterior = null) {
  validarPersonaFoto(file)
  const ext = MIME_EXTENSIONS[file.type]
  const path = `personas/${personaId}/perfil-${Date.now()}.${ext}`
  const thumbPath = personaFotoThumbPath(path)
  const thumbnail = await crearPersonaFotoThumbnail(file)
  const { error: uploadError } = await supabase.storage
    .from(PERSONA_FOTOS_BUCKET)
    .upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false })
  if (uploadError) throw uploadError

  const { error: thumbUploadError } = await supabase.storage
    .from(PERSONA_FOTOS_BUCKET)
    .upload(thumbPath, thumbnail, { cacheControl: '31536000', contentType: 'image/webp', upsert: false })
  if (thumbUploadError) {
    await supabase.storage.from(PERSONA_FOTOS_BUCKET).remove([path]).catch(() => {})
    throw thumbUploadError
  }

  const { error: updateError } = await supabase
    .schema('equipo')
    .from('personas')
    .update({ foto_url: path })
    .eq('id', personaId)
  if (updateError) {
    await supabase.storage.from(PERSONA_FOTOS_BUCKET).remove([path, thumbPath])
    throw updateError
  }

  if (fotoAnterior && !/^https?:\/\//i.test(fotoAnterior) && fotoAnterior !== path) {
    await supabase.storage
      .from(PERSONA_FOTOS_BUCKET)
      .remove([fotoAnterior, personaFotoThumbPath(fotoAnterior)])
      .catch(() => {})
  }
  return path
}

export async function eliminarPersonaFoto(personaId, storagePath) {
  const { error: updateError } = await supabase
    .schema('equipo')
    .from('personas')
    .update({ foto_url: null })
    .eq('id', personaId)
  if (updateError) throw updateError
  if (storagePath && !/^https?:\/\//i.test(storagePath)) {
    const { error } = await supabase.storage
      .from(PERSONA_FOTOS_BUCKET)
      .remove([storagePath, personaFotoThumbPath(storagePath)])
    if (error) console.warn('[personaFotos] no se pudo retirar el objeto anterior', error)
  }
}
