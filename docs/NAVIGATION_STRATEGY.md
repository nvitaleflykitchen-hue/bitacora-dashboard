# Estrategia de navegación

## Decisión de Fase 13

La aplicación mantiene el router manual de `App.jsx` y agrega una capa pequeña en
`src/lib/navigationRoutes.js`. Esa capa es responsable de leer y escribir la URL,
conservar la entidad contextual y traducir destinos de escritorio a mobile.

No se incorpora React Router en esta fase. Reemplazar de una vez las vistas actuales
agregaría riesgo sin resolver un problema proporcional: la aplicación ya puede abrir
vistas por URL, usar historial del navegador y restaurar el contexto de una ficha.

## Contrato actual

- `readAppRoute` interpreta `view`, `scan`, `targetType`, `targetId` y `targetSedeId`.
- `writeAppRoute` serializa la vista y limpia parámetros contextuales obsoletos.
- `mobileDestinationForView` centraliza los destinos usados por búsqueda y notificaciones.
- Los filtros persistidos usan un contenedor versionado y validación antes de restaurarse.

## Cuándo evaluar un router dedicado

Conviene iniciar una migración incremental sólo si aparece al menos una de estas necesidades:

1. rutas anidadas con layouts y permisos propios;
2. carga de datos dependiente de parámetros en muchas vistas;
3. navegación hacia atrás con más de un nivel contextual;
4. enlaces públicos o compartibles con contratos estables;
5. pruebas de rutas que ya no puedan aislarse con el adaptador actual.

En ese caso, la migración debe hacerse vista por vista: primero fichas contextuales,
luego hubs y finalmente accesos secundarios. El adaptador actual funciona como frontera
para evitar cambiar simultáneamente todos los llamados a `navigate`.
