# Recursos compartidos — preparado para aprobación

En Biblioteca de recursos, los administradores pueden agregar un archivo (PDF/DOCX/XLSX/PNG/JPG, hasta 20 MB) o enlace HTTPS, título, descripción y grupo destinatario. Los grupos se cargan del maestro existente; Aeropuertos es el grupo 3. Permite cambiar el grupo y archivar/reactivar sin eliminar documentos.

El componente compartido cubre Equipo desktop, Equipo móvil y las bibliotecas filtradas de Calidad/evaluaciones. Los cinco recursos fijos existentes conservan su disponibilidad actual.

## Acceso propuesto
- Administradores activos: alta, cambio de grupo, archivo/reactivación y lectura global.
- Editor y consultor activos: lectura global, coherente con el alcance vigente en auth.jsx.
- Otros roles reconocidos: recursos generales o del grupo asignado (rol grupo) o grupos de sus sedes asignadas.
- Sin sesión o perfil inactivo: sin acceso a los nuevos recursos.
- Los archivos se alojan en bucket privado con políticas de lectura por recurso y URLs firmadas de 60 segundos. Cambiar el acceso impide nuevas URLs; una URL ya emitida puede seguir vigente hasta su vencimiento.
- Un enlace externo controla su aparición en la biblioteca; los permisos del destino siguen administrándose en ese sitio.

## SQL pendiente, NO aplicado
`supabase/migrations/20261013190000_biblioteca_recursos_REVIEW.sql`, sólo para `mixyhfdlzjarvszinytk`.
Crea tabla, funciones acotadas para resolver perfil/grupo, RLS, permisos de tabla y bucket privado. Incluye guardas restrictivas exclusivamente sobre el bucket nuevo para impedir que otras políticas amplias de Storage lo vuelvan público. No modifica registros de negocio ni los roles de las personas. No aplicar ni publicar frontend hasta autorización explícita (AGENTS.md §0.3).

Pruebas aisladas de Postgres verifican grupos, acceso al archivo, cambio de grupo, archivo lógico, rechazo de escritura no administrativa y anonimato incluso con una política legacy permisiva. No se insertaron registros de prueba en producción.
