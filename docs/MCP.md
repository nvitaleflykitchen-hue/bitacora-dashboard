# Conector MCP de Fly Gestión

`api/mcp.js` expone `/api/mcp` como función Node del proyecto Vite existente. Usa el SDK oficial MCP con Streamable HTTP sin sesiones y respuestas JSON. POST soporta initialize, notifications/initialized, tools/list y tools/call. GET y DELETE devuelven 405 deliberadamente: no hay stream SSE independiente ni sesiones que eliminar. No requiere Next.js.

## Configuración y alcance

Variables exclusivamente del servidor (ver `.env.example`):

- `SUPABASE_URL`: obligatoriamente `https://mixyhfdlzjarvszinytk.supabase.co`.
- `SUPABASE_SECRET_KEY`: secret key de backend de ese proyecto. Nunca compartirla con Gemini.
- `MCP_AUTH_TOKEN`: secreto aleatorio independiente de al menos 32 caracteres; el cliente envía `Authorization: Bearer <token>`.
- `MCP_ALLOWED_SEDE_IDS`: IDs de sedes permitidas separados por coma. Obligatorio; no existe acceso implícito a todas las sedes.
- `MCP_PUBLIC_URL`: URL canónica completa, local `http://127.0.0.1:3001/api/mcp`, remota HTTPS. Host y Origin deben coincidir; clientes sin Origin son admitidos.

El token estático representa una integración de servicio, no la sesión de un usuario de Fly Gestión. Sus consumidores comparten el alcance configurado. La clave de backend omite RLS, por eso cada consulta filtra sedes en el servidor. No se exponen SQL libre, escrituras, URLs firmadas, emails ni claves. Las descripciones/observaciones pueden contener información interna: compartir el token solo con conectores autorizados. Rotar `MCP_AUTH_TOKEN` revoca ese acceso estático. Gemini web usa el flujo OAuth descrito abajo, no este token ni la clave Supabase.

## Herramientas y fuentes verificadas

Todas aceptan `escala_id` opcional, `desde`/`hasta` ISO `YYYY-MM-DD`, `limite` 1–50 (20 por defecto) y `offset` 0–10000. Devuelven `has_more` y `next_offset`; textos de más de 4000 caracteres se marcan truncados. Las fechas finales son inclusivas; timestamps se filtran en UTC. Los registros se ordenan descendentes por fecha e ID. Cada consulta tiene timeout de 10 segundos.

| Herramienta | Fuente / filtros adicionales |
|---|---|
| `get_auditorias` | `bitacora.auditorias_internas`. `estado`: Borrador, Programada, En curso, Finalizada, Cerrada, Cancelada. `campo_fecha`: fecha_auditoria (default) o fecha_programada. Incluye origen, resultado, puntajes y conclusiones. |
| `get_capa_acciones` | `bitacora.capa`, tipos Correctiva/Preventiva. `estado`: Pendiente → Pendiente; En curso → En ejecución; Cerrado → Completada o Verificada. Conserva estado original y eficacia_verificada. `auditoria_codigo` filtra plan; junto con sede_id identifica su vínculo a `capa_planes`. Fechas por created_at. |
| `get_registros_temperatura` | No existe tabla de mediciones térmicas por cámara. Devuelve **novedades textuales** de `bitacora.registros`, categoría B, sin inventar grados ni cumplimiento térmico. `sector` y `camara` buscan texto literal en detalle_b; ambos filtros se combinan. Sin desde consulta últimos 30 días. |
| `get_checklists` | `bitacora.checklists`, `tipo`: apertura/cierre. `periodo`: diario/semanal agrupa envíos observados; semana desde lunes. Porcentaje sobre ítems válidos de la página, no sobre envíos esperados. Sin datos devuelve resumen vacío, nunca 100% automático. |

Inspección de solo lectura del esquema real: 2026-10-22. `capa_planes.estado` admite activo/obsoleto, no los estados de acciones. `checklists.tipo` admite únicamente apertura/cierre, aunque el frontend también define plantillas de limpieza semanales. No hay cronograma esperado para calcular omisiones. `id_pruebas.temperatura` corresponde a I+D y no se usa como registro térmico operativo. Ninguna migración, GRANT o política RLS se modifica.

## Prueba local en PowerShell

Node 22 o posterior. Desde la raíz de esta rama:

```powershell
npm ci
npm run test:mcp
Copy-Item .env.example .env.mcp.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
notepad .env.mcp.local
```

Completar la clave de Supabase, pegar el token generado y configurar IDs reales autorizados. `.env.mcp.local` está ignorado por Git. Mantener `MCP_PUBLIC_URL=http://127.0.0.1:3001/api/mcp`.

```powershell
npm run mcp:dev
```

En otra terminal, mismo directorio:

```powershell
npm run mcp:smoke
```

El smoke realiza initialize, tools/list y una consulta limitada a un registro por herramienta. Esperado: `initialize OK`, cuatro nombres de herramientas y cuatro `OK`. Usa datos reales **solo lectura**, sin imprimirlos. Las pruebas `test:mcp` usan HTTP local + SDK real + respuestas Supabase simuladas, sin acceder a producción. `npm run dev` inicia la SPA, no la función MCP; usar el runner anterior para este endpoint.

## Gemini web: OAuth con consentimiento

El servidor implementa OAuth Authorization Code + PKCE S256 usando los handlers del SDK MCP, discovery, registro dinámico de clientes, renovación y revocación. La pantalla `/mcp/connect` requiere iniciar sesión en Fly Gestión y autorizar explícitamente. El callback se obtiene del registro del cliente: no se inventa ni se codifica una URL de retorno de Google. La pantalla muestra el dominio de retorno y las sedes; el nombre del cliente no constituye identidad verificada.

Los tokens entregados a Gemini son opacos y exclusivos de este MCP, **no** JWTs de Supabase ni sesiones reutilizables contra otras APIs. Se guardan únicamente hashes SHA-256 de códigos y tokens; metadatos/secretos de clientes se cifran con AES-256-GCM. Códigos: 2 minutos, un solo uso; acceso: 15 minutos; autorización: máximo absoluto de 30 días con refresh rotativo. Una renovación invalida el token de acceso anterior. La revocación invalida toda la autorización asociada. Las operaciones condicionales de Postgres evitan reutilización concurrente entre instancias serverless.

Configuración pendiente de producción:

1. Revisar y autorizar explícitamente [mcp-oauth-setup.sql](./mcp-oauth-setup.sql) conforme a AGENTS.md §0.3; luego aplicarlo solo en `mixyhfdlzjarvszinytk`. Crea dos tablas de estado, habilita RLS, bloquea anon/authenticated y da acceso únicamente a service_role. No toca políticas ni filas de negocio. No está aplicado automáticamente.
2. Configurar las cinco variables base y `MCP_OAUTH_ENABLED=true`, `MCP_OAUTH_OWNER_IDS` (UUID Auth del usuario administrador que vinculará Gemini) y `MCP_OAUTH_ENCRYPTION_KEY` (32 bytes aleatorios en base64). El listado de propietarios es independiente de perfiles editables o user_metadata. Todos los propietarios configurados pueden autorizar las sedes de `MCP_ALLOWED_SEDE_IDS`; inicialmente configurar solo al administrador solicitante.
3. Generar la clave de cifrado con `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` y guardarla como secreto del servidor. Rotarla invalida los registros de clientes anteriores. No colocar secretos en GitHub, parámetros URL ni formularios Gemini.
4. Integrar el PR mediante GitHub y verificar discovery en `https://<dominio>/.well-known/oauth-authorization-server` y `https://<dominio>/.well-known/oauth-protected-resource/api/mcp`. El endpoint sin token responde 401 con `WWW-Authenticate` apuntando al discovery.
5. En Gemini → Conectores → Personalizada, ingresar `https://<dominio>/api/mcp`, dejar vacíos ID/secreto manuales (se usa registro dinámico), continuar, iniciar sesión en Fly Gestión y aceptar el consentimiento. Comprobar una consulta real desde Gemini.

No necesita activar Supabase OAuth Server: la identidad existente solo verifica quién aprueba la conexión; nunca se entrega su sesión a Gemini. Las tablas OAuth almacenan el mínimo necesario para funcionar en varias instancias. El límite de registro dinámico es 100 clientes por día más el rate limit por instancia del SDK; para un endpoint público de alto tráfico se recomienda añadir límite global de plataforma. Limpiar periódicamente autorizaciones vencidas y clientes sin uso mediante mantenimiento autorizado.

`npm run test:mcp` incluye un flujo OAuth HTTP completo con Supabase simulado y una prueba SQL en Postgres embebido (PGlite), sin escrituras en producción. La pantalla de consentimiento tiene pruebas de aprobación explícita y manejo de errores. El runner local permite probar discovery y tokens; para la pantalla React completa, usar un proxy local del mismo origen o el preview de GitHub con las variables correspondientes.

Referencia de la interfaz web: [conectar apps personalizadas en Gemini](https://support.google.com/gemini/answer/17209137).

## Gemini CLI

Gemini CLI admite conectores Streamable HTTP con `httpUrl` y headers. En su configuración `settings.json`:

```json
{
  "mcpServers": {
    "fly-gestion": {
      "httpUrl": "http://127.0.0.1:3001/api/mcp",
      "headers": { "Authorization": "Bearer ${MCP_AUTH_TOKEN}" },
      "includeTools": ["get_auditorias", "get_capa_acciones", "get_registros_temperatura", "get_checklists"]
    }
  }
}
```

Definir `MCP_AUTH_TOKEN` en el entorno del proceso Gemini (no se lee automáticamente desde este repo). Cambiar `httpUrl` por la URL HTTPS publicada para acceso remoto. Esta configuración corresponde a Gemini CLI; no garantiza que cualquier interfaz web de Gemini acepte conectores arbitrarios o autenticación Bearer.

Documentación oficial: [SDK MCP](https://ts.sdk.modelcontextprotocol.io/server), [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/).

## Publicación

El flujo del proyecto es **GitHub: rama → PR → checks → integración en main**. No ejecutar Vercel CLI desde este workspace. Antes de integrar, configurar las cinco variables de servidor en el entorno de hosting mediante el canal autorizado, con `MCP_PUBLIC_URL` HTTPS de producción. La función falla con 503 si faltan variables. `vercel.json` conserva el rewrite `/api/*` anterior al fallback de la SPA y configura 60 segundos para MCP. Repetir el smoke contra la URL remota después de publicar. El endpoint no puede verificarse en Gemini remoto antes de disponer de esa URL y credenciales configuradas.
