# Formularios y permisos aeroportuarios

Implementación del 2026-10-04. SQL aprobado explícitamente por el usuario y aplicado el 2026-10-04 en `mixyhfdlzjarvszinytk`.

## Acceso

Equipo → Formularios y permisos; ficha personal → Generar formulario. Componente compartido en escritorio y móvil, carga diferida. Vacaciones y EPP enlazan a las pantallas existentes. Las plantillas iniciales son auto-acompañamiento y Anexo E. Otros modelos requieren incorporar su plantilla.

El límite obligatorio se valida en las RPC: únicamente sedes cuyo tipo es `Aeropuerto`. Administradores acceden a todos los aeropuertos; encargados y supervisores a sus sedes asignadas (o grupo asignado cuando corresponda). Ningún Editor obtiene acceso automáticamente. Como no existe un rol general Supervisor, un administrador puede designar usuarios activos como supervisores de esta función, sin modificar sus roles ni sus sedes. Inicialmente no se designa ninguno. La configuración permite acciones por categoría: ver, crear, editar, generar, firmar, presentar, anular y administrar plantillas.

## Persistencia y archivos

La migración `supabase/migrations/20261003235333_formularios_permisos_review.sql` está destinada **exclusivamente a mixyhfdlzjarvszinytk**. Crea tablas `fp_*`, RPC con alcance validado y almacenamiento privado `formularios-permisos`. Revoca acceso directo a las tablas nuevas. No cambia políticas de tablas/buckets existentes. Debe aprobarse explícitamente antes de aplicarse por contener GRANT/RLS/políticas de Storage (AGENTS.md §0.3).

Cada borrador guarda personas, variables y versión de plantilla. La vista previa guarda primero ese borrador; el PDF definitivo se genera exactamente desde esa instantánea y se finaliza sólo después de subirlo. La versión del registro evita sobrescribir cambios concurrentes. Después de generado se puede duplicar, pero no editar el contenido. El archivo y los datos permanecen cuando se anula. Los cambios registran usuario, fecha, estado anterior y posterior. Firmado/presentado son estados declarados por el usuario, no firmas digitales ni presentación automática ante PSA.

Los PDF se descargan con sesión autenticada y permiso sobre la sede. No hay políticas de actualización/eliminación de archivos. Si falla la finalización después de una subida, puede quedar un archivo sin referencia; no se expone en el historial ni se informa generación exitosa. Su eventual limpieza requiere revisión administrativa, nunca borrado automático de documentos válidos.

Los datos aeroportuarios adicionales viven en `fp_aeroportuarios`, con trazabilidad. PPA y vencimiento existentes se usan como valores iniciales; los datos guardados aquí prevalecen para formularios. No se sincronizan hacia el sistema de credenciales físicas.

## Plantillas

Los fondos PDF fueron derivados de los dos originales aportados: se conservaron membretes y firmas, retirando efectivamente el texto personal prellenado del Anexo E. Los datos variables se redistribuyen con pdf-lib. Se admiten cinco personas por página de Anexo E, hasta cien por documento. Textos extensos y observaciones se conservan en páginas complementarias. La vista previa permite revisar el resultado antes de emitir; la aceptación del formato corresponde al organismo receptor.

Crear una versión administrativa conserva el diseño de ese tipo y permite nombre/instrucciones diferentes. Cambiar el diseño oficial exige agregar un nuevo recurso PDF y layout versionado en el código; los PDF emitidos no se regeneran ni cambian. No hay editor visual de coordenadas ni importación arbitraria de plantillas en esta primera versión.

Se advierte por DNI/cargo ausentes, falta/vencimiento/estado de PPA, sectores no habilitados y justificaciones ausentes. El usuario debe confirmar esas advertencias antes de emitir y se guardan con el formulario. Fecha, horario, tareas, selección de personas y sectores válidos son obligatorios. Los horarios pertenecen al mismo día. Alertas automáticas de vencimiento quedan para una segunda etapa.

## Verificación

Pruebas con Postgres aislado (PGlite): roles/sedes, acceso anónimo/directo, concurrencia, almacenamiento privado, estados, auditoría y versiones. Pruebas de validaciones, PDF multipágina y UI de advertencias/error de almacenamiento. Revisión visual de PDF y navegador con datos ficticios y red externa bloqueada. No se insertaron registros de prueba en producción.

## Habilitación de base verificada

Se verificaron las seis tablas con RLS, dos plantillas iniciales, bucket privado de 3 MB y ausencia de permisos anónimos de ejecución o de escritura directa autenticada. No se designaron supervisores automáticamente. El aviso informativo de Supabase «RLS enabled, no policies» es esperado en estas tablas: se revocó acceso directo y las operaciones pasan exclusivamente por RPC con validación de usuario y sede. No agregar políticas permisivas para silenciarlo.
