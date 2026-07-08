// Traducción de errores de Supabase/Postgres/red a mensajes entendibles.
// Importante desde el endurecimiento de RLS (2026-07-08): un usuario sin
// permiso recibe errores 42501/PGRST301 que antes no existían.

const MAPA = [
  { test: e => e?.code === '42501' || /row-level security|permission denied/i.test(e?.message || ''),
    msg: 'No tenés permiso para realizar esta acción. Si creés que deberías poder, avisale a un administrador.' },
  { test: e => e?.code === '23505' || /duplicate key/i.test(e?.message || ''),
    msg: 'Ya existe un registro con esos datos (duplicado).' },
  { test: e => e?.code === '23503' || /foreign key/i.test(e?.message || ''),
    msg: 'No se puede completar: hay datos relacionados que dependen de este registro.' },
  { test: e => /Failed to fetch|NetworkError|ERR_INTERNET|fetch failed/i.test(e?.message || ''),
    msg: 'Sin conexión con el servidor. Revisá tu internet e intentá de nuevo.' },
  { test: e => e?.code === 'PGRST301' || /JWT expired/i.test(e?.message || ''),
    msg: 'Tu sesión expiró. Recargá la página y volvé a ingresar.' },
]

/**
 * Devuelve un mensaje amigable para el usuario final.
 * Los RAISE EXCEPTION propios de la base (triggers de Compras, registros, etc.)
 * ya vienen en castellano y se muestran tal cual.
 */
export function mensajeError(e, fallback = 'Ocurrió un error inesperado. Intentá de nuevo.') {
  if (!e) return fallback
  for (const { test, msg } of MAPA) {
    try { if (test(e)) return msg } catch { /* seguir */ }
  }
  const m = e.message || e.error_description || e.error || ''
  // Mensajes de triggers propios (castellano) → mostrar tal cual
  if (/[a-záéíóúñ]/i.test(m) && !/^(TypeError|ReferenceError)/.test(m) && m.length < 200 && !/[a-z_]+\.[a-z_]+/.test(m)) return m
  return m ? `${fallback} (detalle: ${m.slice(0, 120)})` : fallback
}
