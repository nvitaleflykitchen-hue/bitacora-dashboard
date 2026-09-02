import { supabase } from './supabase'

export const PUBLIC_COMPANY_CONTACT = Object.freeze({
  name: 'Fly Kitchen',
  tagline: 'Soluciones gastronómicas',
  phoneLabel: '+54 9 3515 939373',
  phoneHref: 'tel:+5493515939373',
  whatsappHref: 'https://wa.me/5493515939373',
  email: 'info@flykitchen.com.ar',
  website: 'https://flykitchen.com.ar/',
  instagram: 'https://www.instagram.com/flykitchencatering/',
  linkedin: 'https://ar.linkedin.com/company/flykitchen',
})

export async function getPublicAssetQr(assetId) {
  if (!assetId) throw new Error('Falta el identificador del equipo.')

  const { data, error } = await supabase.rpc('consultar_activo_qr', {
    p_activo_id: assetId,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] || null : data
}
