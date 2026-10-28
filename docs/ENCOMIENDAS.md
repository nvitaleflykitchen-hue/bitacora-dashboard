# Encomiendas

Restaurado el 2026-10-28 desde la copia local `id-programacion-pruebas`.

Acceso: Equipo → Recursos, en escritorio y móvil, con perfil administrador.

- **Etiqueta para Envío de Encomiendas:** seleccionar sede destino, revisar responsable, teléfono y domicilio, completar DNI opcional e indicación de retiro. Descargar PDF A5 horizontal o compartir mediante las opciones del dispositivo.
- **Autorización para Retiro de Encomiendas:** transportista, sede/localidad de origen, fecha y referencia opcional. PDF A4 con remitente, personas autorizadas, logo y firma del modelo original. Revisar esos datos antes de utilizarlo.

Si el dispositivo no admite compartir archivos, el botón descarga el PDF. No envía correos automáticamente. Los documentos se generan localmente y no crean registros en la base. La consulta de responsables actual no devuelve DNI: se completa manualmente cuando corresponda.

Verificación: pruebas aisladas de acceso y formulario con consultas simuladas, generación real de ambos PDF y revisión de sus páginas renderizadas. No se escribieron datos de prueba en producción.

Las personas autorizadas ahora se pueden editar, agregar y quitar antes de descargar o compartir. Se precarga la lista original para revisión. Cada persona requiere nombre y DNI de 7 u 8 dígitos; la lista no puede quedar vacía. La modificación se aplica sólo al documento actual y no cambia las fichas del personal ni se guarda para futuras autorizaciones. Las listas extensas continúan en páginas adicionales.
