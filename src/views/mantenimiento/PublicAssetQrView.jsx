import { useEffect, useState } from 'react'
import { ExternalLink, Globe2, Instagram, Linkedin, Mail, MessageCircle, Phone } from 'lucide-react'
import { getPublicAssetQr, PUBLIC_COMPANY_CONTACT as contact } from '../../lib/publicAssetQr'

const card = {
  background: '#fff', border: '1px solid #ece7e1', borderRadius: 18,
  boxShadow: '0 18px 50px rgba(45,35,25,.09)',
}

function Channel({ href, icon: Icon, children, primary = false }) {
  return (
    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        minHeight: 48, padding: '10px 13px', borderRadius: 12, textDecoration: 'none',
        fontWeight: 750, fontSize: '.88rem', color: primary ? '#fff' : '#352c26',
        background: primary ? '#eb6600' : '#fff',
        border: primary ? '1px solid #eb6600' : '1px solid #e7dfd7',
      }}>
      <Icon size={18} aria-hidden="true" /> {children}
    </a>
  )
}

export default function PublicAssetQrView({ assetId }) {
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    getPublicAssetQr(assetId)
      .then(value => {
        if (!active) return
        setAsset(value)
        setNotFound(!value)
      })
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [assetId])

  return (
    <main style={{ minHeight: '100dvh', background: 'linear-gradient(160deg,#fffaf4 0%,#f6efe7 100%)', color: '#211b17', padding: '22px 16px 32px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', padding: '12px 0 22px' }}>
          <img src="/fly-kitchen-credencial.png" alt="Fly Kitchen" style={{ width: 230, maxWidth: '72%', height: 78, objectFit: 'contain' }} />
          <p style={{ margin: 4, color: '#7b6d62', fontSize: '.88rem' }}>{contact.tagline}</p>
        </header>

        <section style={{ ...card, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: 7, background: '#eb6600' }} />
          <div style={{ padding: '24px 22px' }}>
            <p style={{ margin: '0 0 8px', color: '#eb6600', fontWeight: 800, fontSize: '.72rem', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              Equipo identificado
            </p>
            {loading ? (
              <p role="status" style={{ color: '#766a61', margin: 0 }}>Consultando identificación…</p>
            ) : notFound ? (
              <>
                <h1 style={{ margin: '0 0 8px', fontSize: '1.35rem' }}>Identificación no disponible</h1>
                <p style={{ margin: 0, color: '#766a61', lineHeight: 1.5 }}>El código no corresponde a un equipo público vigente. Podés comunicarte con Fly Kitchen desde los canales de abajo.</p>
              </>
            ) : (
              <>
                <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.35rem,6vw,1.8rem)', lineHeight: 1.16 }}>{asset.nombre}</h1>
                <p style={{ margin: 0, color: '#766a61', lineHeight: 1.55 }}>
                  {[asset.categoria, [asset.marca, asset.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Activo de Fly Kitchen'}
                </p>
                {asset.codigo_interno && <p style={{ margin: '13px 0 0', color: '#3f352e', fontWeight: 800, fontSize: '.86rem' }}>Código: {asset.codigo_interno}</p>}
              </>
            )}
          </div>
        </section>

        <section style={{ ...card, padding: '22px', marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 5px', fontSize: '1.08rem' }}>Contactá a Fly Kitchen</h2>
          <p style={{ margin: '0 0 17px', color: '#766a61', fontSize: '.86rem', lineHeight: 1.5 }}>Consultas, información o aviso sobre este equipo.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
            <Channel href={contact.whatsappHref} icon={MessageCircle} primary>WhatsApp</Channel>
            <Channel href={contact.phoneHref} icon={Phone}>Llamar</Channel>
            <Channel href={`mailto:${contact.email}`} icon={Mail}>Email</Channel>
            <Channel href={contact.website} icon={Globe2}>Sitio web</Channel>
          </div>
          <p style={{ textAlign: 'center', margin: '15px 0 0', color: '#5e5148', fontWeight: 700, fontSize: '.86rem' }}>{contact.phoneLabel}</p>
        </section>

        <section style={{ ...card, padding: '19px 22px' }}>
          <p style={{ margin: '0 0 13px', textAlign: 'center', color: '#766a61', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>Seguinos</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <Channel href={contact.instagram} icon={Instagram}>Instagram</Channel>
            <Channel href={contact.linkedin} icon={Linkedin}>LinkedIn</Channel>
          </div>
        </section>

        <footer style={{ textAlign: 'center', padding: '22px 8px 0', color: '#8b7e73', fontSize: '.72rem' }}>
          <a href={contact.website} target="_blank" rel="noreferrer" style={{ color: '#725f51', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            flykitchen.com.ar <ExternalLink size={12} />
          </a>
          <p style={{ margin: '8px 0 0' }}>Esta página pública no muestra información operativa ni documentación interna.</p>
        </footer>
      </div>
    </main>
  )
}
