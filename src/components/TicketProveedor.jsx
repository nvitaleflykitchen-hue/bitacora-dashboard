import React, { useEffect, useState } from 'react'
import { getProveedores } from '../lib/queries'

export default function TicketProveedor({ value, onChange, disabled = false }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getProveedores().then(data => { if (active) setRows(data) })
      .catch(e => { if (active) setError(e.message || 'No se pudieron cargar los proveedores.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return <label className="block text-sm">Proveedor / taller que realiza el trabajo
    <select className="input-dark w-full mt-1" value={value || ''} onChange={e => onChange(e.target.value || null)} disabled={disabled || loading || Boolean(error)}>
      <option value="">{loading ? 'Cargando proveedores…' : 'Sin proveedor asignado'}</option>
      {value && !rows.some(row => String(row.id) === String(value)) && <option value={value}>Proveedor asignado ({value})</option>}
      {rows.filter(row => row.estado === 'activo' || String(row.id) === String(value)).map(row => <option key={row.id} value={row.id}>{row.nombre}{row.estado !== 'activo' ? ' (inactivo)' : ''}</option>)}
    </select>
    {error && <span role="alert">{error}</span>}
  </label>
}
