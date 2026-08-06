# Inventario de formularios y acciones sensibles

Revisión: 2026-08-06. Alcance: escritorio y mobile. Este inventario define dónde se conserva un borrador y dónde una acción exige confirmación única.

## Formularios

| Dominio | Formularios principales | Costo de reconstrucción | Borrador | Motivo |
|---|---|---:|---|---|
| Bitácora | Reporte de turno, novedades por módulo, vuelos, vehículos y personas | Alto | Sí | Puede incluir muchas secciones y cantidades |
| Trabajo | Tarea | Medio | Sí | Descripción, responsables, fechas y adjuntos |
| Compras | Requerimiento desktop/mobile | Alto | Sí | Ítems, entrega, sede, urgencia y evidencia |
| Mantenimiento | Ticket | Alto | Sí al crear | Diagnóstico, asignación, costos y evidencia |
| Calidad | No conformidad | Alto | Sí | Descripción, causa raíz y datos de producto/proveedor |
| Calidad/Gestión | Acción CAPA y proyecto | Alto | Sí | Responsables, fechas, evidencia y colaboradores |
| Personal | Alta, evaluación, historial, vacaciones | Bajo/medio | No | Son formularios breves; la ficha ya conserva el contexto |
| Activos/Flota | Alta o edición de activo, vehículo, documento y plan | Bajo/medio | No | Edición acotada y recuperable desde la ficha existente |
| Administración | Usuario, contacto, responsable y configuración | Bajo | No | Pocos campos y uso infrecuente |

Los borradores duran siete días, se separan por usuario y tipo de formulario y se eliminan después de guardar correctamente. Los archivos no se almacenan localmente.

## Acciones sensibles

| Acción | Casos inventariados | Confirmación requerida | Recuperación comunicada |
|---|---|---|---|
| Eliminar | Personas, usuarios, proyectos CAPA, contactos, documentos, fotos, adjuntos, comentarios, responsables, vuelos | Siempre | Papelera si existe; de lo contrario se declara irreversible |
| Anular | Credenciales, apercibimientos y solicitudes de anulación | Siempre | Reemisión/nueva solicitud o trazabilidad, según el dominio |
| Rechazar | Compras, vacaciones, apercibimientos y tickets | Siempre | Reapertura o nueva solicitud cuando el flujo lo permite |
| Cerrar | Tickets y operaciones que salen de pendientes | Siempre si cambia estado | Reapertura por usuario autorizado, conservando historial |
| Descartar | Reportes y formularios con cambios sin guardar | Siempre | Recuperación desde borrador o última versión guardada |

## Contrato de interacción

1. Una sola ventana de confirmación; no se encadenan dos preguntas para la misma decisión.
2. El botón usa el verbo exacto: Eliminar, Anular, Rechazar, Cerrar o Descartar.
3. La ventana explica qué cambia inmediatamente y si la acción afecta historial, SLA o elementos relacionados.
4. La sección Recuperación dice cómo revertir o rehacer la acción. Si no es reversible, lo declara explícitamente.
5. Solicitar un motivo forma parte de la misma ventana cuando corresponde; no se utilizan `window.confirm` ni `window.prompt`.

