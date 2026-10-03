# Estaciones Edenred en Flota

La pestaña **Estaciones Edenred** reutiliza Flota, sus permisos de acceso y los estilos existentes. Escritorio y móvil cargan el mismo componente bajo demanda. No requiere migraciones, tablas, cambios de Supabase ni servicios de rutas.

El catálogo inicial importa las 1.792 filas del Excel `DatosDeEstaciones_30092026_073047.xlsx`. El Excel no contiene coordenadas. Se complementa con el [mapa público de Edenred](https://edenred.com.ar/estaciones/) durante la importación, mediante coincidencias conservadoras de localidad, provincia y dirección. El resultado actual tiene 1.138 estaciones con coordenadas y 654 disponibles solo por búsqueda y navegación por dirección. La pantalla informa esa cobertura.

## Actualizar el catálogo

Con Python y `openpyxl` disponibles, desde la raíz del repositorio:

```powershell
python scripts/import_edenred.py "C:/ruta/DatosDeEstaciones_actualizado.xlsx"
python -m unittest discover -s scripts -p test_import_edenred.py
npm test -- src/lib/edenred.test.js src/views/flota/EstacionesEdenred.test.jsx
npm run build
```

El script valida las columnas y reemplaza atómicamente `src/data/edenred.json`. Descarga las coordenadas públicas; para una ejecución reproducible se puede usar `--coordinates ruta/respuesta-map.json` con la respuesta completa del endpoint indicado en el JSON. Revisar conteos y diferencias, integrar por PR y publicar mediante el flujo habitual. La actualización no es una carga administrativa desde el teléfono.

El importador corrige las columnas de localidad/provincia invertidas de esta exportación y normaliza sufijos de zona y `V.MARIA`. Excluye coordenadas compartidas por localidades distintas y coincidencias con puntos separados más de 250 metros. No inventa coordenadas ni usa centros de localidad como estaciones.

## Comportamiento

- La ubicación se solicita al tocar **Mi ubicación**. Se conserva únicamente en memoria, caduca tras 60 segundos y deja de observarse al ocultar o abandonar la pantalla. No se envía a Supabase ni se guarda un historial.
- Muestra alternativas en un radio inicial de 100 km, ampliable a 200 km. La búsqueda textual funciona sin ubicación y permite encontrar todas las filas del Excel.
- Prioriza un cono de 70° a cada lado del rumbo detectado por GPS o desplazamiento significativo. Si no hay rumbo, ordena por cercanía; se puede elegir un sentido manualmente estando detenido.
- Las distancias son en línea recta. La prioridad por rumbo no comprueba accesos, calzadas ni desvíos y no representa una ruta calculada.
- **NAVEGAR** abre una [URL de Google Maps](https://developers.google.com/maps/documentation/urls/get-started) con destino en coordenadas o dirección; Google Maps calcula el recorrido. No necesita API de pago.

## Verificación

Pruebas automatizadas de distancia, rumbo, búsquedas, importación, coordenadas ambiguas, permiso rechazado, caducidad y limpieza del GPS. Vista real probada en navegador con ancho móvil y ubicación simulada, sin insertar datos en producción. Pendiente de validación física del GPS en un teléfono durante un recorrido.
