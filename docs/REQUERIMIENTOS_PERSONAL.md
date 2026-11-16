# Requerimientos de personal: código e impresión

Implementado el 2026-11-16 sobre las solicitudes existentes del Tablero de Selección (FlyKitchen). No crea búsquedas duplicadas ni modifica sus vínculos con candidatos.

- Código permanente `REQ-PER-año-número`, correlativo global, sin reinicio anual. El año corresponde a la apertura al asignarlo; una edición posterior no renumera.
- Histórico: 23 requerimientos numerados por fecha de apertura, fecha de creación y UUID como desempate. Incluye 17 cerrados. Rango inicial REQ-PER-2026-0001 a REQ-PER-2026-0023.
- Nuevos: identidad PostgreSQL y trigger invoker asignan el código. Restricciones únicas y bloqueo de edición protegen la numeración. La secuencia puede tener saltos por operaciones fallidas; no se reutilizan códigos.
- Campo opcional fecha requerida, sin inventar fechas históricas.
- Botón PDF A4 en tarjetas activas e historial; Guardar y PDF en el formulario. El documento representa los datos guardados y conserva el código.
- PDF en una hoja: ajuste hasta 8 pt; si un texto extraordinariamente largo no entra, se marca expresamente como resumen y remite a la ficha completa. No cambia ni recorta los datos guardados.
- Buscador por código, puesto y sede; buscar despliega también el historial.

Migración `20261116123934_requerimiento_personal_codigo_pdf.sql` aplicada solamente a mixyhfdlzjarvszinytk. Sin cambios de GRANT/RLS ni roles. Solo se deshabilitó el trigger de updated_at dentro de la transacción bloqueada para preservar las fechas históricas, y quedó habilitado antes del commit. El hash de todos los campos originales antes/después coincide: 91f83e8027f1e503e97f5a189807054c.

Verificación: PostgreSQL aislado para backfill, conservación de campos, asignación sin permisos de secuencia y código inmutable; UI de búsqueda/descarga de históricos; PDF A4 y caso de texto largo. PDF renderizado e inspeccionado. No se persistieron solicitudes de prueba en producción.
