# Relevamiento y maestro de artículos — 2.9.14

## Completar datos faltantes

En la ficha, **Completar datos faltantes** consulta las fuentes externas aun cuando el artículo ya está en el maestro. Muestra valores propuestos agrupados por fuente. **Aplicar datos propuestos** completa únicamente campos vacíos (y empaque «Por confirmar»); todavía es necesario **Guardar artículo**. Se vuelven a comprobar los campos al aplicar para conservar cambios posteriores a la consulta. Contenido y unidad se tratan juntos para no mezclar medidas incompatibles.

Las consultas nuevas interpretan una cantidad explícita simple como «1kg» y una presentación múltiple como «192 u 8 g». En GTIN-14, una cantidad simple no se interpreta automáticamente como contenido individual. No se inventa fabricante. Se traducen categorías conocidas (por ejemplo Sugars → Azúcares) y se limpian prefijos de idioma como «es:». Los campos completos de artículos existentes se conservan y pueden corregirse manualmente.

Precialo se incorpora como catálogo adicional. Su búsqueda pública no encontró el GTIN `17791620187218` aunque la ficha lo incluye. Por eso existe un registro de **referencias verificadas** (actualmente esa ficha), y se puede agregar un enlace `https://precialo.com.ar/p/...` para otros artículos. Esto no representa una búsqueda universal en toda la web. Se lee la ficha actual, se valida que el código exacto figure en sus GTIN o MultipleEan y se extraen los datos estructurados del producto. Si el código no coincide, no se importa. Los códigos asociados se conservan como evidencia, sin convertirlos automáticamente en aliases ni unidades individuales.

Los proveedores de enriquecimiento se consultan en paralelo, con tiempos límite. Los enlaces se restringen al host y ruta pública de fichas; no se siguen redirecciones. Un error de fuente no se presenta como identificación exitosa. La procedencia de todas las propuestas aceptadas se conserva en `product_sources.raw_metadata` y se muestra al reabrir la ficha.

La Fase 1 agrega una migración revisable para catálogo SEPA, códigos relacionados y trazabilidad de consultas. No queda activa hasta aplicar `20260909110000_extend_product_master_phase1_REVIEW.sql` con autorización explícita.

## Uso

Escritorio: **Artículos → Relevamiento de artículos**. Celular: **Más → Relevamiento de artículos** o **Más → Artículos**.

1. Escanear con la cámara o ingresar el código como texto.
2. Se consulta el maestro local. Un artículo conocido se abre sin consultar fuentes externas.
3. Si no existe, se consulta SEPA/Precios Claros mayorista y luego Open Food Facts, Open Products Facts y Open Beauty Facts. Cada fuente tiene límite de tiempo; una caída de SEPA no bloquea las fuentes públicas.
4. Revisar/corregir datos y presentación. Si no se identifica, completar manualmente.
5. Guardar o guardar y escanear siguiente. Si falla el guardado, el formulario permanece abierto.
6. Buscar por código, nombre, marca o categoría en Artículos y abrir la ficha para editar.

EAN-8, UPC-A, EAN-13 y GTIN-14 se conservan como texto. El dígito de control incorrecto requiere revisión explícita de la etiqueta; no se corrige automáticamente. Se reconocen los GTIN equivalentes con ceros a la izquierda sin reemplazar el código original. El lector usa ZXing, cargado al abrir cámara, y funciona sin depender de BarcodeDetector.

Una caja puede registrarse como presentación «caja», 192 unidades contenidas y contenido unitario 8 g. Cuando SEPA informa EAN y DUN-14 válidos en la misma fila, la ficha muestra ambos y, tras la confirmación humana, los vincula al mismo producto con presentaciones separadas. El contenido de un envase no representa existencias.

## Modelo y migración

Migraciones: `supabase/migrations/20260907165101_maestro_articulos.sql` y `supabase/migrations/20260909110000_extend_product_master_phase1_REVIEW.sql`.

Cuatro tablas nuevas en `bitacora`:

| Tabla | Contenido |
|---|---|
| `products` | Nombre, descripción, marca, fabricante, categorías, imagen, ingredientes, alérgenos, nutrición, origen y fechas |
| `product_presentations` | Presentación, contenido unitario, unidad y unidades por caja/bulto |
| `product_barcodes` | Código original de texto, tipo, empaque, vínculo a producto/presentación y clave GTIN equivalente única |
| `product_sources` | Proveedor, enlace, datos originales JSON, fecha de consulta y registro |
| `sepa_products` | Catálogo mayorista importado, EAN, código de bulto y atributos normalizados |
| `barcode_search_log` | Resultado, fuente, duración y usuario de cada búsqueda |

La relación compuesta impide asociar un código a una presentación de otro producto. `guardar_articulo` guarda producto, presentación, código y fuente en una transacción. Serializa por GTIN, rechaza duplicados y comprueba la fecha de actualización para evitar pisar una edición ajena. Ante un alta cuya respuesta se perdió, informa que el artículo ya existe y solicita volver a buscarlo; nunca confirma cambios posteriores que no se guardaron.

`buscar_articulos` pagina 30 productos por vez. `articulos_puede_acceder` comprueba el perfil activo. Las funciones son SECURITY INVOKER y respetan RLS.

## Permisos propuestos

- `admin`, `editor`, `grupo`, `encargado`, `sede`, `deposito`: leer, crear y editar el maestro global.
- `deposito` abre directamente el relevamiento y puede usar el maestro completo de Artículos, incluidas fichas, cálculos por caja/bulto y descarga en Excel; no accede a reportes, compras, alertas, sedes, mantenimiento, flota, calidad, equipo ni administración.
- `consultor`: lectura.
- Perfiles inactivos, anónimos, operarios, flota y mantenimiento: sin acceso al módulo.
- Se conservan las restricciones especiales de navegación de perfiles exclusivos de Calidad, Higiene y Seguridad y Compras. Los tres correos especiales de Calidad/Seguridad también se excluyen en la política del maestro.
- No se concede DELETE. Fuentes permiten lectura e inserción, sin actualización.
- No se cambian políticas de tablas existentes ni se agregan permisos de Storage.

**La migración debe aprobarse antes de ejecutarla en `mixyhfdlzjarvszinytk`.** AGENTS.md §0.3 exige mostrar el SQL y esperar confirmación explícita para GRANT/RLS. No aplicar contra ningún otro proyecto.

## APIs y variables

`POST /api/product-resolver` es una función Vercel de la misma app. Valida la sesión con Supabase y el acceso al módulo antes de llamar fuentes externas. Solo consulta hosts fijos y nunca envía la sesión a esas fuentes. La respuesta no se almacena en caché pública.

Variables ya utilizadas por la aplicación, necesarias también en la función:

- `VITE_SUPABASE_URL`: `https://mixyhfdlzjarvszinytk.supabase.co`.
- `VITE_SUPABASE_ANON_KEY`: clave pública del mismo proyecto.

La app no necesita service-role ni claves pagas nuevas. El importador local sí exige `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` únicamente en el entorno del proceso; nunca se envían al navegador. Antes de escribir, `node scripts/import-sepa.mjs <archivo.zip>` hace una simulación. Después de aplicar la migración, `--apply` reemplaza por dataset los lotes importados.

Adaptadores: `server/productProviders.js`, registro `PRODUCT_PROVIDERS`. Documentación: [Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/ref-cheatsheet/), [Open Products Facts](https://support.openfoodfacts.org/help/en-gb/28-open-products-facts/103-where-can-i-find-the-open-products-facts-api), [ZXing Browser](https://github.com/zxing-js/browser).

Los datos externos conservan su procedencia y atribución ODbL / CC BY-SA. Marca no se interpreta como fabricante y país de venta no se interpreta como origen. Se conserva la etiqueta de cantidad externa como presentación pendiente de revisión. Nutrición se muestra en texto editable con su base, unidades y valores originales conservados además en la fuente JSON. La ficha muestra los 20 registros de procedencia más recientes; el historial completo permanece en la tabla.

Fotos: reutiliza `uploadAdjunto` y el bucket `bitacora-adjuntos`; JPG, PNG o WebP de hasta 8 MB. Si falla la imagen, el artículo ya guardado permanece, se explica el resultado y se puede reintentar. No se avanza al siguiente escaneo hasta terminar.

## Archivos principales

- `src/views/Articulos.jsx`, `.css`: ambas pantallas y ficha.
- `src/components/ProductBarcodeScanner.jsx`: cámara, lectura y limpieza de streams.
- `src/lib/ProductResolver.js`, `productQueries.js`, `productBarcode.js`: resolución, persistencia, validación y GTIN.
- `api/product-resolver.js`, `server/productProviders.js`, `server/sepaProvider.js`: autenticación y cascada de fuentes.
- `scripts/import-sepa.mjs`: importación validada de ZIPs SEPA con ZIPs internos y CSV separados por `|`.
- `src/App.jsx`, `src/components/Sidebar.jsx`, `src/mobile/MobileMas.jsx`, `src/lib/access.js`, `src/lib/navigationRoutes.js`: integración en la app.
- Pruebas en `ProductResolver.test.js`, `productDatabase.test.js`, `productApi.test.js`, `Articulos.test.jsx`.
- Versión, dependencias y Vercel: `package.json`, `package-lock.json`, `src/data/releases.js`, `CHANGELOG.md`, `vercel.json`.

## Verificación y pendientes

Pruebas unitarias, flujo de formulario y SQL con PostgreSQL embebido PGlite: no escriben en producción. Verificación de navegador a 390 y 1440 px, alta/edición/listado con datos ficticios, decodificación EAN-13 real sobre stream simulado y liberación de cámara. Consulta de lectura real a las tres APIs públicas. La verificación con una cámara física Android/iPhone queda como comprobación final de dispositivo; no se simula haberla realizado.

Para activar: aprobar/aplicar migración, comprobar permisos reales y guardado mediante transacción revertida, integrar PR y verificar endpoint más versión en producción. GS1 y fuentes argentinas privadas quedan preparados como nuevos adaptadores; no se integró una API sin acceso o credenciales. El modelo admite varios códigos/presentaciones; esta primera interfaz registra una presentación por artículo relevado y no incluye un editor para fusionar productos o agregar alias manuales.

No se implementaron stock, inventarios, movimientos, depósitos, ubicaciones, lotes, vencimientos ni compras.
