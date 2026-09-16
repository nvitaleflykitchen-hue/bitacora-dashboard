# Artículos, inventario y Kiosco — diagnóstico y arquitectura propuesta

Fecha del relevamiento: 2026-09-16  
Versión de la aplicación: 2.9.14  
Proyecto Supabase verificado: `mixyhfdlzjarvszinytk` (`cerdova-db`)

Este documento cubre las fases 1 y 2. No aplica migraciones ni modifica datos.

## 1. Diagnóstico del módulo actual

### Aplicación

- `src/views/Articulos.jsx` ya funciona como maestro y relevamiento de productos en escritorio y móvil.
- Permite escanear EAN-8, UPC-A, EAN-13 y GTIN-14, buscar manualmente, crear o editar fichas, subir imagen y consultar fuentes externas.
- `src/lib/productQueries.js` centraliza búsqueda, guardado, exportación y enriquecimiento.
- El guardado usa el RPC `bitacora.guardar_articulo` y controla edición concurrente mediante `expected_updated_at`.
- El acceso está integrado en `src/lib/access.js`. El rol `deposito` tiene una experiencia específica y es el candidato natural para la operación diaria de reposición/caja.
- Existen pruebas de interfaz y de SQL con PGlite para duplicados, equivalencias de códigos, concurrencia de edición y permisos de lectura/escritura.

### Base de datos real

El maestro actual está normalizado y debe reutilizarse:

| Entidad | Uso actual | Filas al 2026-09-16 |
|---|---|---:|
| `bitacora.products` | identidad y datos comerciales/sanitarios | 4 |
| `bitacora.product_presentations` | presentación y contenido | 7 |
| `bitacora.product_barcodes` | múltiples códigos por producto/presentación | 7 |
| `bitacora.product_sources` | procedencia y trazabilidad de datos | 4 |

Los códigos ya tienen índices únicos por valor original y por `gtin_key`, por lo que la búsqueda para venta puede ser inmediata sin crear otro catálogo.

No existen tablas comerciales de stock, reposiciones, relevamientos, ventas, detalle de venta ni pagos. El stock encontrado en `mantenimiento.insumos` pertenece al inventario técnico de mantenimiento y no debe mezclarse con el Kiosco.

Las tablas del maestro tienen RLS activa, no permiten acceso anónimo ni borrado y usan la función `bitacora.articulos_puede_acceder`. Los cambios nuevos deberán conservar ese patrón, con permisos por sede más estrictos para operaciones económicas.

### Brechas respecto del objetivo

- Falta código interno de producto.
- Falta definir una unidad base de inventario y el factor de conversión de cada presentación.
- Faltan precio de venta, costo de referencia y mínimos por sede.
- Falta un libro inmutable de movimientos y un saldo teórico por producto/sede.
- Faltan operaciones históricas de reposición y relevamiento.
- Faltan ventas, líneas, pagos, comprobante interno y anulaciones.
- `deposito` actualmente queda con alcance de sedes vacío en `auth.jsx`; debe respetar `perfiles.sede_ids` para poder operar únicamente los puntos asignados.
- El código y la base real admiten diez roles, incluidos `deposito` y `mnt_editor`. La arquitectura se adapta a esa realidad y no altera el catálogo de roles en este trabajo.

## 2. Decisiones de diseño

1. `products`, `product_presentations` y `product_barcodes` siguen siendo la única fuente del maestro. No se crean `articles` ni catálogos paralelos.
2. El stock se controla siempre por `sede_id + product_id + presentation_id`, expresado en la unidad base del producto. Una caja, pack o unidad escaneada consume o ingresa el factor definido en su presentación. Nunca existe un saldo global que mezcle sedes.
3. El saldo actual se conserva como proyección rápida, pero ningún usuario ni formulario puede editarlo. Solo lo modifican RPC transaccionales que también insertan el movimiento correspondiente.
4. El libro de movimientos es append-only. No tendrá permisos `UPDATE` ni `DELETE` para usuarios autenticados.
5. Los precios se asocian a presentación y sede. Una venta guarda una copia del precio aplicado; cambiar un precio futuro no altera ventas históricas.
6. Costos y cantidades de reposición quedan copiados en sus líneas históricas. Actualizar el costo de referencia es opcional y ocurre dentro de la misma transacción.
7. Se bloquea una venta si no hay stock suficiente. No habrá excepción administrativa que produzca stock negativo; la corrección se hace por reposición o relevamiento trazable.
8. Todas las confirmaciones usan una clave de idempotencia para que un doble clic o reintento de red no duplique ventas, cobros ni movimientos.
9. Los artículos y operaciones se dan de baja lógicamente. Las ventas completadas, pagos y movimientos nunca se eliminan.

## 3. Modelo de datos propuesto

### Ampliaciones compatibles

**`bitacora.products`**

- `internal_code text`: único, generado para los cuatro registros existentes y para los nuevos.
- `stock_unit text`: unidad base de inventario, inicialmente `unidad`.
- Se conserva `status` (`pending`, `verified`, `inactive`) como estado activo/inactivo del maestro.

**`bitacora.product_presentations`**

- `stock_factor numeric`: unidades base que representa una unidad de esa presentación; por ejemplo, sobre = 1 y caja de 192 sobres = 192.
- `active boolean`.

### Configuración y saldo

**`bitacora.sedes`**

- `kiosk_enabled boolean`: deshabilitado por defecto. Una sede sin esta habilitación no puede recibir configuración ni operaciones Kiosco.

**`bitacora.product_site_settings`**

- `product_id`, `presentation_id`, `sede_id` como clave única.
- `sale_price`, `reference_cost`, `stock_minimum`, `currency`, `active`.
- Fechas y usuario de modificación.
- Una sola configuración por presentación/sede.

**`bitacora.product_site_inventory`** (fase 4)

- `product_id`, `presentation_id`, `sede_id` como clave única.
- `stock_current numeric` como saldo teórico proyectado y protegido.
- `version`, `created_at`, `updated_at`.
- Restricción `stock_current >= 0`.

### Reposición

**`bitacora.inventory_receipts`**

- cabecera por sede, estado (`BORRADOR`, `CONFIRMADA`), usuario, fechas, observación, referencia e idempotencia.

**`bitacora.inventory_receipt_items`**

- producto, presentación/código leído, cantidad de presentaciones, factor, cantidad base, costo unitario y costo total.

### Relevamientos

**`bitacora.inventory_counts`**

- sede, estado (`EN_PROCESO`, `FINALIZADO`), responsable, inicio, cierre y observación.
- Índice único parcial: una sola cabecera `EN_PROCESO` por sede.

**`bitacora.inventory_count_items`**

- producto, cantidad física, `theoretical_at_count`, diferencia, `counted_at`, usuario que contó y `movement_watermark`.
- Al finalizar guarda el movimiento de ajuste asociado.

### Ventas y cobros

**`bitacora.sales`**

- número de operación, sede, estado (`COMPLETADA`, `ANULADA`), subtotal/total, cajero y fechas.
- datos de anulación: usuario, fecha y motivo.
- clave de idempotencia única.

**`bitacora.sale_items`**

- venta, producto, presentación y código leído.
- descripción, cantidad, factor de stock, precio unitario, subtotal y cantidad base descontada como copias históricas.

**`bitacora.payments`**

- venta, medio (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`, `OTRO`), importe, recibido y vuelto.

### Libro de stock

**`bitacora.inventory_movements`**

- secuencia global, producto, sede, presentación opcional.
- tipo: `INGRESO`, `VENTA`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `DEVOLUCION`, `ANULACION_VENTA`.
- cantidad firmada, saldo anterior y saldo posterior.
- usuario y fecha.
- referencia a la línea de reposición, venta, anulación o relevamiento que lo originó.
- observación e idempotencia.
- restricciones que validan el signo y `stock_after = stock_before + quantity_delta`.

## 4. Transacciones y concurrencia

Las operaciones se confirman únicamente mediante RPC de base de datos:

- `confirmar_reposicion(payload, idempotency_key)`
- `guardar_linea_relevamiento(...)`
- `finalizar_relevamiento(count_id, idempotency_key)`
- `confirmar_venta(payload, idempotency_key)`
- `anular_venta(sale_id, motivo, idempotency_key)`

Cada RPC debe:

1. validar sesión, perfil activo, permiso y sede;
2. bloquear con `SELECT ... FOR UPDATE` los saldos afectados en orden de `product_id`;
3. volver a validar precios, estado del artículo y disponibilidad;
4. insertar cabecera, líneas, pago y movimientos;
5. actualizar la proyección de saldo;
6. confirmar todo o revertir todo.

El frontend nunca enviará un saldo final. Enviará la operación y las cantidades; la base calcula saldos anterior/posterior.

## 5. Ventas durante un relevamiento

No se congelará la sede ni se usará el stock existente al iniciar el relevamiento.

Al guardar cada conteo se bloquea brevemente el saldo del producto y se registra:

- cantidad física contada;
- saldo teórico exacto en ese instante;
- fecha/hora;
- secuencia del último movimiento visible.

Al finalizar, se vuelve a bloquear el saldo y se aplica esta fórmula:

`ajuste = cantidad_fisica - theoretical_at_count`

`nuevo_saldo = saldo_actual_al_cierre + ajuste`

Ejemplo: se cuentan 30 cuando el teórico es 33. Luego se venden 2 y el saldo pasa a 31. Al cerrar se aplica -3; el resultado es 28, que equivale a las 30 unidades físicas contadas menos las 2 vendidas después. Así las ventas posteriores al conteo no se pierden ni se cuentan dos veces.

Si una línea se vuelve a contar mientras el relevamiento está abierto, la última medición reemplaza cantidad, instante, saldo de referencia y marca de movimiento. Una vez finalizado, queda inmutable.

## 6. Permisos propuestos

| Perfil actual | Alcance propuesto |
|---|---|
| `admin`, `editor` | configuración, maestro, precios, operaciones e historial solo en sedes asignadas; habilitación global de sedes desde administración |
| `grupo`, `encargado` | operación y supervisión solo en sedes de su alcance; reposición, relevamiento y anulación |
| `sede` | venta, consulta, reposición y relevamiento en sus sedes; sin configurar permisos globales |
| `deposito` | venta, consulta y reposición en `sede_ids`; sin anulaciones ni cambios de precio salvo permiso futuro explícito |
| `consultor` | lectura de maestro, stock e historial autorizado |
| `operario`, `flota`, `mnt_editor` | sin acceso al Kiosco en esta etapa |

La autorización definitiva se comprobará en PostgreSQL; ocultar botones en React es solo una mejora de interfaz. Ningún rol obtiene acceso operativo global implícito: la sede debe tener `kiosk_enabled=true` y pertenecer al alcance explícito de `perfiles.sede_ids`, o al grupo asignado cuando el rol sea `grupo`.

## 7. Interfaz propuesta

El menú **Artículos** evoluciona con pestañas claras:

1. **Maestro** — listado y fichas actuales, con código interno, unidad base, precios y mínimos.
2. **Reposición** — escaneo continuo, carga múltiple y confirmación conjunta.
3. **Stock** — saldo, mínimo, costo, precio y filtros Normal/Bajo/Sin stock.
4. **Relevamientos** — iniciar, continuar, ver diferencias y finalizar.
5. **Movimientos** — trazabilidad por artículo, operación, usuario, fecha y sede.

Se agrega una sección principal **Kiosco**:

- **Venta actual** con foco permanente en el lector, carrito y cobro.
- **Ventas** con historial, detalle, comprobante y anulación autorizada.

En móvil se reutilizará el árbol actual de `MobileMas`; el POS tendrá controles grandes y una disposición específica para pantalla angosta.

## 8. Secuencia de migración e implementación

### Fase 3 — ampliar maestro

- columnas compatibles y backfill de códigos internos/factores;
- configuración por sede y precios;
- formulario y búsquedas actualizados;
- pruebas del maestro y build completo.

### Fase 4 — inventario, reposición y relevamientos

- saldos, reposiciones, relevamientos y libro de movimientos;
- RPC atómicos e idempotentes;
- pruebas de signos, saldos, recuento concurrente y permisos.

### Fase 5 — POS y carrito

- sección Kiosco, escaneo rápido, búsqueda manual y carrito local recuperable.

### Fase 6 — venta transaccional

- ventas, líneas, pagos, control de stock, cobro y comprobante interno.

### Fase 7 — historial y anulaciones

- filtros, detalle y restitución de stock sin borrado.

### Fase 8 — stock e indicadores

- control por sede y estados Normal/Bajo/Sin stock; dashboard después del flujo operativo.

### Fase 9 — cierre de calidad

- permisos completos, escritorio/móvil, lector/teclado, concurrencia, reintentos, accesibilidad y regresión general.

## 9. Migraciones y seguridad

Las migraciones serán aditivas: no borrarán ni renombrarán las tablas actuales ni modificarán las cuatro fichas existentes fuera de completar valores nuevos compatibles.

Las tablas operativas expondrán lectura acotada por sede mediante RLS. Las mutaciones de saldo, ventas y movimientos se revocarán para acceso directo y quedarán disponibles solo mediante RPC autorizados. Antes de aplicar cualquier `GRANT`, RLS o política se presentará el SQL completo para revisión y autorización explícita.

## 10. Criterios de aceptación antes de producción

- El stock no puede editarse desde ninguna pantalla ni con operaciones directas del rol autenticado.
- Toda variación tiene un movimiento y una operación de origen.
- Un reintento con la misma idempotencia devuelve la operación ya creada.
- Dos ventas simultáneas no pueden vender la misma última unidad.
- Una falla intermedia deja venta, pago, movimiento y saldo sin cambios parciales.
- Un relevamiento conserva correctamente ventas y reposiciones posteriores a cada conteo.
- Una anulación mantiene la venta original y restituye stock una sola vez.
- Los cuatro productos y siete códigos actuales siguen consultables.
- Pasan `npm run lint`, `npm run test` y `npm run build` en cada fase.
