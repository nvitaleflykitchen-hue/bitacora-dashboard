# Tablero y novedades de checklist

18/11/2026. Flota → Checklist abre el tablero, no el formulario. Filtra por sede, vehículo y fechas y reúne visitas de flota general y RPC de gran porte. Lee páginas completas de controles y tickets, sin límite arbitrario de 1000 en el tablero. Los contadores de hoy cuentan vehículos distintos; el rango solo afecta controles, novedades, ranking e historial. Estado operativo y tickets abiertos son actuales. Se incluyen unidades en reparación y se excluyen bajas/inactivos. Una carga fallida muestra error, no indicadores de cero.

Nuevo checklist permite seleccionar la unidad o comenzar uno de gran porte. Los enlaces de impresión desaparecen de Checklist. El botón individual de QR está en la ficha del vehículo de escritorio y celular; mantiene la URL permanente.

NC/Crítico abre observación obligatoria por punto. Al confirmar, se crea ticket correctivo de categoría Vehiculos, prioridad alta/crítica, mediante las APIs existentes. Si existe ticket no cerrado con `[CHECKLIST:punto]` para la unidad, añade observación y eleva prioridad sin rebajar crítica. No depende del envío final del checklist: abandonar el formulario conserva el ticket. Ante error no confirma la respuesta y conserva el modal. Los tickets pendientes de esa unidad se muestran al empezar.

Flota general guarda `observaciones_puntos` con texto y ticket_id, además del resumen en observaciones. Gran porte conserva su contrato de respuestas ok/nc/na: el crítico se registra como NC en ese contrato y con gravedad crítica en ticket/resumen del punto. No se modifica el estado operativo del vehículo.

Limitación: la reutilización de tickets es una consulta seguida de escritura, no una transacción de servidor. Dos operadores simultáneos podrían crear duplicados o sobrescribir la última ampliación del diagnóstico. Una RPC transaccional requiere revisión y autorización del SQL de permisos. No se alteraron RLS/GRANT; persisten las políticas amplias de tickets documentadas.

Validación con mocks: creación inmediata, observación obligatoria, prioridad, reutilización, error sin aceptar respuesta, filtrado de sede, conteo de unidades únicas y regresión QR/gran porte. Sin controles o tickets ficticios en producción.


## Actualización 2026-11-18: carga y PDF
- Gran porte permite múltiples controles diarios sin turno. Hora de carga del servidor y nueva identificación por cada control; reintentos conservan el ID.
- Última lectura de checklist precargada, editable; un historial que llega tarde no sobrescribe edición manual. Se admite kilometraje igual.
- NC/Crítico abre modal por punto y crea o actualiza ticket al confirmar. NA se marca directamente, sin justificación ni ticket (ajuste 2026-11-19). Cambiar a OK elimina la observación del punto del control en preparación, pero no cierra un ticket ya registrado.
- Informes individuales, por sede y mobile: fechas para los checklists, resumen por defecto, detalle opcional de novedades en dos columnas. La documentación y demás secciones no se filtran por esas fechas.
- Base: migración 20261118204009_checklist_sin_turnos.sql aplicada a mixyhfdlzjarvszinytk. Sin cambios de permisos, RLS ni datos históricos.
