# Matriz de sectores — diagnóstico previo

Fecha: 22/10/2026. Revisión de origin/main cacf203 y consultas de solo lectura al proyecto mixyhfdlzjarvszinytk.

## Decisión del usuario
Reemplazar el catálogo anterior de Planta Córdoba. No convertir autorizaciones por número o nombre. Conservar instantáneas históricas. La sustitución desactivará los sectores anteriores de la sede 24; la verificación QR dejará de mostrarlos como autorizados. Asignar los nuevos sectores individualmente. No modificar el catálogo del Aeropuerto de Córdoba (sede 21).

## Diagnóstico comprobado
- Planta de Producción Córdoba es sede 24; Aeropuerto de Córdoba es sede 21.
- Ya existen equipo.credencial_sectores y equipo.credenciales_personal. Los permisos están en sectores_autorizados, como instantánea inmutable de cada emisión; no crear una segunda fuente de autorizaciones.
- Hay 188 emisiones, 172 con estado activa y 6 emisiones con sectores (no equivale a seis personas vigentes).
- Coexisten códigos numéricos y letras. 04 significa Armado aeroportuario y la propuesta usa 04-Vd para Verdulería. No son equivalentes.
- La emisión permite hoy solo letras ABCDGHIJKLMZ; la API y el selector deben ampliarse juntos.
- Z representa acceso total por sede. Debe mostrarse fuera de la matriz física.
- El catálogo permite lectura solo a administradores y no escritura desde el cliente. Las modificaciones de políticas o GRANT requieren mostrar SQL y recibir autorización, según AGENTS.md §0.3.
- El QR ya filtra credenciales anuladas, vencidas, personas inactivas y sectores desactivados. Debe filtrar además el vencimiento individual del permiso.
- La vista previa CR80, el PDF y el QR reutilizan el mismo agrupamiento por sede. La selección usa el mismo modal en escritorio y móvil.

## Cambios necesarios
1. Ampliar el catálogo existente: número, símbolo, grupo funcional, color y tipo (sector físico/condición especial). UUID estable, número y símbolo inmutables, unicidad por sede, baja lógica.
2. Crear 01-Of a 18-Ae en sede 24 y retirar el catálogo anterior, preservando filas e instantáneas. 19-Zr queda fuera hasta confirmar un recinto físico independiente.
3. Guardar vencimiento opcional por autorización en la instantánea existente. Sin vencimiento propio rige el de la credencial. Las revocaciones se realizan mediante reemisión atómica, invalidando el QR anterior.
4. Registrar actor, persona, sector, operación y vigencia en un historial de auditoría sin escritura directa desde el cliente.
5. Mantener la emisión en administradores. Integrar las solicitudes de responsables con las facultades existentes; no dar permisos nuevos por el nombre de su rol. La consulta propia debe comprobar persona.perfil_id en servidor.
6. Separar administración del catálogo y autorizaciones. Matriz adaptable con candado y texto, no solo color; credencial compacta, manteniendo frente y dorso.
7. Ensayar SQL en Postgres aislado, nunca insertando personas o permisos de prueba en producción. Verificar rechazo de anónimos, usuarios sin facultad, sectores de otra sede, caducidad, revocación e inexistencia de herencia de grupos.
8. Desplegar por GitHub después de las verificaciones y autorización de los cambios de seguridad. No publicar desde el workspace de respaldo.

## Datos pendientes
El documento original termina cortado en «La Sala de Lí» dentro de los criterios de aceptación. Se puede implementar lo anterior sin inventar el texto faltante. Ningún responsable fue designado todavía para administrar accesos por delegación; no se concederán facultades por defecto.

## Implementación preparada (pendiente de autorización de seguridad)

- Entrada: Equipo → Sectores y accesos, compartida con móvil.
- Configuración del catálogo separada de Autorizaciones y Auditoría de cambios.
- Reutiliza la emisión atómica y las instantáneas existentes. No crea una segunda base de permisos.
- Las facultades de responsables se almacenan en perfil_permisos con módulo personal / acción manage_sector_access. La migración permite ese valor, pero no se lo asigna a nadie. La base exige que todas las sedes de la persona estén dentro de las sedes del responsable.
- El empleado consulta únicamente los permisos vinculados a su perfil mediante una RPC autenticada; conserva la verificación pública por token de credencial.
- El historial nuevo registra autorización, revocación, sustitución del catálogo y cambios del sector. La migración se identifica como operación del sistema; las operaciones desde la aplicación registran auth.uid().
- Toda la migración está en una transacción. No borra sectores, personas ni credenciales. No altera bitacora.registros.
- El PDF impreso es una instantánea: la vigencia efectiva y las revocaciones siempre se comprueban mediante QR.

### SQL sujeto a aprobación

Archivo: supabase/migrations/20261022162846_matriz_sectores_REVIEW.sql.

Incluye GRANT de INSERT/UPDATE sobre el catálogo solo con políticas de administradores activos; SELECT del historial solo para administradores; políticas sobre credenciales para responsables con facultad explícita y ámbito de sede; EXECUTE autenticado para consulta propia y comprobación de facultades. No concede edición de catálogo a responsables ni lectura general a anónimos. La validación pública existente sigue acotada al token QR.

No ejecutar ni desplegar el frontend antes de aplicar el SQL aprobado y verificar el catálogo. El cambio pendiente deja de mostrar como vigentes los permisos sobre sectores antiguos de Planta Córdoba; las credenciales y su historial no se borran. Es necesario asignar individualmente los accesos nuevos y reemitir.

### Validación realizada
- Build de producción aprobado; lint sin errores (dos advertencias preexistentes en EquipoView).
- Suite general: 386 pruebas pasaron; se corrigió la importación React faltante en la nueva prueba visual y se repitieron las 11 pruebas específicas, todas aprobadas.
- Postgres WASM aislado: sustitución del catálogo, preservación de snapshot, permisos admin/delegado/consulta propia/anon, unicidad, ausencia de herencia, caducidad y auditoría aprobados.
- Navegador con API externa bloqueada: matriz de 18 fichas en 1440 y 390 px, sin desborde horizontal. PDF CR80 de dos páginas generado y frente renderizado/revisado.
- No se aplicó el SQL en producción ni se asignaron permisos reales.
