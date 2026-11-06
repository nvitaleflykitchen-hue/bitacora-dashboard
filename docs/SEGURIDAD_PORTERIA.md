# Seguridad y Portería

## Alcance
- Cuentas propias con rol `seguridad` y sedes asignadas. Pantalla exclusiva adaptable a escritorio y móvil. Admin accede desde Equipo > Pases acompañados.
- Escaneo por cámara o enlace/lector: valida credenciales y pases en el servidor. El primer escaneo válido de una credencial en una sede autorizada registra una única entrega física con fecha, usuario y sede. Un QR público o una credencial inválida no registra entrega.
- La ficha administrativa de credencial muestra la entrega física.
- Visitas: nombre, DNI, empresa, patente opcional, sector, acompañante con autorización vigente, vencimiento máximo 24 horas y confirmaciones de autorización/presencia, DNI en custodia e inducción. El DNI no se incluye en el QR público.
- Egreso: recuperación del pase, control de salida y devolución del DNI. Conserva historial y contempla pase extraviado con anulación.
- Los cinco pases temporales existentes se conservan para operarios, con acompañante distinto y autorizado.

## Archivos para aprobar y orden de publicación
1. Revisar `supabase/security/seguridad_porteria_REVIEW.sql` y autorizar su aplicación exclusivamente en `mixyhfdlzjarvszinytk`.
2. El SQL agrega el rol al CHECK, tres tablas privadas para custodia/entregas/escaneos, una RPC por sede, lectura del perfil propio, políticas restrictivas para el nuevo rol y un pre-request hook de REST. Las políticas previas de los demás roles se conservan. El hook actual fue consultado: no había otro configurado. Antes de aplicar, verificar que siga sin haber uno.
3. El SQL también corrige el `id` ambiguo de `acompanantes_pase` y revoca la ejecución de los endpoints de entrega/cierre anteriores para que no permitan eludir el DNI. Aplicar coordinadamente con el frontend: durante el intervalo el formulario anterior puede devolver permiso denegado.
4. Publicar `supabase/functions/create-user-direct/index.ts`, recuperado de la versión 16 en producción y ampliado para Seguridad con sedes válidas obligatorias. No crea cuentas automáticamente ni envía mensajes. La pantalla muestra la contraseña temporal individual devuelta por el servidor.
5. PR desde `origin/main`, checks aprobados, merge y verificación de la URL pública. No usar Vercel CLI/MCP.
6. Crear las cuentas desde Usuarios y asignar las sedes de cada guardia. No se recibieron todavía nombres ni correos para crearlas.

## Seguridad y límites
- Ninguna consulta de portería expone desempeño, remuneraciones, domicilio o salud del personal.
- Los datos de DNI sólo se devuelven para entregas abiertas y sedes autorizadas; no se copian a perfiles ni Auth.
- El bloqueo REST complementa políticas restrictivas en tablas con RLS (incluido Storage) para el rol Seguridad. No convierte en privados los recursos que ya eran públicos para anon ni cambia las políticas de otros usuarios.
- No se envía el informe nocturno por email ni se automatizan acciones mencionadas en el PDF: el pedido implementado son los tres puntos de escaneo, pases contra DNI y entrega física.
- No se accionan barreras ni se otorgan habilitaciones aeroportuarias.

## Verificación
- `npm run test:seguridad`: Postgres aislado PGlite, sin conexión a producción. Prueba roles, sedes, acompañantes, DNI, devolución, idempotencia del primer escaneo, estado anulado, guardia inactivo, acceso anónimo, bloqueo REST y tabla privada.
- Pruebas unitarias y de UI: `seguridad.test.js`, `SeguridadPorteria.test.jsx`, además de regresión de roles, usuarios y credenciales.
- No se insertaron ni modificaron datos reales durante el desarrollo.

## Aplicación autorizada — 2026-11-06
- Autorización explícita del usuario recibida. Migración aplicada: 20261106175629_seguridad_porteria_autorizada, proyecto mixyhfdlzjarvszinytk.
- Restricción aplicada a 166 tablas con RLS, incluidas storage.objects y storage.buckets. Las tablas internas administradas por Supabase se excluyen: no tienen políticas permisivas. El intento inicial se revirtió íntegramente.
- create-user-direct publicado como versión 17, conservando la autenticación propia y verify_jwt=false.
- No se crearon cuentas ni se registraron entregas de prueba en producción.
