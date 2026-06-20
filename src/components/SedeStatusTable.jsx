import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle } from 'lucide-react'

const estadoConfig = {
  'Sin novedades': { bg: 'bg-green-100', text: 'text-green-800', badge: 'bg-green-200 text-green-900' },
  'Hay novedades': { bg: 'bg-yellow-50', text: 'text-yellow-800', badge: 'bg-yellow-200 text-yellow-900' },
  'Operación condicionada': { bg: 'bg-red-50', text: 'text-red-800', badge: 'bg-red-200 text-red-900' },
}

export default function SedeStatusTable({ registros, sedes, onRowClick }) {
  const sedesConRegistro = new Map(registros.map(r => [r.sede_id, r]))
  const sedesQueNoReportaron = sedes.filter(s => !sedesConRegistro.has(s.id))

  return (
    <div className="space-y-4">
      {/* Sedes sin reporte */}
      {sedesQueNoReportaron.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-orange-600" />
            <span className="text-sm font-semibold text-orange-800">
              Sin reporte hoy ({sedesQueNoReportaron.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sedesQueNoReportaron.map(s => (
              <span key={s.id} className="text-xs bg-orange-200 text-orange-900 rounded-full px-2.5 py-1">
                {s.nombre}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Sede</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Turno</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Escalamiento</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Reporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {registros.map(r => {
                const cfg = estadoConfig[r.estado_general] || estadoConfig['Sin novedades']
                const rowEsc = r.requiere_escalamiento
                return (
                  <tr
                    key={r.id}
                    onClick={() => onRowClick?.(r)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors
                      ${rowEsc ? 'bg-red-50 hover:bg-red-100' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.sede_nombre}</div>
                      {r.reportante && <div className="text-xs text-gray-400">{r.reportante}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-gray-500">{r.sedes?.tipo || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">{r.turno || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                        {r.estado_general}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {rowEsc ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium">
                          <AlertTriangle size={12} /> {r.escalado_a || 'Sí'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">
                      {r.fecha_reporte ? format(new Date(r.fecha_reporte), 'HH:mm', { locale: es }) : '—'}
                    </td>
                  </tr>
                )
              })}
              {registros.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Sin registros para hoy
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
