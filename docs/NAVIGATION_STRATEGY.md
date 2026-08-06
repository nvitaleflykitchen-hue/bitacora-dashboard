# Estrategia de navegaciÃ³n

## DecisiÃ³n de Fase 13

La aplicaciÃ³n mantiene el router manual de `App.jsx` y agrega una capa pequeÃ±a en
`src/lib/navigationRoutes.js`. Esa capa es responsable de leer y escribir la URL,
conservar la entidad contextual y traducir destinos de escritorio a mobile.

No se incorpora React Router en esta fase. Reemplazar de una vez las vistas actuales
agregarÃ­a riesgo sin resolver un problema proporcional: la aplicaciÃ³n ya puede abrir
vistas por URL, usar historial del navegador y restaurar el contexto de una ficha.

## Contrato actual

- `readAppRoute` interpreta `view`, `scan`, `targetType`, `targetId` y `targetSedeId`.
- `writeAppRoute` serializa la vista y limpia parÃ¡metros contextuales obsoletos.
- `mobileDestinationForView` centraliza los destinos usados por bÃºsqueda y notificaciones.
- Los filtros persistidos usan un contenedor versionado y validaciÃ³n antes de restaurarse.

## CuÃ¡ndo evaluar un router dedicado

Conviene iniciar una migraciÃ³n incremental sÃ³lo si aparece al menos una de estas necesidades:

1. rutas anidadas con layouts y permisos propios;
2. carga de datos dependiente de parÃ¡metros en muchas vistas;
3. navegaciÃ³n hacia atrÃ¡s con mÃ¡s de un nivel contextual;
4. enlaces pÃºblicos o compartibles con contratos estables;
5. pruebas de rutas que ya no puedan aislarse con el adaptador actual.

En ese caso, la migraciÃ³n debe hacerse vista por vista: primero fichas contextuales,
luego hubs y finalmente accesos secundarios. El adaptador actual funciona como frontera
para evitar cambiar simultÃ¡neamente todos los llamados a `navigate`.
