# Proceso de cambios y comunicación

## Criterio de cierre

Un cambio no se considera terminado hasta que esté **desarrollado, probado, documentado y comunicado**.

## Requisitos de cada actualización

1. Actualizar la versión en `package.json`, `package-lock.json` y `src/data/releases.js`.
2. Agregar la ficha al comienzo de `RELEASES` con:
   - versión y fecha;
   - funciones incorporadas o modificadas;
   - problema resuelto;
   - áreas o usuarios afectados;
   - explicación de uso;
   - capturas o ejemplos, cuando corresponda.
3. Registrar el mismo cambio en `CHANGELOG.md`.
4. Ejecutar las pruebas y `npm run build`.
5. Verificar la experiencia en escritorio y mobile.
6. Confirmar que el aviso automático aparece una vez y que la versión sigue disponible en **Actualizaciones**.

## Separación de comunicaciones

- **Tablón:** anuncios operativos segmentados por sedes o grupos. Usa el circuito existente de notificaciones.
- **Actualizaciones:** versiones y cambios del producto. Se versionan junto con el código para que el contenido publicado corresponda exactamente al despliegue.

El aviso de versión vista se guarda por usuario en `localStorage`. No se escriben datos adicionales en Supabase.

