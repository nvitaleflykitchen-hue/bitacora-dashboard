# HANDOFF_SUMMARY — bitacora-dashboard (Fly Kitchen)

> Punto de entrada de este traspaso. Si solo vas a leer un documento, que sea este — el resto de `docs/` tiene el detalle técnico que respalda cada afirmación de acá. Fecha: 2026-06-17.

## 1. Qué es esto, en 3 líneas

App interna de Fly Kitchen (React + Vite + Supabase, sin backend propio) para gestión operativa de comedores y hospitales: bitácora de novedades, escalamientos, mantenimiento de activos e instalaciones, flota de vehículos, y RRHH básico. Está en uso diario real, no es un prototipo. Vive 100% en Supabase (`mixyhfdlzjarvszinytk`) + Vercel, sin servidor propio salvo 3 Edge Functions puntuales.

## 2. Mapa de la documentación (14 documentos)

| Documento | Para qué lo abrís |
|---|---|
| **AGENTS.md** (raíz, no `docs/`) | Reglas que no podés romper si vas a tocar código o la base con ayuda de una IA. Léelo primero si vas a usar un asistente de IA en este repo. |
| PROJECT_STATUS.md | Foto general: qué hay, qué funciona, qué está roto. |
| ARCHITECTURE.md | Cómo está armado técnicamente, con diagramas. |
| DATABASE.md | Esquema completo de la base, ER diagram, triggers, RLS. |
| SETUP.md | Cómo levantarlo en tu máquina. |
| DEPLOYMENT.md | Cómo se despliega a producción (manual, sin CI/CD). |
| API.md | Edge Functions, RPCs, y las vistas proxy que expone `mantenimiento`/`equipo`. |
| BUSINESS_RULES.md | Reglas de negocio, roles, qué puede ver/hacer cada rol. |
| KNOWN_ISSUES.md | Bugs y huecos de seguridad ya encontrados — no los redescubras. |
| BACKLOG.md | Qué hacer y en qué orden. |
| DECISIONS.md | Por qué se diseñó así, no solo qué se diseñó. |
| TEST_REPORT.md | Estado de testing (no hay) y un hallazgo importante sobre verificación de build — leelo antes de confiar en cualquier "el build pasa". |
| REPOSITORY_AUDIT.md | Higiene del repo: duplicados, residuos, dependencias. |
| .env.example | Plantilla de variables de entorno. |

## 3. Lo más urgente — antes de tocar nada más

Detalle completo y justificación en BACKLOG.md Prioridad 1. Resumen:

1. **Hay una novedad que no se guarda hoy**: la política de inserción de `bitacora.escalamientos` compara roles capitalizados contra roles reales en minúscula — cualquier novedad que dispare un escalamiento automático falla. Fix de una línea de SQL (KNOWN_ISSUES.md §1.2).
2. **`bitacora.perfiles` (la tabla de roles) es editable sin login** — cualquiera puede leer todos los perfiles o, en teoría, escribirse a sí mismo `rol='admin'`. Es el hallazgo de seguridad más serio de todo el paquete (KNOWN_ISSUES.md §1.1).
3. **`bitacora.registros` tiene políticas abiertas que anulan las políticas bien diseñadas que coexisten con ellas** — hoy se puede leer/insertar sin login (KNOWN_ISSUES.md §2.3).
4. **Hay un hilo de trabajo previo, pausado, sin cerrar**: backfill de novedades faltantes de Comedores/Hospitales (en curso/pendiente) y un fix de Escalamientos que no se pudo confirmar si llegó a desplegarse a Vercel (acceso al proyecto Vercel bloqueado por permisos desde esta sesión — confirmar manualmente). Ver PROJECT_STATUS.md §6 y BACKLOG.md ítems 5 y 6.

## 4. Las 3 reglas que más cuestan revertir si se rompen

Versión corta de AGENTS.md §0 — leé el original antes de actuar, esto es solo para no perderlo de vista:

1. Hay **dos proyectos Supabase en la misma organización**: el de este repo es `mixyhfdlzjarvszinytk`. El otro, `hmyzuuujyurvyuusvyzp` ("OCTOPUS COQUINARIA"), es de otro cliente — nunca ejecutar nada ahí.
2. `bitacora.registros` es append-only a propósito (dos triggers bloquean el `DELETE`). No es un bug, es la regla.
3. Ningún cambio de `GRANT`/RLS se aplica directo — siempre se muestra el SQL primero y se espera confirmación explícita. Es política del proyecto, no una preferencia de quien lo documentó.

## 5. Qué tan confiable es esta documentación

- Todo lo afirmado en PROJECT_STATUS.md, ARCHITECTURE.md, DATABASE.md, API.md, BUSINESS_RULES.md y KNOWN_ISSUES.md se verificó contra el código fuente y/o el proyecto Supabase real en esta sesión (consultas SQL directas, lectura de archivos, `list_edge_functions`, etc.), no contra memoria de conversaciones previas.
- DECISIONS.md combina verificación directa con una fuente secundaria (`BITACORA.MD.docx`, notas de una sesión previa) — cada afirmación indica de cuál de las dos viene.
- **Limitación encontrada en esta sesión, importante**: el entorno usado para intentar correr `npm run build` demostró ser capaz de leer versiones truncadas/corruptas de algunos archivos fuente sin reportar error (3 casos confirmados y corregidos manualmente: `App.jsx`, `auth.jsx`, `DashboardGlobal.jsx` — los tres resultaron estar bien en el repositorio real). Esto no es evidencia de que el proyecto esté roto, pero significa que **no se pudo certificar un build 100% limpio de punta a punta desde esta sesión**. Detalle completo en TEST_REPORT.md §2. Recomendación concreta: correr `npm install && npm run build` en una máquina normal antes de cualquier deploy que dependa de esa confirmación.
- Nada en este paquete reemplaza una revisión humana antes de aplicar cambios de seguridad — eso es, de hecho, una decisión de diseño explícita del propio proyecto (DECISIONS.md §2.5), no algo que se esté inventando ahora.

## 6. Primeros pasos sugeridos para quien continúe

1. Leer AGENTS.md y PROJECT_STATUS.md completos (15 minutos).
2. Confirmar con el equipo las 5 preguntas abiertas de BACKLOG.md (estado del corte de Google Form, del onboarding de operadores, de la sesión de Vercel CLI, de las env vars en el dashboard de Vercel, y de si existe o se quiere un entorno de prueba separado).
3. Decidir si los fixes de Prioridad 1 de BACKLOG.md se aplican ya o se programan — son todos de bajo esfuerzo técnico, el costo real es la decisión y la confirmación, no el código.
4. Confirmar manualmente con `npm install && npm run build` el estado real del build antes de cualquier deploy (ver §5).
5. Retomar o cerrar formalmente el hilo de backfill de novedades (BACKLOG.md ítem 6) — es trabajo de negocio pendiente, no solo deuda técnica.
