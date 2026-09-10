# Correos y evidencias — piloto

Adaptación del `email-agent` del escritorio. Importa por IMAP, preserva originales
y adjuntos en almacenamiento privado y usa Ollama para sugerir una gestión existente.
La primera versión requiere revisar las asociaciones; no modifica estados de gestión.
No envía respuestas, crea borradores, mueve mensajes ni modifica leído/no leído.

## Estado de entrega

Código preparado y **SQL autorizado y aplicado el 2026-09-10**. Los permisos se
verificaron en la base real con una prueba transaccional revertida. El agente
ya tiene configurada la credencial de Supabase, recuperada de la sesión del usuario
y guardada directamente en `.env` sin mostrarla. El piloto importó dos correos y
tres adjuntos; los cinco archivos se descargaron y verificaron con SHA-256.
Los dos correos quedaron clasificados sin errores, pendientes de revisión y sin
vincular porque no coincidían con las gestiones disponibles. El proceso continuo
local fue iniciado el 2026-09-10 mediante `start-local.ps1`.
El proyecto raíz tiene archivos de configuración borrados y conflictos previos en
`src/views/CAPA.jsx`; el build general no está disponible en este estado.

Acceso en escritorio: **Pendientes → Correos**. Las tarjetas CAPA con código
`FK-GEST-…` incluyen una sección de correos de su gestión. La bandeja también permite
filtrar por gestión vinculada, por lo que no depende de abrir la tarjeta.

## Verificaciones realizadas

- IMAP autenticado en modo lectura con las credenciales existentes, usando
  `c226.ferozo.com:993` y validación TLS completa (2026-09-10).
- `mail.flykitchen.com.ar` resuelve al mismo servidor, pero su nombre no coincide
  con el certificado `*.ferozo.com`. El nuevo agente no admite desactivar TLS.
- Ollama local responde y tiene `llama3.2:latest` instalado.
- Prueba con correo ficticio: Ollama devolvió JSON válido y eligió la gestión
  esperada. El tipo documental requiere validación con ejemplos reales; una
  prueba de conectividad no demuestra precisión suficiente para automatizar.
- Docker Desktop no estaba en ejecución al revisar.

## Activación

1. Completado: `supabase/security/correo_evidencias_REVIEW.sql` aprobado y aplicado
   exclusivamente en `mixyhfdlzjarvszinytk`. No volver a ejecutarlo.
2. Completado: tablas con RLS, acceso exclusivo de Nicolás y bucket privado
   verificados en producción antes de importar datos.
3. Copiar `.env.example` a `.env`. Reutilizar `IMAP_USER` y `IMAP_PASSWORD` del agente
   existente. Configurar `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en este archivo
   privado o en el gestor de secretos del servicio; nunca usar variables `VITE_*`.
4. Ajustar `IMAP_FOLDERS`. Por defecto sólo importa INBOX de los últimos 30 días.
   Para incluir enviados, consultar el nombre real de la carpeta IMAP y añadirlo
   separado por coma. Cambiar el período inicial requiere reiniciar el cursor de
   forma deliberada; los registros persistidos se deduplican por hash.
5. Para ejecución local sin Docker: `OLLAMA_HOST=http://localhost:11434` y
   `STATE_DB=data/sync.sqlite`. Python 3.12 o superior, sin paquetes adicionales.
6. Ejecutar `python agent.py --check`, luego `python agent.py --once` para el piloto.
   Revisar originales y sugerencias antes de habilitar el proceso continuo.
7. Con Docker Desktop iniciado: `docker compose -f compose.yml up -d --build`.
   Hay un volumen persistente para los cursores. La PC debe permanecer encendida
   y Ollama debe ser accesible desde el contenedor. Para detenerlo:
   `docker compose -f compose.yml stop` (conserva los datos).

## Diseño y límites

- Cursor SQLite por servidor, cuenta, buzón, carpeta y UIDVALIDITY; búsqueda por
  UID con BODY.PEEK y carpeta de sólo lectura. Se avanza únicamente después de
  guardar original, adjuntos y registro. Los errores de almacenamiento detienen
  la carpeta para reintentar sin saltar correos. No ejecutes dos instancias con
  volúmenes de estado diferentes para el mismo buzón.
- Hash SHA-256 y UUID determinista por buzón/bytes originales. Dos copias idénticas
  se guardan una vez. Si un servidor altera los bytes de una copia, se conserva
  como evidencia distinta aunque tenga el mismo Message-ID.
- Original completo en EML; cuerpo de consulta limitado a 100.000 caracteres.
  Ollama recibe hasta 12.000 caracteres y los nombres de los adjuntos. **Todavía
  no interpreta PDF, imágenes ni documentos adjuntos.**
- Hasta 12 gestiones candidatas por coincidencias de texto y antecedentes de hilos
  confirmados. Los candidatos y correos se consideran datos no confiables. Sin
  herramientas ejecutables ni acciones de negocio controladas por el modelo.
- La IA sugiere una gestión existente o un título para una gestión nueva. La
  creación automática de gestiones y la vinculación automática quedan para una
  segunda fase, luego de medir aciertos con correos reales.
- Se importan 25 mensajes por carpeta/ciclo y se clasifican 10 por ciclo. Los
  fallos de IA se reintentan dando prioridad a mensajes con menos intentos.
  Un fallo de IA nunca descarta la evidencia ya guardada.
- Límite del bucket: 50 MiB por archivo. Un correo original mayor detiene el avance
  de esa carpeta hasta resolver el límite; no se omite silenciosamente.
- Los originales y metadatos no son editables desde el navegador. Sólo se permite
  cambiar estado/vínculo, con control de edición concurrente e historial.
- La pertenencia al buzón es explícita. Ver una gestión no otorga acceso automático
  al correo operativo. Los accesos adicionales se conceden en una revisión aparte.
- Se importaron los dos primeros correos reales del piloto (tres adjuntos).
- La gramática de Ollama admite sólo IDs de las gestiones candidatas o null;
  evita inventar una gestión cuando ninguna coincide.

Para ejecución continua local en Windows, usar `./start-local.ps1`. Inicia Python
en segundo plano con registros en `data/agent.stderr.log` y PID en `data/agent.pid`.
No configura arranque automático al iniciar Windows. La PC y Ollama deben estar
encendidos. El lanzador reutiliza el cursor del piloto y no repite correos guardados.

Las pruebas del agente (10) y de la bandeja (5) pasaron. La prueba PostgreSQL aislada
verificó acceso de propietario, lector y usuario ajeno, originales privados,
restricción de edición y registro de correcciones. Los componentes nuevos se
compilaron por separado con esbuild. `npm run build` sigue bloqueado por la ausencia
previa de `package.json`; no se resolvieron ni alteraron los conflictos anteriores.

## Pruebas

Desde la raíz del repositorio:

```text
python -m unittest discover -s services/email-agent -v
node node_modules/vitest/vitest.mjs run --config scripts/correos-vitest.config.mjs
node scripts/test-correo-security.mjs
```

La prueba SQL utiliza PostgreSQL en memoria mediante PGlite, no Supabase. Su
dependencia de verificación se instala con:

```text
npm install --prefix .codex-tmp/email-verify @electric-sql/pglite@0.3.14
```

## Revisión de permisos completada

El `AGENTS.md` recuperado de Git (el archivo está borrado en el árbol actual)
establece: «Nunca aplique cambios de GRANT/RLS/políticas de seguridad directo en
la base sin mostrar el SQL al usuario primero y esperar confirmación explícita».
El usuario autorizó el SQL concreto y se aplicó el 2026-09-10. La aprobación
queda registrada en `docs/CORREOS_APROBACION.md`; no hace falta repetirla.
