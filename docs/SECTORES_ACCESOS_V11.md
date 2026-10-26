# Sectores y accesos V1.1 — piloto Córdoba

Estado: SQL autorizado y aplicado el 26/10/2026 en mixyhfdlzjarvszinytk; frontend en PR #176. Fuente: FLY_GESTION_Proyecto_Definitivo_Sectores_y_Accesos_V1.1.pdf (22/10/2026). El usuario confirmó el 23/10/2026 usar Ae, Pp y Da también en Aeropuerto de Córdoba.

## Alcance

- Planta de Producción Córdoba (24): 19 sectores físicos, exactamente 6 restringidos (Li, Pp, Ci, Ge, Ae, Da).
- Aeropuerto de Córdoba (21): Ae, Pp y Da, con IDs y permisos independientes de Planta.
- FA es de tipo `permiso`, no `sector`: se reutiliza el catálogo actual con un discriminador para evitar un sistema paralelo. No se cuenta entre los 19/3 espacios físicos.
- Negro y rojo en fichas de sectores/FA; departamentos y diseño corporativo conservados. Tarjetas CR80, dos caras por sede y A4 siguen usando las mismas funciones.
- Selección manual. Responsable nominal, motivo, ejecutor autenticado, fecha de emisión y vigencia de FA obligatorios. El cargo o departamento no conceden accesos.
- FA por sede se revoca retirándolo y reemitiendo; la emisión anterior se invalida atómicamente. Anular/extraviar invalida toda la credencial. Las instantáneas de emisiones anteriores y sus autorizaciones son inmutables.
- QR enumera únicamente sectores físicos con permiso vigente, sede activa, pertenencia actual del empleado y estado habilitado. Expande FA sólo dentro de su sede, incluidas áreas restringidas habilitadas. Un FA vencido no da acceso.
- La habilitación de áreas futuras necesita acta documentada. Pp y Ae arrancan sin ingreso (reconversión/integración); Da proyectado. Esto también aplica al trío del aeropuerto hasta confirmar su puesta en servicio. Los otros 16 espacios existentes de Planta arrancan habilitados.

## Historial real

La lectura de producción del 23/10 encontró seis credenciales con sectores. El PDF dice que no existe historial; ese supuesto no coincide con la base. No se borran esas emisiones ni se convierten sus permisos. Los códigos anteriores se desactivan: sus QR ya no mostrarán esos sectores como autorizados. Se requiere asignación nominal y reemisión con la matriz nueva. No se concede FA a nadie durante la migración.

## SQL para aprobación

Archivo: `supabase/migrations/20261023223632_sectores_accesos_v11_cordoba.sql`.

Incluye la carga de catálogo, columnas de estado físico y autorización, reglas de emisión y QR, y tabla de auditoría con RLS. La auditoría permite SELECT sólo a administradores activos; no permite escritura directa de anon/authenticated. Triggers privados registran cambios. No altera reportes ni auditorías de calidad. Aprobación explícita recibida y SQL aplicado el 26/10/2026 conforme AGENTS.md §0.3. No volver a ejecutar.

Orden de activación: aprobar SQL completo; aplicarlo únicamente en mixyhfdlzjarvszinytk; verificar catálogo/funciones/permisos; checks GitHub aprobados y merge de PR; verificar URL pública. No fusionar el frontend antes del SQL porque consulta columnas nuevas. No usar CLI/panel/MCP de Vercel para publicar.

## Verificación

- `npm run check`: lint, 386 pruebas Vitest, integración SQL V1.1, seis pruebas MCP y build.
- `npm run test:accesos`: PostgreSQL WASM efímero; valida 19+3, seis rojos, FA excluyente por sede, pertenencia de persona, vencimiento FA, proyección/suspensión, exigencia de acta, revocación, inmutabilidad y auditoría admin/consultor/anon.
- UI de credencial y PDF revisados con datos ficticios, incluyendo 19 fichas y FA. PDF CR80 de cuatro páginas generado con las funciones reales y renderizado para inspección. No se emitieron credenciales reales.
- Verificación posterior del SQL: 188 credenciales conservadas; Planta 19 sectores (seis restringidos, 16 habilitados), Aeropuerto tres restringidos pendientes de habilitación; un permiso FA por sede sin asignación nominal automática. Auditoría con RLS y SELECT exclusivo de admin activo.
- Ajuste solicitado el 26/10: FA es una ficha cuadrada de 48 px como una selección individual, sin estirarse al ancho de la banda; mismo cálculo para pantalla y PDF.
- Escritorio y mobile reutilizan CredencialPersonalModal; QR público y generación A4 reutilizan la misma lógica. No cambia el acceso al sistema ni los roles de perfiles.
