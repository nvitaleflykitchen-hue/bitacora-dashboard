# Control diario de flota general

Implementado el 16/11/2026 tomando como guía `Check list diario para vehiculos (1).xlsx`, hoja «Hoja 1», filas 11–20, revisión 08/11/2024. Se utiliza un formulario responsive, no la grilla mensual del archivo.

- Escritorio: Flota → Checklist vehicular. Celular: Checklist → Control diario · Resto de los vehículos.
- Diez controles: balizas, frenos, luces, tablero, aceite, rampa, neumáticos, agua/refrigerante, combustible y matafuego.
- Conforme / No conforme / Crítico; No aplica únicamente para rampa. Ninguna respuesta preseleccionada. Observaciones obligatorias si existe un desvío.
- Fecha argentina, vehículo y patente desde su ficha, responsable de la sesión. Kilometraje opcional, entero no negativo.
- Los cuatro vehículos aeroportuarios conservan su formulario y QR específicos. Se excluyen bajas e inactivos. En reparación permite registrar sin modificar el estado de mantenimiento.
- Se conserva el almacenamiento en `mantenimiento.visitas_activo` y el prefijo `CHECKLIST_VEHICULO::`, con payload versión 2. Históricos versión 1 siguen legibles. Últimos controles permite desplegar respuestas; informes existentes siguen leyendo ambos formatos.
- Se consultan hasta 1000 controles recientes de las unidades visibles, no visitas generales de otras sedes. El panel no es un archivo exhaustivo.
- Operario/sede pueden completar desde celular. La creación opcional de tickets conserva los roles de gestión anteriores. Si falla el ticket después del guardado, se informa el fallo parcial sin invitar a repetir el control.
- Sin migraciones ni cambios GRANT/RLS. Persiste la limitación de seguridad previamente documentada en KNOWN_ISSUES: el filtrado por sede y la identidad de sesión del frontend no reemplazan la validación en servidor. La revisión de políticas requiere SQL y autorización aparte.

Validación: pruebas del formulario con API simulada (respuestas obligatorias, exclusión aeroportuarios/bajas, reparación, autor, operario, fallo parcial de ticket), regresión del formulario aeroportuario, build y lint. Inspección de solo lectura de columnas de producción; sin controles ficticios en la base real.
