# Checklist de gran porte aeroportuario

## Estado

Implementación preparada el 2026-11-16. SQL pendiente de aprobación explícita y aplicación en `mixyhfdlzjarvszinytk`. No publicar el frontend antes de aplicar y verificar el SQL.

## Unidades verificadas en producción

| Vehículo | ID existente | Sede | Estado observado |
|---|---|---|---|
| Hyundai JDN192 | 57bd3777-dc2e-4282-b5c7-d4dc4e5e618a | 21 | en_reparacion |
| Hyundai HD 78 Euro III JDN191 | ec3d01cb-8f3f-4d22-a543-ce5308201875 | 21 | en_reparacion |
| Mercedes ATEGO AH213XP | 71660e05-bc42-41ba-98e9-3f5275c0fb72 | 21 | operativo |
| Mercedes ATEGO AH172MY | 04f0921e-903d-407b-a0a7-7e18cc953e7b | 21 | en_reparacion |

Asignación por ID, no por texto de patente. El campo `qr_code` está vacío, pero la app ya genera QR usando `/?scan=activo&id=<UUID>`; se reutiliza exactamente ese formato. No se crean activos ni se cambian patentes, estado o QR en base. No se incluye Lifan AD286IH.

**Corrección explícita del usuario:** estar en reparación no impide completar el control. Guardar tampoco cambia automáticamente el estado de mantenimiento.

## Accesos

- Celular: Checklist → Control de vehículo · Gran porte aeroportuario.
- Escritorio: Flota → Checklist → Gran porte aeroportuario.
- Escaneo: misma URL estable del activo; el login y cambio obligatorio de contraseña se mantienen. El QR no contiene credenciales, datos personales ni una autorización.
- Impresión: Flota → Checklist → Imprimir los 4 QR · A4. PDF en `public/recursos/qr-gran-porte-aeropuertos.pdf`.

## Primera entrega

Dieciséis controles basados en el formulario proporcionado; sin respuestas OK preseleccionadas. Usuario responsable derivado de la sesión en servidor. Fecha de Córdoba en servidor, turno explícito, kilometraje entero no decreciente y combustible obligatorio. NC exige explicación; NA solo en urea, hidráulico, rampa, patas y engrase, con justificación.

Un control por vehículo, fecha calendario de Córdoba y turno. El turno noche no se adjudica automáticamente al día anterior. Reintentos con el mismo ID y contenido devuelven el control guardado. Un ID reutilizado con datos distintos falla. No hay edición ni borrado desde los roles de aplicación.

Hasta cinco fotos seleccionadas por carga, JPG/PNG/WebP de hasta 10 MB, en bucket privado. Subida posterior al guardado; un fallo permite reintentar las fotos pendientes sin duplicar el control. Solo el autor puede subir durante 24 horas; usuarios autorizados por sede pueden consultar mediante URLs firmadas de 5 minutos. No se habilita sobrescritura ni borrado. El máximo de cinco es de interfaz, no cuota por registro en servidor.

El resultado es **Sin novedades / Con novedades**. No constituye habilitación operativa. Incidencias automáticas, matriz de criticidad y liberación por Mantenimiento quedan para la siguiente etapa. El historial está en el propio control y en la ficha/informe del vehículo. La pantalla muestra los últimos 100; el informe obtiene todos.

## SQL a revisar

Archivo exacto: `supabase/security/checklist_aeropuertos_REVIEW.sql`.

- Nueva tabla `mantenimiento.checklists_aeropuerto`, RLS activado y sin acceso directo de anon/authenticated.
- RPC autenticadas de lista, historial y guardado. Solo las cuatro unidades; operario/encargado/sede/mnt_editor limitados por sedes, grupo por grupo, admin/editor/flota con alcance global. Consultor solo lectura.
- Cuentas inactivas y con cambio de clave pendiente sin acceso.
- Bucket nuevo privado y políticas acotadas a él. Políticas restrictivas evitan que permisos amplios preexistentes de Storage expongan estas fotos; otros buckets mantienen su comportamiento.
- Sin cambios en roles, políticas de activos/visitas, sedes, registros, cuentas ni estado de vehículos.

AGENTS.md §0.3 exige mostrar el SQL y esperar confirmación antes de ejecutar GRANT/RLS. La autorización genérica de implementación no reemplaza esa revisión. Después de aprobar: aplicar solo al proyecto indicado, verificar permisos con transacciones de lectura, ejecutar CI y publicar por PR/merge GitHub.

## Verificación

Pruebas Postgres WASM sin conexión a producción: rechazo anon/otra sede/clave pendiente/cuenta inactiva, consultor solo lectura, respuestas inválidas, kilómetros, idempotencia, duplicados, preservación de estado en reparación, fotos privadas frente a políticas amplias y conservación de otros buckets. Pruebas UI: respuestas explícitas, guardado en reparación, rechazo de sede no autorizada y reintento de fotos sin duplicar alta. PDF A4 renderizado e inspeccionado; los cuatro QR decodificados coinciden con las URLs de los activos. Build y lint requeridos antes del merge.
