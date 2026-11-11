import React, { useState } from 'react'
import { ShieldCheck, ShieldX, UserRound } from 'lucide-react'
import { resolveCredentialArea } from '../lib/credentialAreas'
import CredentialAccessList from './CredentialAccessList'
const date = value => value ? new Date(String(value).length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('es-AR') : 'No informado'
const time = value => value ? new Date(value).toLocaleString('es-AR') : 'Pendiente'

export default function SeguridadScanResult({ result, sedeNombre }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const credential = result.tipo === 'credencial' || Array.isArray(result.sectores)
  const allowed = credential ? result.estado === 'activa' && result.sectores?.length > 0 : result.vigente === true
  const Icon = allowed ? ShieldCheck : ShieldX
  const area = resolveCredentialArea({}, result)
  const field = (label, value) => <div><dt>{label}</dt><dd>{value || 'No informado'}</dd></div>
  return <section className={'porteria-result ' + (allowed ? 'is-allowed' : 'is-denied')} aria-label="Resultado del escaneo">
    <div className="porteria-verdict"><Icon size={24}/><div><strong>{allowed ? 'ACCESO HABILITADO EN ESTE PUESTO' : 'NO HABILITAR EL INGRESO'}</strong><p>{sedeNombre} · {String(result.estado || 'Sin validar').toUpperCase()}</p></div></div>
    <div className="porteria-identity">
      {credential && <div className="porteria-photo">
        {result.foto_url && !photoFailed ? <img src={result.foto_url} alt={'Foto de ' + result.nombre} onError={() => setPhotoFailed(true)} style={{ objectPosition:(result.foto_pos_x ?? 50)+'% '+(result.foto_pos_y ?? 50)+'%' }}/> : <div><UserRound size={52}/><span>{result.foto_error || photoFailed ? 'Foto no disponible' : 'Sin foto cargada'}</span></div>}
      </div>}
      <div className="porteria-person">
        <span className="porteria-eyebrow">{credential ? 'Identificación del personal' : 'Pase de visita / temporal'}</span>
        <h2>{result.nombre || result.titular || result.codigo}</h2>
        <p>{credential ? result.puesto || 'Puesto no informado' : result.empresa || 'Visita acompañada'}</p>
        {credential && <span className="porteria-area">{area.code} · {area.label}</span>}
        <dl className="porteria-fields">
          {credential ? <>{field('Legajo',result.legajo)}{field('Empresa',result.empresa)}{field('Emisión',date(result.fecha_emision))}{field('Vencimiento',date(result.fecha_vencimiento))}</> : <>{field('Pase',result.codigo)}{field('Acompañante obligatorio',result.acompanante)}{field('Sector',result.sector)}{field('Válido hasta',time(result.hasta))}</>}
        </dl>
      </div>
    </div>
    {credential && <div className="porteria-result-access"><CredentialAccessList sectors={result.sectores || []} dark title="Accesos en este puesto"/></div>}
    {result.primera_entrega && <p className="porteria-delivery">Primera entrega de credencial registrada.</p>}
    {result.entregada_at && <p className="porteria-delivery">Credencial entregada: {time(result.entregada_at)}</p>}
    <p className="porteria-note">Compará la foto con la persona y verificá el sector autorizado antes de permitir el ingreso.</p>
  </section>
}
