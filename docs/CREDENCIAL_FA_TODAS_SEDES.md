# FA en todas las sedes para Equipo Central

Solicitud del 29/10/2026: permitir asignar FA en todas las sedes a Pablo Augusto Fernandez, Nicolas Abel Luis Vitale, Romina Veronica Rodriguez Gsponer, Debora Noemi Andrea Rodriguez y Emilia Milich.

## Uso previsto

Equipo → persona → Credencial → **FA · Todas las sedes**. Un administrador selecciona responsable autorizante, vencimiento FA y confirma la emisión. Se genera una sola tarjeta CR80 con FA y “Todas las sedes”, conservando el departamento. La impresión A4 usa la misma tarjeta. Escritorio y móvil reutilizan el modal.

La opción no viene marcada. Habilitar a una persona no emite ni modifica su credencial. Reemitir invalida atómicamente la anterior; retirar FA y reemitir, anular/extraviar o revocar la elegibilidad impide el ingreso por el QR anterior. La fecha FA puede ser menor al vencimiento de la tarjeta.

El alcance incluye todas las sedes activas, incluidas las que se activen durante la vigencia. El QR enumera las sedes actuales y separa el permiso FA de los sectores físicos conocidos. No habilita espacios proyectados, en integración o suspendidos, ni sustituye habilitaciones externas/PSA.

## Diagnóstico y persistencia

El flujo anterior restringía autorización y validación a las sedes de pertenencia de la persona; el catálogo de credenciales sólo cubría el piloto Córdoba (21/24). Las cinco personas están en sede 30 o sin sede. Ampliar únicamente el selector no habría cambiado la validación del servidor.

La migración `20261029113000_credencial_fa_todas_sedes_REVIEW.sql` agrega:

- `equipo.credencial_fa_multisede_personas`: cinco IDs verificados en producción, con elegibilidad explícita, sin inferirla del cargo. RLS y SELECT sólo para admin activo; sin escrituras API. Cambios auditados.
- `credenciales_personal.fa_todas_sedes`: false en emisiones anteriores. El trigger exige admin activo, persona habilitada/activa, responsable, confirmación y fecha FA vigente. FA global es excluyente con sectores individuales.
- Actualización de emisión y validación QR, conservando firmas, permisos existentes, política de reemisión e historial. El QR verifica elegibilidad vigente en cada consulta.

No modifica `personas.sede_ids`, roles, documentos, fotografías ni credenciales existentes. El flag sólo se escribe al emitir. El administrador debe elegir el autorizante y vencimiento de cada emisión; no se completan automáticamente.

## Estado operativo

**Migración pendiente de confirmación explícita. No aplicada ni publicada.** La regla AGENTS.md §0.3 exige mostrar SQL antes de aplicar GRANT/RLS. Aplicar exclusivamente en `mixyhfdlzjarvszinytk`, verificar cinco elegibles y emisiones conservadas, y recién después integrar/publicar frontend mediante PR. No desplegar el frontend antes de la migración: necesita consultar la nueva tabla.

## Verificación

- `scripts/verify-credential-fa-global.mjs`: PostgreSQL WASM aislado, cinco elegibles, no elegible rechazado, autorización y fecha obligatorias, expiración, baja de persona, revocación, reemisión, sedes activas nuevas/inactivas, áreas no habilitadas, RLS admin/consultor/anon, auditoría y pertenencia intacta. Se ejecuta junto al control de accesos V1.1 en `npm run check`.
- Pruebas de modal: opción desmarcada, emisión explícita con sede Central preservada y ausencia de opción para no habilitados.
- Prueba QR: FA multisede se diferencia de sectores físicos.
- Prueba PDF/A4: una sola tarjeta, texto Todas las sedes, ficha FA y vencimiento del permiso; preview ficticia en `tmp/fa-global-preview.pdf`.
- No se emitieron credenciales reales para probar.

## Revocación administrativa de elegibilidad

La tabla no permite escrituras desde la API. Un cambio administrativo explícito de `activo=false` sobre una persona retira inmediatamente el FA global en la validación QR, sin borrar el historial. La app permite retirar FA mediante reemisión y anular/extraviar como antes. No hay altas automáticas para nuevos miembros de Central.
