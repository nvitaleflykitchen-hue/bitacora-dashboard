# QR público de comedores — preparado, pendiente de activación

## Uso
En Sedes, ficha de la sede, abrir **QR del comedor · novedades de clientes** (administrador). Cargar los nombres y teléfonos internacionales que se autoriza mostrar a clientes para Coordinación y Gerencia. Activar, guardar y descargar el cartel A4. El enlace es permanente; editar contactos no reemplaza el token. Desactivar impide consultar y enviar desde el QR.

Al escanear, se abre una pantalla para celular sin login. Muestra únicamente nombre del comedor y los dos contactos publicados. Solicita nombre del remitente, empresa/función y contacto opcionales; permite seleccionar uno o varios de los ocho temas operativos y detallar cada novedad. Devuelve referencia COM-000001. El contacto directo abre WhatsApp o llamada por decisión del visitante; no envía mensajes automáticamente.

Los reportes están en esa ficha, sección **Novedades externas recibidas**, con fecha/hora, remitente, contacto y detalles por tema. Se distinguen de los registros internos; esta versión no crea tickets ni escalamientos automáticos. No admite adjuntos ni seguimiento público. La identidad declarada no se verifica: son reportes externos, no una sesión de usuario.

## Activación pendiente
1. Aprobar y ejecutar el SQL exacto de `sql_comedor_publico.sql` únicamente en `mixyhfdlzjarvszinytk`.
2. Desplegar la función `comedor-publico` con `verify_jwt=false`: info y submit son públicos; config/save/reports validan sesión y perfil admin activo dentro de la función.
3. Publicar el frontend mediante PR GitHub, checks y merge. Verificar el enlace público, el envío y la visualización interna.
4. Configurar los contactos confirmados para las sedes que se incluirán. No inferir que un teléfono interno es público.

## Alcance del SQL para aprobar
Dos tablas nuevas (`comedor_qr`, `comedor_novedades`), índices y una función invoker. Activa RLS y revoca acceso directo de anon/authenticated/PUBLIC a estos objetos nuevos. Solo service_role consulta/escribe mediante la función Edge. No toca políticas, permisos ni filas de tablas existentes; las nuevas tablas referencian `sedes`. No borra ni modifica `registros`.

La recepción valida el QR activo y sede activa, aplica límite de diez envíos por diez minutos por identificador de IP con hash salado, serializa el límite y evita duplicación al reintentar el mismo request_id. No guarda la IP en claro. No expone la lista de sedes, directorio interno, perfiles ni historial a visitantes. Un QR pegado en un comedor puede fotografiarse y compartirse; no acredita que el remitente sea supervisor.

## Validación local
- Pruebas React: selección de varios temas, reintento idempotente, QR inválido y envío sin temas.
- `node scripts/verify-comedor-qr.mjs`: Postgres local en memoria; permisos anónimos, idempotencia, temas, límite y desactivación. Sin escrituras de prueba en producción.
- Build de producción.
