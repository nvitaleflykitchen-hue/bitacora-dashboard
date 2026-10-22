import React from 'react'
import { LockKeyhole, Check } from 'lucide-react'
import { isTotalAccess, sectorCode } from '../lib/sectorMatrix'

export default function SectorMatrix({ sectors, selectedIds = [], onSelect, disabled = false }) {
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10}}>
    {sectors.filter(sector => !isTotalAccess(sector)).map(sector => <button key={sector.id} type="button" disabled={disabled} aria-pressed={selectedIds.includes(sector.id)} onClick={() => onSelect?.(sector)} style={{textAlign:'left',minHeight:145,padding:12,borderRadius:8,background:sector.color || '#334155',color:'#fff',border:selectedIds.includes(sector.id)?'3px solid #fff':'3px solid transparent',opacity:sector.activo === false?.5:1}}>
      <span style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>{sector.numero ? String(sector.numero).padStart(2,'0') : sector.codigo}</span>{selectedIds.includes(sector.id) && <Check size={16} aria-label="Seleccionado"/>}</span>
      <strong style={{display:'block',fontSize:32,lineHeight:1.2}}>{sector.simbolo || sector.codigo}</strong>
      <span style={{display:'block',fontSize:14,fontWeight:600,margin:'5px 0'}}>{sector.nombre}</span>
      <span style={{display:'flex',gap:4,alignItems:'center',fontSize:11}}>{sector.zra && <LockKeyhole size={12}/>} {sector.zra?'Restringido':'General · requiere autorización'}</span>
      {sector.vigente_hasta && <span style={{display:'block',fontSize:11,marginTop:4}}>Vigente hasta {sector.vigente_hasta}</span>}
      {sector.activo === false && <span>Inactivo</span>}
      <span className="sr-only">{sectorCode(sector)}</span>
    </button>)}
  </div>
}
