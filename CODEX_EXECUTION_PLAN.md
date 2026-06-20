# CODEX EXECUTION PLAN

## Principio de ejecución

No iniciar trabajo funcional nuevo hasta cerrar la falla operativa de escalamientos y acordar el tratamiento de los permisos críticos. Todo cambio de GRANT/RLS/policy debe presentarse primero como SQL revisable y requiere autorización explícita antes de ejecutarse.

## Primera tarea recomendada — única

**Preparar para revisión el SQL mínimo que corrige `bitacora.escalamientos.staff_insert_esc` para usar los roles válidos en minúscula, junto con una prueba transaccional `BEGIN ... ROLLBACK`; no aplicarlo todavía.**

Razón: es una rotura funcional activa documentada que puede impedir guardar novedades completas, tiene un cambio acotado y verificable, y permite establecer el flujo seguro de revisión/aprobación antes de abordar el rediseño más amplio de RLS.

Criterios de aceptación de esa tarea futura:

- El SQL identifica explícitamente el proyecto permitido `mixyhfdlzjarvszinytk`.
- No contiene operaciones contra `hmyzuuujyurvyuusvyzp`.
- Usa exclusivamente roles válidos en minúscula.
- Incluye consulta previa de la policy, SQL propuesto, efecto esperado, rollback conceptual y prueba dentro de transacción.
- El usuario ve y aprueba el SQL antes de cualquier ejecución.
- La prueba demuestra que un alta con `requiere_escalamiento = true` crea el escalamiento sin persistir datos de prueba.
- Después de autorización y aplicación, se verifica el flujo desktop y mobile sin borrar filas de `bitacora.registros`.

## Secuencia posterior priorizada

### P0 — Seguridad y operación

1. Diseñar el cierre de `bitacora.perfiles` sin romper el autoaprovisionamiento. Separar lectura propia, administración y protección de columnas privilegiadas.
2. Retirar las políticas amplias de `bitacora.registros` después de demostrar que las políticas acotadas cubren todos los roles y flujos reales.
3. Corregir el acceso fail-open de `auth.jsx` y verificar alcance por rol/sede en desktop y mobile.
4. Corregir las consultas de `SedeFicha.jsx` a las vistas `public.mnt_*`.
5. Identificar al consumidor de `bitacora-ingest` y diseñar autenticación antes de cambiar el endpoint.

### P1 — Modelo de permisos

1. Confirmar en Dashboard qué esquemas expone PostgREST.
2. Construir una matriz rol × tabla × operación × sede para `bitacora`, `mantenimiento`, `equipo`, vistas y Storage.
3. Diseñar RLS para las cinco tablas de RRHH y las cuatro tablas de mantenimiento documentadas sin protección.
4. Auditar cada vista desktop/mobile para comprobar que propaga `allowedSedeIds`; tratar el frontend como UX, no como barrera de seguridad.
5. Revisar vistas con privilegios y funciones `SECURITY DEFINER`, incluyendo `search_path`, grants y ejecutabilidad.

### P2 — Trazabilidad y calidad

1. Crear un backup verificable y luego inicializar Git; no usar la copia anidada como respaldo.
2. Exportar y versionar migraciones y las tres Edge Functions.
3. Incorporar CI con instalación reproducible, build, lint y tests mínimos.
4. Agregar smoke tests para login, alta de novedad, escalamiento, permisos por sede y vistas críticas.
5. Definir una estrategia de dependencias y resolver advisories de Vite/esbuild en una tarea separada, con pruebas de regresión; no actualizar incidentalmente.

### P3 — Higiene y rendimiento

1. Con respaldo/versionado ya disponibles, retirar copia anidada y artefactos obsoletos.
2. Cambiar la estrategia de build para evitar residuos en `dist` y activar limpieza controlada.
3. Dividir el bundle con imports dinámicos por módulo y medir impacto real.
4. Evaluar la división de archivos mayores sin mezclarla con cambios funcionales.

## Gates obligatorios para cualquier implementación

- Confirmar siempre project ref exacto antes de una acción Supabase.
- Mostrar SQL de permisos y esperar aprobación explícita.
- No probar con datos persistentes; usar staging futuro o transacciones con rollback.
- Verificar desktop y mobile cuando compartan regla de negocio.
- Ejecutar build y controles automatizados disponibles.
- No hacer deploy directo a producción sin checklist, respaldo, revisión y aprobación.
