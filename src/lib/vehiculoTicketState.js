export const VEHICULO_UI_ESTADOS = ['abierto', 'en progreso', 'bloqueado', 'resuelto', 'rechazado']

// La base histórica usa `aprobado` para la columna visual "Bloqueado".
// Este adaptador evita propagar esa ambigüedad por la interfaz sin romper filas existentes.
export const vehiculoEstadoFromDb = estado => estado === 'en_progreso' ? 'en progreso' : estado === 'aprobado' ? 'bloqueado' : estado
export const vehiculoEstadoToDb = estado => estado === 'en progreso' ? 'en_progreso' : estado === 'bloqueado' ? 'aprobado' : estado

