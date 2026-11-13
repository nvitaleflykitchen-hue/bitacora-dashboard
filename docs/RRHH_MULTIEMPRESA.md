# RRHH multiempresa — primera etapa

Estado: implementado para revisión. La migración `20261113090000_rrhh_empresas_REVIEW.sql` requiere autorización explícita antes de aplicarse en `mixyhfdlzjarvszinytk`. No ejecutar en ningún otro proyecto.

## Decisiones confirmadas

- Fly Gestión es la plataforma. Empresas: FlyKitchen, Servicios Drill y Tempura (nombre editable).
- Un único equipo central administra las tres; cada colaborador tiene una sola empresa actual.
- Drill y Tempura se habilitan únicamente en RRHH.
- FlyKitchen conserva las fichas operativas, sedes, grupos, IDs y herramientas actuales.

## Entrega

- Acceso «Empresas · RRHH» desde Equipo, escritorio y móvil. La entrada habitual sigue siendo FlyKitchen y sus columnas de sedes identifican la empresa.
- Selector por empresa / consolidado; búsqueda por nombre, DNI, legajo o puesto; filtro de unidad y estado; exportación CSV con empresa y unidad.
- Drill y Tempura: altas y edición de legajo básico, empresa empleadora, unidad, datos de contacto, fecha de ingreso, estado y motivo del cambio.
- Unidades de RRHH independientes de `bitacora.sedes`: se crea Cao en Tempura. Las unidades de Drill se cargan desde la pantalla; no se inventan sedes.
- Nombre visible de Drill/Tempura editable por administrador sin cambiar sus identificadores.
- Historial inalterable desde la aplicación. Cambio entre Drill y Tempura fechado y con motivo. Validación de un único DNI y de unidad perteneciente a la empresa.
- Administradores activos con contraseña actualizada tienen acceso central, como con RRHH privado actual. Un administrador puede habilitar/revocar editores de RRHH mediante membresía exclusiva de este módulo. No se cambian roles ni correos de acceso.

## Separación de datos

Las tablas nuevas están en `equipo` con prefijo `rrhh_`; ninguna consulta operativa anterior incorpora sus colaboradores o unidades. El consolidado une en la aplicación el padrón existente FlyKitchen (con sus permisos actuales) y los nuevos legajos. No copia personas existentes ni crea usuarios o credenciales.

La única integración de escritura con el padrón anterior es un trigger contra DNI duplicado entre los dos registros. No actualiza filas existentes y no cambia sus políticas. Se bloquea por DNI durante la transacción para evitar altas cruzadas concurrentes. Las validaciones y las claves foráneas se ejecutan en el servidor, no sólo en el formulario.

Las tablas nuevas tienen RLS, sin acceso anónimo. Sólo el equipo central puede consultar/gestionar legajos y unidades; únicamente administradores gestionan membresías y nombres de empresa. Nadie desde la aplicación puede eliminar colaboradores o reescribir auditoría; se usa el estado inactivo. Todas las acciones modificatorias generan auditoría. Las únicas funciones `SECURITY DEFINER` son triggers no ejecutables desde la API para auditoría y control del DNI entre padrones.

## Límites deliberados de esta etapa

Las herramientas avanzadas existentes (evaluaciones, licencias, liquidaciones, formularios, fotografías, credenciales y novedades) siguen operando con FlyKitchen. Esta entrega agrega la base de empresas/unidades/legajos; todavía no habilita esas herramientas para Drill y Tempura. No cambia sus marcas ni genera documentos con logo FlyKitchen para las nuevas empresas.

Un traslado desde o hacia FlyKitchen no se automatiza en esta etapa: requiere resolver primero las dependencias del legajo operativo (credenciales, accesos, evaluaciones e históricos). No se permite crear un segundo legajo con el mismo DNI como atajo. Los traslados entre Drill y Tempura sí quedan registrados en el mismo legajo.

## Activación

1. Revisar y aprobar el SQL completo, incluidos RLS/GRANT y trigger de DNI.
2. Aplicar la migración en el proyecto correcto y verificar tablas/políticas/semillas.
3. Integrar el PR con checks aprobados y verificar publicación por GitHub y URL pública.
4. Desde «Equipo de RRHH», un administrador habilita a los editores del equipo. No se asignan personas por suposiciones sobre sus nombres.

Validación: base PGlite aislada con roles admin/editor/anónimo/inactivo, restricciones entre empresas, unicidad de DNI, auditabilidad, revocación y conservación de tablas operativas; pruebas de componentes, filtros, escritura con revisión optimista y navegación existente.
