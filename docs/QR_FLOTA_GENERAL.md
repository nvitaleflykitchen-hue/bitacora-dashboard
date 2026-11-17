# QR de flota general

17/11/2026: inventario verificado en `mixyhfdlzjarvszinytk`, vista `public.mnt_activos`, tipo VEHICULO. 26 fichas: 5 bajas, 4 gran porte con circuito propio y 17 unidades adicionales activas.

`src/data/vehicleQrCatalog.json` conserva el inventario de etiquetas (ID, nombre, código y sede). Es un catálogo de enrutamiento, no una autorización. Si se incorpora otra unidad al circuito, actualizarlo y regenerar el PDF con `scripts/qr-flota-general.py`.

Se reutiliza la URL permanente de activos `?scan=activo&id=UUID`, sin datos de cuentas. Los 17 IDs ingresan al flujo autenticado y abren el control diario general con el vehículo fijo; el escáner interno usa el mismo destino. Login y cambio obligatorio de contraseña preceden al formulario. El listado de la sesión decide disponibilidad y excluye bajas; no se modifica RLS ni se presentan los filtros del navegador como seguridad de servidor (ver KNOWN_ISSUES).

El PDF de impresión `public/recursos/qr-flota-general.pdf` contiene 17 etiquetas, 6 por A4 y 3 hojas, ordenadas por sede. Disponible desde Flota → Checklist → Imprimir QR del resto de la flota. Los QR aeroportuarios existentes se conservan.

Datos a confirmar: `AD286II` aparece en dos fichas distintas, Planta Córdoba (`ad1a6ab7...`) y Aeropuerto Tucumán (`49f3a932...`). Sus etiquetas muestran sede e ID corto y apuntan a cada ficha; no se fusionan ni se corrigen sin evidencia. LIFAN de Universidad Santa Fe se identifica con el código interno FK-VH-000001 porque no se confirmó patente.

Pruebas: rutas de los 21 QR, autenticación, preservación del destino, preselección, unidad fuera de alcance no disponible, regresión de otros activos públicos. PDF renderizado y códigos decodificados para comparar los 17 destinos. No se insertaron controles de prueba en producción.
