import React, { useState } from 'react'
import { groupCredentialSectors } from '../lib/credentialAccess'

export default function CredentialAccessList({ sectors = [], dark = false, title = 'Sedes con acceso' }) {
  const groups = groupCredentialSectors(sectors)
  const [selected, setSelected] = useState('')
  const current = groups.find(g => g.sedeId === selected) || groups[0]
  if (!groups.length) return <p style={{ fontSize: 14 }}>Sin sectores habilitados para ingreso.</p>
  return <section style={{ textAlign:'left' }}>
    <label style={{ display:'block',fontSize:13,fontWeight:600 }}>{title} · {groups.length}
      <select aria-label={title} className={dark ? 'input-dark w-full' : undefined} value={current.sedeId} onChange={e => setSelected(e.target.value)}
        style={{ display:'block',width:'100%',marginTop:8,padding:10,borderRadius:8,...(!dark ? { background:'#f6f7f8',color:'#111',border:'1px solid #ccc' } : {}) }}>
        {groups.map(g => <option key={g.sedeId} value={g.sedeId}>{g.nombre}</option>)}
      </select>
    </label>
    <ul style={{ listStyle:'none',padding:0,margin:'12px 0 0',maxHeight:230,overflowY:'auto' }}>
      {current.sectores.map(s => <li key={s.id} style={{ display:'flex',gap:10,alignItems:'baseline',padding:'9px 0',borderBottom:'1px solid rgba(128,128,128,.2)',fontSize:13 }}>
        <b style={{ minWidth:32,color:s.zra ? (dark ? '#fbbf24' : '#a44200') : undefined }}>{s.codigo}</b>
        <span>{s.nombre}{s.zra && s.tipo !== 'permiso' && <small style={{ display:'block' }}>Sector restringido · requiere control de habilitación</small>}</span>
      </li>)}
    </ul>
  </section>
}
