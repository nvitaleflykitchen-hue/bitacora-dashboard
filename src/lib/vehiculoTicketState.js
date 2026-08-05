export const VEHICULO_UI_ESTADOS = ['abierto', 'en progreso', 'bloqueado', 'resuelto', 'rechazado']

// La base histórica usa `aprobado` para la columna visual "Bloqueado".
// Este adaptador evita propagar esa ambigüedad por la interfaz sin romper filas existentes.
export const vehiculoEstadoFromDb = estado => estado === 'aprobado' ? 'bloqueado' : estado
export const vehiculoEstadoToDb = estado => estado === 'bloqueado' ? 'aprobado' : estado

