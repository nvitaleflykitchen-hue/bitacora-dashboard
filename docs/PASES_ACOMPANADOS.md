# Pases acompañados — revisión para activar

## Comportamiento
- Cinco pases reutilizables ATA-01 a ATA-05, sin autorización hasta registrar una entrega.
- Visita acompañada: pase individual emitido para la visita, queda anulado al devolverlo.
- Cada entrega identifica titular, acompañante, sector y horario; guarda administrador que registra y devolución/extravío. El historial no se borra.
- Cualquier empleado activo con credencial y permiso vigentes al sector puede acompañar. No se infiere permiso por cargo. Se verifica otra vez al escanear, incluyendo revocación, FA vencido y suspensión del sector.
- Acompañamiento presencial obligatorio: el QR no puede comprobar presencia física. La recepción debe cotejar identidades.
- La entrega se registra por un administrador, confirmando la autorización del acompañante. Vigencia configurable hasta 24 horas (valor inicial 4 h).
- Una sola entrega sin devolución por pase; incluso vencido requiere registrar devolución. Extravío anula el pase.
- Operarios: la entrega no modifica sus accesos permanentes. Visitas: no crea una persona/usuario del sistema.
- Historial visible: últimas 1000 entregas y todas las abiertas. La base conserva el historial completo.

## Ubicación
Escritorio: Equipo → Credenciales emitidas → Pases acompañados.
Móvil: Personal → Pases acompañados (administrador).
QR externo e interno comparten verificación actual; muestra sólo titular, acompañante, sede/sector y vigencia cuando está vigente. No publica DNI, teléfono ni historial.

## SQL autorizado y aplicado
`supabase/migrations/20261026164321_pases_acompanados.sql`

Crea dos tablas con RLS: sólo lectura para administradores activos, sin escritura directa de anon/authenticated. RPCs de entrega/devolución/listado de acompañantes validan administrador. RPC pública de verificación sólo consulta un token aleatorio y no permite emitir ni modificar permisos. Helper privado sin EXECUTE para anon/authenticated. No altera políticas existentes ni datos de reportes. Crea cinco tarjetas sin ninguna entrega ni acceso habilitado.

Autorización explícita recibida y aplicada el 26/10/2026 exclusivamente en mixyhfdlzjarvszinytk. Cinco pases creados y ninguna entrega. No volver a aplicar.

## Verificación
`npm run test:pases` usa PostgreSQL WASM aislado, nunca Supabase. Comprueba catálogo de cinco, RLS, administrador, acompañante, no autoacompañamiento, sector pendiente/suspendido, expiración, titular inactivo, devolución, reuso, visita, extravío y revocación.
Pruebas UI: contenedor QR desplazable, pase sin entrega, caducidad sin recarga y lectura de QR de pase.
