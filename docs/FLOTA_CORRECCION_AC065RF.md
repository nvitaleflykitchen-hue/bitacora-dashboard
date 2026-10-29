# Corrección de fichas e informes de Flota

Caso de integración: Fiat Doblò AC065RF, Aeropuerto Mendoza. Consultas de sólo lectura al proyecto `mixyhfdlzjarvszinytk`, 28–29/10/2026.

## Causas verificadas

- El informe y el listado de mantenimiento filtraban la categoría exacta `Vehiculos`. Los nueve históricos 893–901 pertenecen a `Flota - historial Prolube`: la consulta anterior devolvía sólo 858.
- El PDF utilizaba la ficha recibida por el componente sin volver a consultar sus datos. La base sí conserva Fiat, Doblò 1.4 16V y 77000 km; no se atribuye el problema a caché sin evidencia.
- El dominio se suplía con `numero_serie` (2-307082), que es una referencia interna. Ahora se distingue de la patente y se indica la fuente del dato.
- El formulario ofrecía año/dominio sin columnas persistentes correspondientes; año y combustible estaban en notas. Se agregan campos compatibles y se conservan esas notas.
- La fecha de incorporación de los históricos era 28/10/2026; la fecha de cierre contiene la intervención real. Se muestran ambas y se ordena por intervención.
- La lectura de kilometraje se infería por máximo numérico, sin fecha. Ahora se selecciona la lectura fechada más reciente y se aclara que no certifica el odómetro actual.
- El guardado enviaba una ficha completa potencialmente antigua. Ahora actualiza sólo campos editados y verifica `updated_at` para detectar cambios concurrentes.

## Archivos y funciones

| Archivo | Cambio |
|---|---|
| `src/lib/flotaModel.js` | Identidad y procedencia, fechas Argentina, lectura fechada, contradicciones, campos editables y validación |
| `src/lib/flotaVehicleSave.js` | `saveFleetVehicle`: actualización parcial con control de concurrencia |
| `src/lib/flotaReportData.js` | `loadVehicleReport`, `readAll`, `groupVehicleReport`: ficha actual, paginación, todos los tickets por activo, proveedores y adjuntos |
| `src/lib/flotaReportPdf.js` | Identificación, historial completo, presupuestos separados de costos declarados, fechas, evidencias y paginado |
| `src/components/FlotaHistorial.jsx` | Historial y advertencias compartidos |
| `src/views/mantenimiento/MntFlotaGestion.jsx` | Formulario persistente y carga actualizada |
| `src/views/mantenimiento/MntVehiculos.jsx` | Consulta sin filtro de categoría, historial sin límite 20, PDF común, conserva categoría al editar |
| `src/mobile/MobileFlota.jsx` | Ficha actualizada, historial, advertencias, documentos, preventivos y PDF común |

Fuentes efectivas: activos, tickets, proveedores, planes_preventivos y sus vistas `mnt_*`; `mnt_visitas`, `mnt_ejecuciones`, `mnt_matafuegos`, `mnt_documentos_flota`; `bitacora.documentacion_items`, `adjuntos`, `vehiculo_novedades` y `registros` asociados. No se modifica el flujo de novedades.

## Migración

`supabase/migrations/20261028171535_flota_ficha_campos_persistentes.sql` aplicada al proyecto autorizado. Agrega dominio, anio, combustible y km_lectura_fecha a activos y expone las columnas en mnt_activos. No modifica filas ni hace backfill. La transacción comprueba que ACL, propietario y opciones de la vista no cambien. No contiene GRANT ni cambios de RLS.

Verificación posterior: 545 activos y 199 tickets, igual que antes; 858 abierto y 893–901 resueltos. Plan activo con próxima fecha 20/02/2027. ACL/propietario/opciones conservados. Campos nuevos inicialmente nulos; año/combustible se presentan desde notas con indicación de procedencia hasta su edición explícita.

## Pruebas

Pruebas automatizadas de modelo, consulta/paginación (1201 filas), guardado parcial/concurrencia, formulario de escritorio, vista móvil, agrupación y PDF. Migración ejecutada en PGlite aislado comprobando conservación de registros y vista dependiente.

Integración local `flotaLive.test.js` con snapshot de sólo lectura de AC065RF: 10 tickets únicos, nueve resueltos, 858 abierto, plan activo, lectura 77000 del ticket 893, todos los costos reales nulos y advertencias documentales. Extracción del PDF comprueba los diez números de ticket, orden y umbral de 87.882 km. Los snapshots privados no se incluyen en Git; esta prueba se omite en CI si no existen. El PDF de entrega se genera en `output/pdf/AC065RF-informe-flota-corregido.pdf`.

## Limitaciones y pendientes operativos

- SENASA conserva 03/12/2026 en ficha y 30/12/2026 en documentación. Requiere cotejo con respaldo.
- ARIEL conserva estado declarado vigente y vencimiento 01/10/2026. Se muestra vencido por fecha, sin inferir renovación.
- Plan activo sin documento respaldatorio adjunto: se advierte; no se considera un servicio realizado.
- 77.000 km es lectura histórica del 20/08/2026. Se conserva la discrepancia con 77.882 mencionada en diagnóstico y el umbral documentado 87.882. No se corrige por inferencia.
- Presupuestos no acreditan pagos. Los costos reales de este caso son nulos; valores declarados de otros vehículos se rotulan como no acreditados hasta verificar comprobante.
- Servicios cancelados mencionados sólo en notas técnicas siguen allí: no se inventan tickets ni se alteran estados.
- Sin staging: no se insertaron datos de prueba en producción. Las pruebas de edición usan dobles y base aislada; no sustituyen una validación de cada rol real con sesión autenticada.
- Los tickets antiguos sin activo_id no pueden atribuirse con certeza al informe por vehículo. Se conserva el listado heredado para esos casos.
