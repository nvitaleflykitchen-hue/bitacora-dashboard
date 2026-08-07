export const APP_NAME = "Fly Gestión";
export const APP_VERSION = "2.7.22";

export const RELEASES = [
  {
    version: "2.7.22",
    date: "2026-08-07",
    title: "Permisos y validación de capacitaciones",
    functions: [
      "Los responsables de sede pueden crear y completar capacitaciones únicamente en las sedes que tienen asignadas.",
      "El formulario explica que el tema requiere al menos tres caracteres y evita enviar datos incompletos.",
    ],
    problem: "La interfaz habilitaba la carga para responsables de sede, pero la política de base la rechazaba; además, un tema demasiado corto devolvía un mensaje técnico.",
    affectedUsers: "Calidad y responsables autorizados de sede.",
    usage: "Ingresá en Calidad > Capacitaciones, completá un tema de al menos tres caracteres y continuá con la selección de asistentes.",
    examples: ["Un encargado registra una capacitación para una de sus sedes asignadas."],
    screenshots: [],
  },
  {
    version: "2.7.21",
    date: "2026-08-07",
    title: "Capacitaciones con asistencia y trazabilidad",
    functions: [
      "Calidad incorpora un registro de capacitaciones por sede con fecha, instructor, duración, objetivo y planificación.",
      "La selección de asistentes muestra únicamente al personal activo vinculado con la sede elegida.",
      "La asistencia puede marcarse como convocado, presente o ausente y calcula automáticamente el porcentaje alcanzado.",
      "La app genera una planilla de asistencia lista para imprimir, con hasta veinte firmas por página y páginas adicionales cuando corresponda.",
      "El material de apoyo y la planilla firmada pueden adjuntarse o fotografiarse como evidencia de la capacitación.",
      "Cada capacitación finalizada queda vinculada con la ficha de la sede y con el historial de las personas presentes.",
      "El flujo está disponible tanto en escritorio como en la sección Más de mobile.",
    ],
    problem: "Las capacitaciones y sus planillas firmadas se conservaban fuera del sistema, sin una relación verificable con la sede ni con el historial de quienes asistieron.",
    affectedUsers: "Calidad, Recursos Humanos, responsables de sede y personal capacitado.",
    usage: "En Calidad > Capacitaciones creá el evento, elegí la sede, agregá asistentes, imprimí la planilla y marcá la asistencia. Después subí la planilla firmada y finalizá la capacitación.",
    examples: ["Registrar una capacitación BPM y comprobar el porcentaje de asistencia de la sede.", "Consultar desde una ficha personal todas las capacitaciones realizadas."],
    screenshots: [],
  },
  {
    version: "2.7.20",
    date: "2026-08-06",
    title: "Auditorías mobile guiadas",
    functions: [
      "Auditorías internas cuenta con un recorrido específico para celulares en lugar de reutilizar la pantalla de escritorio.",
      "Cada punto se responde en una pantalla con cuatro resultados claros, observación, foto o evidencia y acceso directo para registrar un hallazgo.",
      "Guardar y seguir conserva el avance antes de mostrar el punto siguiente.",
      "Al abrir una auditoría en curso, mobile retoma automáticamente el primer punto pendiente.",
      "La barra de progreso muestra respuestas completadas, total y porcentaje de avance.",
      "La revisión final resume los resultados e impide finalizar mientras existan puntos sin responder.",
    ],
    problem: "El acceso mobile existía, pero mostraba la pantalla completa de escritorio y hacía difícil avanzar durante un recorrido real con decenas de puntos y evidencias.",
    affectedUsers: "Auditores internos, Calidad, Seguridad e Higiene y responsables autorizados que relevan sedes desde el celular.",
    usage: "En mobile abrí Más > Auditorías internas, elegí una auditoría y respondé cada punto. Adjuntá la evidencia, registrá el hallazgo si corresponde y usá Guardar y seguir. Al terminar, revisá el resumen y finalizá.",
    examples: ["Tomar una foto en el punto auditado y continuar sin volver al listado.", "Retomar automáticamente el primer punto pendiente después de interrumpir el recorrido."],
    screenshots: [],
  },
  {
    version: "2.7.19",
    date: "2026-08-06",
    title: "Coordinación global de Mantenimiento",
    functions: [
      "Los administradores pueden otorgar gestión global de Mantenimiento sin cambiar el rol principal del usuario.",
      "El alcance ampliado se aplica sólo a tickets, activos, preventivos, insumos, proveedores y responsables de Mantenimiento.",
      "Pablo Fernández queda incorporado como Coordinador de Mantenimiento de segundo nivel para todas las sedes.",
      "La cuenta vinculada conserva el rol de grupo y su alcance habitual en los demás módulos.",
      "La administración de Usuarios muestra por separado el alcance de Compras y Mantenimiento.",
    ],
    problem: "Un responsable territorial no podía coordinar Mantenimiento en todas las sedes sin recibir permisos generales innecesarios.",
    affectedUsers: "Coordinación de Mantenimiento, administradores y responsables de cada sede.",
    usage: "En Usuarios, un administrador puede habilitar o quitar Todas las sedes en la columna Mantenimiento. El usuario debe volver a iniciar sesión para refrescar el permiso.",
    examples: ["Revisar tickets de cualquier sede.", "Asignar responsables globales.", "Conservar el acceso territorial de comedores fuera de Mantenimiento."],
    screenshots: [],
  },
  {
    version: "2.7.18",
    date: "2026-08-06",
    title: "Fase 13: rendimiento y navegación",
    functions: [
      "Mobile descarga cada módulo cuando se abre, reduciendo el peso de la carga inicial.",
      "La pestaña, el módulo de Más y los filtros principales se conservan por usuario en el dispositivo.",
      "Los filtros persistidos se validan y pueden recuperarse aunque cambie el formato de almacenamiento.",
      "La navegación por URL conserva la vista y la entidad de origen mediante una capa centralizada.",
      "Notificaciones y búsqueda comparten el mismo mapa de destinos mobile para evitar rutas inconsistentes.",
    ],
    problem: "Al volver a la aplicación se perdían filtros y contexto, mientras que mobile cargaba módulos que el usuario quizá no iba a abrir.",
    affectedUsers: "Todos los usuarios de mobile y quienes abren fichas o enlaces contextuales desde escritorio.",
    usage: "Navegá y filtrá normalmente: al regresar desde el mismo dispositivo se recuperará el contexto válido. La primera apertura de cada módulo puede mostrar Cargando sección durante un instante.",
    examples: ["Volver a Tickets conservando Activos.", "Retomar el último módulo abierto dentro de Más.", "Abrir una ficha desde un enlace sin perder la entidad seleccionada."],
    screenshots: [],
  },
  {
    version: "2.7.17",
    date: "2026-08-06",
    title: "Fase 12: formularios y acciones sensibles",
    functions: [
      "No Conformidades, acciones CAPA y proyectos de gestión guardan borradores locales durante siete días.",
      "Eliminar, anular, rechazar, cerrar y descartar utilizan una única confirmación coherente en toda la aplicación.",
      "Las confirmaciones explican qué cambiará y cómo recuperar la operación, o advierten cuando no existe recuperación.",
      "Los cierres y rechazos de tickets informan su efecto sobre pendientes, SLA e historial antes de aplicarse.",
      "Vacaciones, apercibimientos y requerimientos explican el impacto del rechazo y la posibilidad de volver a solicitar o reabrir.",
      "Se eliminaron las confirmaciones y solicitudes de motivo nativas del navegador.",
      "El inventario de formularios documenta qué cargas necesitan borrador y qué acciones requieren confirmación.",
    ],
    problem: "Las acciones sensibles usaban mensajes desiguales y algunos formularios largos de Calidad podían perderse al cerrar o interrumpir la carga.",
    affectedUsers: "Todos los usuarios que crean formularios o gestionan cierres, rechazos, anulaciones y eliminaciones.",
    usage: "Leé las secciones Qué ocurrirá y Recuperación antes de confirmar. Si interrumpís una NC o CAPA, volvé al formulario desde el mismo dispositivo para recuperar el borrador.",
    examples: ["Cerrar un ticket conociendo su efecto sobre el SLA.", "Rechazar vacaciones sabiendo cómo volver a solicitarlas.", "Retomar una No Conformidad sin reescribir los datos de producto."],
    screenshots: [],
  },
  {
    version: "2.7.16",
    date: "2026-08-06",
    title: "Fase 11: flujos contextuales",
    functions: [
      "Las fichas de activos, vehículos, sedes y personas permiten iniciar una novedad sin abandonar el contexto.",
      "La sede y la entidad de origen quedan preseleccionadas y se verifican contra las opciones autorizadas antes de habilitar el envío.",
      "Los borradores contextuales se guardan separados de los reportes generales para evitar cruces entre cargas.",
      "Después de guardar, la aplicación vuelve a la ficha de origen tanto en escritorio como en mobile.",
      "El acceso contextual reduce la selección manual de sede y entidad en uno o dos pasos por operación.",
    ],
    problem: "Para registrar una novedad vinculada, el usuario debía salir de la ficha, abrir un reporte general y volver a buscar la sede y la entidad.",
    affectedUsers: "Responsables, administradores y personal operativo que registra novedades de mantenimiento, flota, sedes o equipo.",
    usage: "Abrí la ficha correspondiente y elegí Crear novedad. Confirmá el origen verificado, completá la descripción y enviá; al finalizar volverás a la misma ficha.",
    examples: ["Informar una falla desde la ficha de un horno.", "Registrar una novedad desde un vehículo.", "Agregar un hecho laboral desde la ficha de una persona."],
    screenshots: [],
  },
  {
    version: "2.7.15",
    date: "2026-08-06",
    title: "Fase 10: cierre de deuda mobile",
    functions: [
      "Checklist, Calidad, Escalamientos y Personal aumentan sus textos operativos esenciales a un mínimo de 12 píxeles.",
      "Las altas de CAPA, no conformidades y personas muestran acciones con texto visible en lugar de depender sólo del símbolo +.",
      "Checklist incorpora botones Volver identificables y una salida clara cuando una sede no tiene controles configurados.",
      "Calidad permite crear el primer registro directamente desde el estado vacío, respetando los permisos existentes.",
      "Escalamientos permite quitar filtros o actualizar desde el estado vacío y presenta acciones de comentarios, tickets y estados con nombres completos.",
      "Personal permite limpiar búsqueda y filtros cuando no encuentra resultados y volver a la lista desde Bajas vacías.",
      "La sección Recientes de Más puede limpiarse manualmente sin afectar los favoritos.",
    ],
    problem: "Varias vistas mobile conservaban textos demasiado pequeños, acciones importantes representadas sólo por íconos y estados vacíos sin un siguiente paso claro.",
    affectedUsers: "Personal operativo, responsables y administradores que utilizan Checklist, Calidad, Escalamientos o Equipo desde teléfonos.",
    usage: "Usá las acciones con nombre visible en cada pantalla. En Más, elegí Limpiar recientes cuando quieras reiniciar únicamente ese historial.",
    examples: ["Crear la primera CAPA desde una lista vacía.", "Quitar un filtro de escalamientos sin regresar manualmente.", "Limpiar búsqueda y sede en Equipo con una sola acción."],
    screenshots: [],
  },
  {
    version: "2.7.14",
    date: "2026-08-06",
    title: "Fase 9: navegación mobile optimizada",
    functions: [
      "Más incorpora favoritos personales para mantener los módulos habituales siempre a mano.",
      "Los últimos cuatro módulos abiertos aparecen automáticamente en Recientes, sin duplicar los que ya son favoritos.",
      "Los accesos adicionales se ordenan en Trabajo diario, Gestión e Información y cuenta.",
      "Favoritos y recientes se guardan por usuario en el dispositivo y se depuran si cambian sus permisos.",
      "La navegación inferior utiliza textos más claros, mayor legibilidad e indica la sección activa a lectores de pantalla.",
      "Perfil, Nuevo reporte, Volver y las estrellas cuentan con áreas táctiles de al menos 44 píxeles.",
      "Se revisaron títulos, ayudas y acentos de las pantallas principales de navegación mobile.",
    ],
    problem: "En mobile, Más exigía recorrer una lista extensa, no priorizaba los módulos habituales y algunos controles importantes tenían áreas táctiles pequeñas.",
    affectedUsers: "Todos los usuarios que trabajan desde teléfonos o dispositivos táctiles.",
    usage: "Abrí Más y tocá la estrella de los módulos que usás seguido. Los demás accesos utilizados quedarán disponibles temporalmente en Recientes.",
    examples: ["Fijar Flota y Mantenimiento como favoritos.", "Volver a Compras desde Recientes.", "Encontrar Directorio y Actualizaciones dentro de Información y cuenta."],
    screenshots: [],
  },
  {
    version: "2.7.13",
    date: "2026-08-06",
    title: "Fase 8: formularios y borradores",
    functions: [
      "Nuevo Reporte mobile guarda automáticamente sede, turno, módulos, novedades, vuelos y cantidades mientras se completa.",
      "Tareas, requerimientos de compra y tickets de mantenimiento recuperan cargas interrumpidas en el mismo dispositivo.",
      "Los formularios informan cuándo recuperaron o guardaron un borrador y permiten descartarlo explícitamente.",
      "Los borradores se separan por usuario y tipo de formulario para evitar mezclar cargas.",
      "Al guardar o enviar correctamente, el borrador local se elimina automáticamente.",
      "Tareas, Compras y Mantenimiento muestran un resumen de errores con accesos directos a los campos pendientes.",
      "Los adjuntos no se almacenan en el borrador local y deben seleccionarse nuevamente por seguridad del navegador.",
    ],
    problem: "Una interrupción, cierre accidental o pérdida de conexión podía obligar a reconstruir formularios extensos y los errores se comunicaban de manera aislada.",
    affectedUsers: "Personal operativo que carga reportes desde mobile y usuarios que crean tareas, compras o tickets de mantenimiento.",
    usage: "Completá el formulario normalmente. Si salís y volvés desde el mismo dispositivo, la aplicación recuperará la carga. Usá Descartar para empezar de cero.",
    examples: ["Retomar un reporte de turno después de cambiar de pantalla.", "Volver a un requerimiento sin reescribir descripción y cantidades.", "Ir directamente desde el resumen de errores al campo obligatorio pendiente."],
    screenshots: [],
  },
  {
    version: "2.7.12",
    date: "2026-08-06",
    title: "Fase 7: estados consistentes",
    functions: [
      "Nuevo diccionario transversal con seis estados humanos: Pendiente, En curso, Bloqueado, Observado, Finalizado y Cancelado.",
      "Las variantes propias de cada módulo se presentan bajo el mismo concepto sin modificar los valores almacenados en la base.",
      "La etapa interna se conserva como contexto secundario, por ejemplo En curso · En compra o Finalizado · Resuelto.",
      "Bandeja, Tareas, Escalamientos, Compras y Mantenimiento utilizan las mismas equivalencias visuales.",
      "Los tickets mobile muestran las mismas etiquetas que la versión de escritorio.",
      "Los estados desconocidos mantienen su texto original para evitar clasificaciones inventadas.",
    ],
    problem: "Cada módulo utilizaba vocabularios diferentes para situaciones equivalentes, aumentando el aprendizaje y el riesgo de interpretar mal el avance de un trabajo.",
    affectedUsers: "Todos los usuarios que consultan o gestionan trabajo en más de un módulo.",
    usage: "Leé primero el estado común. Cuando exista una etapa específica del módulo, aparecerá después del separador como información complementaria.",
    examples: ["Abierto y Pendiente se reconocen como Pendiente.", "En gestión, En ejecución y En compra se reconocen como En curso.", "Resuelto, Cumplido y Verificado se reconocen como Finalizado."],
    screenshots: [],
  },
  {
    version: "2.7.11",
    date: "2026-08-06",
    title: "Fase 6: Bandeja única",
    functions: [
      "Pendientes pasa a llamarse Bandeja y concentra tareas, CAPA, proyectos, escalamientos, tickets y compras.",
      "Los indicadores Total, Vencidos/alta, Sin responsable, Próximos 7 días y Míos aplican el filtro correspondiente con un solo clic.",
      "La bandeja recuerda la vista, el foco, el área, la prioridad y la búsqueda elegidos por cada usuario.",
      "Los escalamientos que ya generaron un ticket vinculado dejan de mostrarse como un segundo trabajo independiente.",
      "Cada fila conserva el identificador y la sede del registro para navegar al elemento operativo correcto.",
      "Un único botón permite limpiar todos los filtros activos.",
    ],
    problem: "La bandeja existente reunía fuentes distintas, pero algunos indicadores no filtraban, se perdía el contexto al volver y un mismo problema podía aparecer como escalamiento y ticket.",
    affectedUsers: "Responsables, administradores, encargados y equipos operativos que priorizan trabajo entre varios módulos.",
    usage: "Ingresá a Bandeja y elegí el foco de trabajo desde los indicadores superiores. La selección se conserva hasta que uses Limpiar filtros.",
    examples: ["Ver únicamente lo vencido o crítico con un clic.", "Continuar trabajando con el mismo filtro al regresar a la Bandeja.", "Gestionar un ticket vinculado sin contar también su escalamiento como otra tarea."],
    screenshots: [],
  },
  {
    version: "2.7.10",
    date: "2026-08-05",
    title: "Fase 5: Inicio enfocado en resolver",
    functions: [
      "Inicio mantiene visible el trabajo que requiere atención y pliega los bloques secundarios.",
      "Contactos rápidos permanece cerrado por defecto y sólo carga el directorio cuando se abre.",
      "El Dashboard Global pasa a Resumen operativo y se consulta bajo demanda.",
      "La aplicación recuerda si cada usuario dejó abiertos o cerrados Contactos y Resumen operativo.",
      "Las alertas se agrupan por destino operativo: Tickets, Asignación, Matafuegos, Flota y Acciones correctivas.",
      "Cada grupo conserva la severidad más alta, el total afectado y el detalle disponible al apoyar el cursor.",
    ],
    problem: "Inicio mezclaba trabajo personal, un directorio extenso y el dashboard completo; la barra de alertas mostraba categorías separadas que llevaban al mismo módulo.",
    affectedUsers: "Todos los usuarios de escritorio, especialmente administradores y responsables con acceso a múltiples módulos.",
    usage: "Resolvé primero los elementos de Mi Gestión. Abrí Contactos rápidos o Resumen operativo sólo cuando necesites esa información.",
    examples: ["Ver en un único acceso todas las alertas relacionadas con Tickets.", "Consultar el estado global sin cargarlo permanentemente en Inicio."],
    screenshots: [],
  },
  {
    version: "2.7.9",
    date: "2026-08-05",
    title: "Ficha personal más limpia",
    functions: [
      "La ficha deja visible Mensaje y reúne Llamar, Email, Credencial y acciones administrativas en Más acciones.",
      "Enviar a obsoletos y Eliminar ficha aparecen separados y con jerarquía de advertencia o peligro.",
      "Puntaje, resultado, logros e incidentes pasan a un resumen compacto dentro del encabezado.",
      "Logros y Formularios se agrupan en Más dentro de la navegación de la ficha.",
      "Los datos personales y laborales aprovechan mejor el ancho y reducen el desplazamiento vertical.",
    ],
    problem: "La cabecera mostraba demasiadas acciones equivalentes, exponía permanentemente operaciones peligrosas y dedicaba una franja completa a métricas frecuentemente vacías.",
    affectedUsers: "Administradores, responsables de RR. HH. y usuarios que consultan fichas personales.",
    usage: "Usá Mensaje para el contacto frecuente y abrí Más acciones para llamadas, email, credenciales y operaciones administrativas.",
    examples: ["Enviar una ficha a obsoletos desde la sección separada del menú.", "Consultar métricas sin perder espacio vertical."],
    screenshots: [],
  },
  {
    version: "2.7.8",
    date: "2026-08-05",
    title: "Equipo: navegación compacta",
    functions: [
      "Equipo muestra cinco secciones principales y agrupa las herramientas ocasionales en un menú Más.",
      "Período de prueba, Credenciales, Historial de bajas, Duplicados, Selección y Contactos siguen disponibles sin ocupar toda la barra.",
      "El menú indica cuándo una herramienta secundaria está activa y se cierra al elegir, tocar afuera o presionar Escape.",
    ],
    problem: "La barra de Equipo mostraba once opciones simultáneas, partía textos en varias líneas y mezclaba vistas frecuentes con herramientas administrativas.",
    affectedUsers: "Administradores, responsables de RR. HH. y usuarios de consulta del módulo Equipo.",
    usage: "Usá las cinco vistas visibles para el trabajo frecuente y abrí Más para acceder a las herramientas administrativas.",
    examples: ["Abrir Historial de bajas desde Más.", "Consultar Duplicados sin recargar la barra principal."],
    screenshots: [],
  },
  {
    version: "2.7.7",
    date: "2026-08-05",
    title: "Fase 4: controles consistentes y accesibles",
    functions: [
      "Todos los controles muestran un foco visible y consistente al navegar con teclado.",
      "Las pestañas de Mantenimiento, Flota y Calidad se pueden recorrer con las flechas, Inicio y Fin.",
      "Botones, campos y acciones táctiles mantienen un área mínima de 44 píxeles en mobile.",
      "Los botones representados sólo por íconos incorporan nombres claros para lectores de pantalla.",
      "Las alertas comunican su actualización y estado a tecnologías de asistencia.",
      "Las animaciones se reducen automáticamente cuando el dispositivo así lo solicita.",
    ],
    problem: "Los controles no mantenían el mismo comportamiento de foco, varios íconos no explicaban su acción y algunos objetivos táctiles resultaban demasiado pequeños.",
    affectedUsers: "Todo el personal, especialmente quienes usan teclado, lectores de pantalla o la aplicación desde un teléfono en operación.",
    usage: "La operatoria no cambia. Ahora podés recorrer las secciones con el teclado y los controles móviles ofrecen áreas táctiles más seguras.",
    examples: [
      "Moverse entre secciones con las flechas sin depender del mouse.",
      "Identificar correctamente acciones como Cerrar o Actualizar aunque visualmente sólo muestren un ícono.",
    ],
    screenshots: [],
  },
  {
    version: "2.7.6",
    date: "2026-08-05",
    title: "Fase 3: navegación más simple",
    functions: [
      "Los módulos extensos muestran hasta cinco secciones principales y agrupan el resto en Más herramientas.",
      "Mantenimiento pasa de diez opciones simultáneas a cinco accesos principales más un selector organizado.",
      "Flota y Calidad aplican la misma jerarquía, conservando todas sus funciones y permisos.",
      "La navegación inferior mobile general baja de ocho a cinco destinos para mejorar lectura y área táctil.",
      "Checklist, Compras y Escalamientos continúan disponibles en Más, dentro del grupo Trabajo diario.",
      "El menú Más separa Trabajo diario, Gestión e Información para reducir la búsqueda visual.",
    ],
    problem: "La cantidad de pestañas y destinos simultáneos dificultaba reconocer qué era principal y obligaba a recorrer opciones sin una jerarquía clara.",
    affectedUsers: "Todos los usuarios de mobile y quienes trabajan en los hubs de Mantenimiento, Flota y Calidad.",
    usage: "Usá las cinco secciones visibles para el trabajo habitual. Las funciones especializadas permanecen disponibles en Más herramientas o en Más desde mobile.",
    examples: [
      "Abrir Proveedores o Matafuegos desde Más herramientas en Mantenimiento.",
      "Ingresar a Checklist, Compras o Escalamientos desde Trabajo diario en mobile.",
    ],
    screenshots: [],
  },
  {
    version: "2.7.5",
    date: "2026-08-05",
    title: "Fase 2: menos ruido y trabajo más rápido",
    functions: [
      "La barra global muestra por defecto un resumen compacto con cantidad y severidad de las alertas.",
      "Cada usuario puede desplegar o minimizar las alertas y la aplicación recuerda su preferencia.",
      "Los filtros del tablero de Mantenimiento se conservan al cambiar de pantalla o volver a ingresar.",
      "Flota recuerda el vehículo, prioridad, tipo, SLA y la vista elegida entre Kanban e Historial por vehículo.",
      "Cuando hay filtros activos se muestra su cantidad y un botón permite limpiarlos todos con una sola acción.",
    ],
    problem: "Las alertas ocupaban demasiado espacio en todas las pantallas y los usuarios debían reconstruir sus filtros cada vez que retomaban una tarea.",
    affectedUsers: "Todo el personal de escritorio, especialmente responsables de Mantenimiento y Flota.",
    usage: "Usá Ver alertas para desplegar el detalle. Configurá los filtros una vez; se recuperarán automáticamente hasta que elijas Limpiar filtros.",
    examples: [
      "Volver al historial de una unidad y conservar el vehículo y la prioridad seleccionados.",
      "Mantener visible sólo el resumen de alertas mientras se trabaja en un tablero.",
    ],
    screenshots: [],
  },
  {
    version: "2.7.4",
    date: "2026-08-05",
    title: "Fase 1: operaciones más seguras y claras",
    functions: [
      "Nuevo Reporte ya no se cierra al tocar accidentalmente fuera del formulario.",
      "Los teléfonos y enlaces de WhatsApp se normalizan antes de usarse, evitando prefijos duplicados o enlaces inválidos.",
      "Flota muestra el estado Bloqueado de forma consistente y mantiene compatibilidad con los registros históricos.",
      "Los errores al cargar contactos o datos de Flota se informan y ofrecen una acción de reintento.",
      "Los cambios de estado fallidos en el tablero de Flota se revierten automáticamente en pantalla.",
      "Los controles principales de contactos y tickets incorporan nombres accesibles para lectores de pantalla.",
    ],
    problem: "Algunos cierres accidentales podían hacer perder cargas, ciertos teléfonos generaban enlaces inválidos y varios fallos de red se confundían con listados vacíos.",
    affectedUsers: "Todo el personal que carga reportes, consulta contactos o gestiona tickets de Flota en escritorio y mobile.",
    usage: "Usá los flujos normalmente. Si una consulta falla, la pantalla lo informa y permite reintentar; si intentás cerrar un ticket modificado, se solicita confirmación.",
    examples: [
      "Evitar perder un reporte por tocar el fondo del modal.",
      "Llamar o escribir por WhatsApp aunque el número haya sido cargado con espacios, guiones o +54.",
      "Distinguir un error de conexión de una flota o agenda realmente vacía.",
    ],
    screenshots: [],
  },
  {
    version: "2.7.3",
    date: "2026-08-05",
    title: "Historial integral de cada vehículo",
    functions: [
      "Flota > Tickets > Por unidad reúne los tickets de mantenimiento y las novedades operativas de cada vehículo.",
      "Cada unidad muestra tickets totales y abiertos, novedades, último kilometraje y costos registrados.",
      "El nuevo botón Exportar PDF genera una ficha completa con estados, prioridades, diagnósticos, responsables, costos y novedades.",
      "La vinculación prioriza el identificador interno del activo y conserva la patente o nombre como respaldo para registros históricos.",
    ],
    problem: "El historial por unidad solo mostraba tickets y no permitía reunir ni exportar las novedades vinculadas al vehículo.",
    affectedUsers: "Responsables de Flota, administradores, editores y usuarios que consultan el mantenimiento vehicular.",
    usage: "Ingresá a Flota > Tickets, elegí Por unidad, seleccioná el vehículo y usá Exportar PDF para descargar su ficha histórica.",
    examples: [
      "Consultar todos los tickets abiertos y resueltos del LIFAN AD 286 IH junto con sus novedades de operación.",
      "Enviar al taller o a la gerencia un PDF con diagnóstico, kilometraje, costos e incidentes de la unidad.",
    ],
    screenshots: [],
  },
  {
    version: "2.7.2",
    date: "2026-08-05",
    title: "Edición directa de contactos rápidos",
    functions: [
      "El panel de Contactos rápidos incorpora el acceso Editar contactos para administradores y editores.",
      "La gestión permite agregar, modificar o desactivar contactos, vincularlos con usuarios y asignarlos a una o varias sedes.",
      "Al cerrar la edición, el panel invalida su caché y vuelve a consultar el directorio para mostrar los cambios recientes.",
    ],
    problem: "En Compras se podían consultar y utilizar los contactos rápidos, pero no existía un acceso visible para administrarlos desde la misma pantalla.",
    affectedUsers: "Administradores y editores que mantienen el directorio, y usuarios de los módulos que consultan contactos rápidos.",
    usage: "Abrí CONTACTOS y elegí EDITAR CONTACTOS. Desde la ventana de gestión podés agregar un contacto o usar los botones de lápiz y papelera para modificarlo o desactivarlo.",
    examples: [
      "Actualizar el teléfono o email de un integrante de Compras sin salir del tablero de requerimientos.",
      "Agregar un contacto y vincularlo con un usuario existente para completar sus datos más rápido.",
    ],
    screenshots: [],
  },
  {
    version: "2.7.1",
    date: "2026-08-05",
    title: "Reportes vinculados, cumpleaños y despliegues más seguros",
    functions: [
      "Las novedades de Equipos / Mantenimiento pueden asociarse a un activo de la sede y generar un ticket de mantenimiento vinculado.",
      "El selector de equipos reconoce correctamente los activos cargados con el dominio EQUIPO y filtra por la sede elegida.",
      "El Tablón informa los cumpleaños de hoy y de los próximos 7 días, tanto en escritorio como en mobile.",
      "Cuando la persona cumple años y tiene teléfono cargado, el botón Saludar abre WhatsApp con un mensaje preparado.",
      "Los reportes mobile bloquean dobles envíos inmediatos y evitan recrear una novedad idéntica al reutilizar un reporte existente.",
      "El historial de Equipo deja de mostrar dos veces las novedades automáticas duplicadas del mismo registro, sin ocultar notas manuales legítimas.",
      "GitHub verifica automáticamente lint, pruebas y build; el deploy de producción se bloquea si la rama está desactualizada, tiene cambios sin commit o no es main.",
    ],
    problem: "Algunas novedades podían duplicarse, los equipos cargados no aparecían en el selector por una diferencia de mayúsculas y los cumpleaños del personal no tenían visibilidad operativa. Además, el proceso anterior permitía desplegar accidentalmente una rama antigua o con cambios mezclados.",
    affectedUsers: "Todo el personal que consulta el Tablón, responsables que cargan reportes y usuarios de Equipo y Mantenimiento.",
    usage: "En Nuevo Reporte abrí Equipos / Mantenimiento, agregá la novedad y elegí el activo de la sede; si corresponde, marcá Crear ticket automático. En el Tablón consultá los cumpleaños próximos y usá Saludar durante el día del cumpleaños.",
    examples: [
      "Vincular una falla del horno pizzero al activo correspondiente y crear el ticket sin volver a cargar sus datos.",
      "Ver en el Tablón que una persona cumple hoy y abrir el saludo preparado en WhatsApp.",
      "Reintentar un reporte sin duplicar la misma novedad en el historial del personal.",
    ],
    screenshots: [],
  },
  {
    version: "2.7.0",
    date: "2026-07-29",
    title: "Equipo, organigramas e informes de gestión",
    functions: [
      "Equipo incorpora período de prueba, bajas sin pérdida de historial, fichas privadas de RR. HH. y protección contra el borrado accidental de personas con registros vinculados.",
      "El organigrama se convierte en un editor visual de pantalla completa, con conexiones, unidades, Calidad transversal y exportación PDF legible.",
      "Las credenciales emitidas pueden seleccionarse e imprimirse en lote, con frentes y dorsos distribuidos en hojas A4.",
      "El flujo disciplinario permite crear, aprobar, editar y notificar apercibimientos; los documentos firmados quedan visibles en Formularios e Historial.",
      "Las suspensiones firmadas registran fecha inicial, cantidad de días, motivo, reintegro y adjunto directamente en el historial de la persona.",
      "El informe de novedades de personal recupera los antecedentes vinculados y el nuevo Informe de gestión permite elegir período, sedes y temas antes de generar el PDF.",
      "La lectura de raciones distingue producidas, servidas, reutilizables y descartadas, con una comparación más clara por producto.",
      "Compras mobile permite crear solicitudes con tipos válidos y se corrigieron cálculos de raciones, numeración de NC y evaluaciones con puntajes inconsistentes.",
    ],
    problem: "Las funciones incorporadas durante la segunda mitad de julio habían superado la documentación disponible: varias herramientas de RR. HH., organigramas, informes y mobile no figuraban en Actualizaciones ni en el Manual de Uso.",
    affectedUsers: "Administradores, RR. HH., responsables de sede, Calidad, Compras y usuarios que consultan informes o trabajan desde mobile.",
    usage: "Ingresá a Equipo para gestionar fichas, organigramas, credenciales y formularios disciplinarios. Desde el tablero global usá Informe de gestión para elegir el período, las sedes y los temas del PDF. Consultá el Manual de Uso actualizado para el paso a paso.",
    examples: [
      "Registrar una suspensión firmada y verla automáticamente en el Historial de la persona.",
      "Seleccionar varias sedes y generar un informe mensual solo con Operación, Mantenimiento y RR. HH.",
      "Imprimir varias credenciales en hojas A4 listas para corte y doble faz.",
    ],
    screenshots: [],
  },
  {
    version: "2.6.0",
    date: "2026-07-19",
    title: "Mejoras acumuladas de operación y comunicación",
    functions: [
      "Equipo incorpora bajas laborales programadas, motivo y observaciones, sin borrar la ficha ni su historial; las bajas confirmadas quedan disponibles en una sección independiente.",
      "Los checklists vuelven a enviarse correctamente e incorporan una vista de supervisión y responsables por sede.",
      "Las notificaciones tienen un panel renovado, navegan al elemento relacionado y los comentarios admiten reacciones con emojis.",
      "El Tablón permite dirigir publicaciones por sedes, áreas, equipos o personas; un fallo de notificación push ya no impide publicar el anuncio.",
      "Nuevo cronograma de limpieza por sede, con configuración, aviso de la tarea del día y evidencia fotográfica; el piloto de Comedor Libertad funciona en paralelo al operativo.",
      "Los contactos rápidos pueden administrarse por sede, abarcar varias sedes y autocompletarse desde usuarios; Calidad incorpora su propia pestaña editable de Contactos.",
      "Las auditorías finalizadas cuentan con una vista de lectura y las evaluaciones incorporan una guía dentro del formulario.",
      "Compras mobile muestra el detalle real del requerimiento y los formularios de tareas conservan visibles sus acciones mediante desplazamiento.",
      "Se corrigieron la apertura de registros desde notificaciones y el texto con emojis al compartir candidatos por WhatsApp.",
    ],
    problem: "Las mejoras incorporadas después de la versión 2.5.0 no estaban reunidas en Actualizaciones, y varios flujos necesitaban una navegación más directa, mejor segmentación y mayor tolerancia ante errores secundarios.",
    affectedUsers: "Usuarios de Operaciones, responsables de sede, Calidad, Compras, Mantenimiento, RR. HH. y administradores, tanto en escritorio como en mobile.",
    usage: "Consultá esta ficha como resumen general. Para operar cada mejora, ingresá al módulo correspondiente: Checklists, Notificaciones, Tablón, Limpieza, Contactos, Calidad, Compras o Equipo.",
    examples: [
      "Publicar un aviso dirigido a un área o persona sin que un error de push cancele la publicación.",
      "Consultar la limpieza prevista para hoy, completarla y adjuntar la evidencia fotográfica.",
      "Abrir una notificación y llegar directamente al registro, tarea o elemento que la originó.",
    ],
    screenshots: [],
  },
  {
    version: "2.5.0",
    date: "2026-07-14",
    title: "Mantenimiento móvil enfocado en el trabajo asignado",
    functions: [
      "El personal de Mantenimiento ingresa directamente a sus tickets pendientes.",
      "La navegación móvil se limita a Tickets, Sedes, Compras y las herramientas propias de Mantenimiento.",
      "Cada ticket muestra la sede y el nombre real del activo o equipo.",
      "El técnico puede iniciar el trabajo, registrar el diagnóstico, tomar fotografías, adjuntar archivos y finalizarlo.",
      "Pendientes e Historial permanecen separados para evitar mezclar trabajos activos con tareas cerradas.",
    ],
    problem: "La vista móvil general mostraba demasiadas opciones, permitía salir del filtro personal y los preventivos no identificaban correctamente la sede ni el equipo.",
    affectedUsers: "Emanuel Calderón y futuros usuarios con rol Gestión Mantenimiento.",
    usage: "Ingresá desde el teléfono y abrí Tickets. En Pendientes elegí un trabajo, tocá Iniciar trabajo, registrá diagnóstico y evidencias y usá Finalizar trabajo cuando esté resuelto.",
    examples: ["Ticket preventivo del FREEZER celíacos, Planta de Producción Córdoba, con diagnóstico y fotografía de cierre."],
    screenshots: [],
  },
  {
    version: "2.4.9",
    date: "2026-07-14",
    title: "Doble control documental y actualización técnica",
    functions: [
      "Los documentos del historial de personal ya no se eliminan directamente.",
      "La anulación requiere un motivo y la autorización de un administrador distinto.",
      "Los registros anulados conservan sus adjuntos y toda la trazabilidad.",
      "Se actualizaron las herramientas de generación de PDF y construcción de la aplicación.",
    ],
    problem: "Una carga duplicada necesitaba corregirse sin permitir que una sola persona eliminara documentación laboral ni sus evidencias.",
    affectedUsers: "Administradores y responsables habilitados para gestionar el historial del personal.",
    usage: "En Equipo > Persona > Historial, usá el escudo rojo para solicitar la anulación e indicá el motivo. Otro administrador deberá autorizarla o rechazarla.",
    examples: ["Una carga duplicada queda pendiente de revisión y, si se autoriza, aparece como anulada sin desaparecer del historial."],
    screenshots: [],
  },
  {
    version: "2.4.8",
    date: "2026-07-14",
    title: "Trazabilidad recuperada y navegación armonizada",
    functions: [
      "La trazabilidad vuelve a mostrar eventos con identificadores numéricos y UUID.",
      "Los errores de carga ahora se informan con una opción visible para reintentar.",
      "El acceso a Actualizaciones distribuye correctamente el nombre y la versión en el menú lateral.",
    ],
    problem: "La vinculación de reportantes intentaba convertir algunos identificadores UUID a número, vaciando la pantalla, y el acceso lateral quedaba demasiado ajustado.",
    affectedUsers: "Administradores que consultan Trazabilidad y usuarios de escritorio.",
    usage: "Ingresá a Trazabilidad para consultar los eventos. Si una carga falla, la pantalla permite reintentar sin confundir el error con un período sin actividad.",
    examples: ["Los eventos de registros, tickets y perfiles conviven en la misma vista sin errores de conversión."],
    screenshots: [],
  },
  {
    version: "2.4.7",
    date: "2026-07-14",
    title: "Trazabilidad identificable y actualizaciones adaptables",
    functions: [
      "Trazabilidad recupera el nombre y correo del reportante cuando el registro proviene de un formulario externo.",
      "La ficha expandida diferencia una identidad autenticada de un reportante declarado en el formulario.",
      "El diálogo de actualización mantiene visibles el encabezado y las acciones y desplaza únicamente el contenido.",
    ],
    problem:
      "Los registros creados por integraciones aparecían como Sistema aunque conservaran los datos del reportante, y el diálogo de actualización podía exceder el alto disponible.",
    affectedUsers:
      "Administradores que consultan Trazabilidad y todos los usuarios que reciben una actualización.",
    usage:
      "En Trazabilidad, desplegá un registro para consultar el origen de la identidad. En Actualizaciones, desplazá el contenido sin perder los botones Entendido y Ver todas.",
    examples: [
      "El registro #2771 muestra a Jazmín Davicini como reportante declarado en el formulario.",
    ],
    screenshots: [],
  },
  {
    version: "2.4.6",
    date: "2026-07-14",
    title: "Gestión documental del historial de personal",
    functions: [
      "Cada registro del historial se puede descargar nuevamente en PDF.",
      "Acciones para compartir por WhatsApp, email o el menú del dispositivo.",
      "Los administradores pueden eliminar cargas duplicadas con confirmación.",
      "El formulario de apercibimiento detecta otro registro de la misma persona y fecha y permite descargar sin duplicar.",
    ],
    problem:
      "Durante la incorporación del nuevo flujo podía generarse dos veces un apercibimiento y luego no existía una forma clara de descargarlo otra vez, compartirlo o corregir el historial.",
    affectedUsers:
      "Administradores y responsables que gestionan documentación del personal.",
    usage:
      "En Equipo > Persona > Historial usá los iconos para descargar, compartir, editar o eliminar un duplicado. Al generar un apercibimiento repetido, elegí Descargar sin duplicar.",
    examples: [
      "Dos apercibimientos de la misma persona y fecha: conservar el correcto y eliminar únicamente el duplicado.",
    ],
    screenshots: [],
  },
  {
    version: "2.4.5",
    date: "2026-07-14",
    title: "Compartir auditorías finalizadas",
    functions: [
      "El perfil administrador puede compartir auditorías finalizadas por WhatsApp y email.",
      "Nuevo acceso a ChatGPT que copia el informe estructurado para su análisis.",
      "Botón Compartir compatible con el menú nativo del celular y la computadora.",
      "El PDF continúa disponible como documento formal de la auditoría.",
    ],
    problem:
      "El resultado de la auditoría quedaba dentro de la aplicación y requería preparar manualmente cada comunicación.",
    affectedUsers:
      "Administradores que comunican auditorías finalizadas y sus planes de acción.",
    usage:
      "Finalizá la auditoría y elegí PDF, WhatsApp, Email, ChatGPT o Compartir. Los enlaces a Fly Gestión siguen requiriendo sesión y permisos.",
    examples: [
      "Compartir por WhatsApp el porcentaje, resumen, conclusiones y hallazgos; enviar el PDF por email para la comunicación formal.",
    ],
    screenshots: [],
  },
  {
    version: "2.4.4",
    date: "2026-07-14",
    title: "Puntaje y cierre ejecutivo de auditorías",
    functions: [
      "La vista de auditoría vuelve a desplazarse correctamente hasta el último punto.",
      "Nuevo resumen de respuestas: cumple, parcial, no cumple y no observado.",
      "Visualización de puntos obtenidos, puntos posibles, porcentaje y resultado.",
      "Campos de resumen ejecutivo y conclusiones incorporados al informe PDF.",
    ],
    problem:
      "Las auditorías extensas no permitían llegar a todos los controles y el cierre no mostraba un resumen comparable al informe externo de Rosario.",
    affectedUsers:
      "Auditores, Calidad, Seguridad e Higiene y responsables que revisan los resultados.",
    usage:
      "Completá el recorrido, revisá Puntaje y resumen final, escribí el cierre ejecutivo, guardá el avance y luego finalizá la auditoría.",
    examples: [
      "Informe de Rosario: porcentaje general, distribución de cumplimientos, desvíos y prioridades del plan de acción.",
    ],
    screenshots: [],
  },
  {
    version: "2.4.3",
    date: "2026-07-14",
    title: "Formularios protegidos contra cierres accidentales",
    functions: [
      "Los formularios operativos ya no se cierran al tocar fuera del cuadro.",
      "Los modales compartidos tampoco se cierran accidentalmente con Escape.",
      "El alta y la edición de auditorías guardan un borrador local mientras se completan.",
      "La protección se aplica en escritorio y mobile.",
    ],
    problem:
      "Un toque fuera del formulario podía cerrar la ventana y eliminar el avance no guardado.",
    affectedUsers:
      "Todos los usuarios que cargan auditorías, tareas, NC, CAPA, requerimientos, personal o mantenimiento.",
    usage:
      "Cerrá un formulario solamente con Cancelar o X. Si se interrumpe una auditoría antes de crearla, al volver a abrir el formulario se recupera el borrador local.",
    examples: [
      "Mover el cursor o tocar el fondo ya no cierra la carga de una auditoría.",
    ],
    screenshots: [],
  },
  {
    version: "2.4.2",
    date: "2026-07-14",
    title: "Control de versión mobile",
    functions: [
      "La versión instalada se muestra en Mi perfil y se incorpora un botón para forzar la actualización sin caché.",
    ],
    problem:
      "En celulares instalados como acceso directo no era evidente qué versión estaba abierta ni existía una acción directa para refrescarla.",
    affectedUsers: "Todos los usuarios de la versión mobile.",
    usage:
      "Abrí Mi perfil para consultar la versión. Si no ves una función reciente, tocá Actualizar aplicación.",
    examples: ["Mi perfil muestra Fly Gestión · versión 2.4.2."],
    screenshots: [],
  },
  {
    version: "2.4.1",
    date: "2026-07-14",
    title: "Auditorías en mobile y alta territorial de personal",
    functions: [
      "Nuevo acceso a Auditorías internas desde Más en la versión mobile.",
      "Formularios de auditoría adaptados a pantallas pequeñas y captura fotográfica desde el teléfono.",
      "El alta de personal preselecciona la sede del encargado y exige una sede dentro de su alcance.",
      "El mismo control de sede se aplica al alta de personas desde mobile.",
    ],
    problem:
      "Las auditorías no figuraban en la navegación mobile y los encargados podían intentar guardar personal sin sede, operación que la seguridad de la base rechazaba.",
    affectedUsers:
      "Auditores que trabajan desde el teléfono y responsables territoriales que administran la dotación de su sede.",
    usage:
      "En mobile ingresá a Más > Auditorías internas. Para agregar personal, verificá la sede preseleccionada antes de guardar.",
    examples: [
      "Jazmín puede agregar personal con Hospital Cruz del Eje asignado; no puede crear personas sin sede ni para otra unidad.",
    ],
    screenshots: [],
  },
  {
    version: "2.4.0",
    date: "2026-07-14",
    title: "Auditorías guiadas con evidencia fotográfica",
    functions: [
      "Captura con la cámara trasera o selección desde la galería en cada punto del checklist.",
      "Evidencias diferenciadas para el hallazgo y para su corrección o cierre.",
      "Edición de fecha, tipo, equipo auditor, objetivo, alcance y normativa.",
      "Guía de avance con cantidad de puntos respondidos y recomendaciones durante el recorrido.",
    ],
    problem:
      "Durante el relevamiento no se podían documentar visualmente los controles en el momento ni corregir los datos generales de una auditoría ya creada.",
    affectedUsers:
      "Auditores, Calidad, Seguridad e Higiene y responsables que aportan evidencias.",
    usage:
      "Abrí una auditoría desde el teléfono, respondé cada punto y usá Tomar foto. Para corregir la cabecera elegí Editar. En los hallazgos separá la evidencia inicial de la evidencia de cierre.",
    examples: [
      "Fotografiar un desvío durante la visita y, luego de corregirlo, agregar la fotografía de cierre en el mismo hallazgo.",
    ],
    screenshots: [],
  },
  {
    version: "2.3.1",
    date: "2026-07-14",
    title: "Selección del equipo auditor",
    functions: [
      "El alta de auditorías permite seleccionar participantes desde la lista de usuarios activos habilitados para auditar.",
    ],
    problem:
      "El equipo auditor se escribía manualmente, lo que permitía errores de nombre o incorporar personas sin el alcance correspondiente.",
    affectedUsers:
      "Administradores, Calidad, Seguridad e Higiene y auditores habilitados.",
    usage:
      "Seleccioná la sede y marcá los integrantes en Equipo auditor / participantes. La lista se ajusta automáticamente al alcance de la sede.",
    examples: [
      "En aeropuertos se puede seleccionar a Miguel Riviere; en otras clases de sede no se ofrece como auditor especial.",
    ],
    screenshots: [],
  },
  {
    version: "2.3.0",
    date: "2026-07-14",
    title: "Auditorías internas por sede",
    functions: [
      "Nueva sección de Auditorías internas dentro de Calidad y en la ficha de cada sede.",
      "Formulario integral con 10 secciones, 29 controles y puntaje ponderado automático.",
      "Registro de hallazgos, responsables, fechas límite y evidencias fotográficas o documentales.",
      "Generación vinculada de no conformidades y planes CAPA desde cada hallazgo.",
      "Informe PDF de la auditoría con resultados, respuestas y acciones.",
    ],
    problem:
      "Las auditorías se documentaban en archivos con formatos diferentes y su seguimiento quedaba separado de las sedes, las no conformidades y los planes de acción.",
    affectedUsers:
      "Administradores, Calidad, Seguridad e Higiene, Miguel Riviere para aeropuertos y responsables territoriales de cada sede.",
    usage:
      "Ingresá a Calidad > Auditorías internas o abrí la ficha de una sede. Creá la auditoría, completá el relevamiento, agregá hallazgos y evidencias, y generá la NC o CAPA cuando corresponda. Finalizá solo cuando el relevamiento esté completo.",
    examples: [
      "Auditoría operativa de comedor con desvío de higiene y evidencia fotográfica.",
      "Auditoría de Seguridad e Higiene con responsable, fecha de corrección y CAPA vinculada.",
    ],
    screenshots: [],
  },
  {
    version: "2.2.4",
    date: "2026-07-14",
    title: "Perfil de Seguridad e Higiene",
    functions: [
      "Nuevo acceso especializado para la responsable de Seguridad e Higiene en todas las sedes.",
      "Gestión de no conformidades, CAPA, tareas y tickets de Mantenimiento.",
      "Consulta de personal para investigar y documentar accidentes personales, sin edición de legajos.",
      "Creación de reportes de bitácora y solicitudes de compra vinculadas a acciones preventivas o correctivas.",
      "Acceso restringido en escritorio y celular, sin administración de usuarios, Flota ni gestión general de RR. HH.",
    ],
    problem:
      "Seguridad e Higiene necesitaba gestionar hallazgos y planes de acción de todas las sedes sin recibir permisos administrativos ni acceso innecesario a información de Recursos Humanos.",
    affectedUsers:
      "Responsable de Seguridad e Higiene y responsables que participan en investigaciones, acciones correctivas y mantenimiento.",
    usage:
      "Ingresá a Calidad para registrar no conformidades y CAPA; usá Pendientes para asignar seguimiento; consultá Personal únicamente cuando sea necesario para un accidente; y generá requerimientos de compra cuando una acción necesite materiales o servicios.",
    examples: [
      "Accidente personal: consultar sede y datos laborales indispensables, registrar la investigación y crear las acciones correspondientes.",
      "Hallazgo preventivo: generar una no conformidad, su CAPA y, si corresponde, un ticket de Mantenimiento o una solicitud de compra.",
    ],
    screenshots: [],
  },
  {
    version: "2.2.3",
    date: "2026-07-14",
    title: "Mi trabajo y avances de Mantenimiento",
    functions: [
      "Nueva vista rápida “Mi trabajo” para consultar los tickets asignados al usuario.",
      "El acceso de Gestión Mantenimiento respeta las sedes asignadas al perfil.",
      "Los tickets incorporan un acceso visible para comentar o informar avances.",
      "La experiencia está disponible en escritorio y celular.",
    ],
    problem:
      "El personal de Mantenimiento debía recorrer todos los tickets y la opción para comentar podía pasar inadvertida dentro de la ficha.",
    affectedUsers: "Responsables y personal de Gestión Mantenimiento.",
    usage:
      "Entrá en Mantenimiento > Tickets y activá “Mi trabajo”. Abrí un ticket y usá “Agregar comentario o informar un avance” para registrar novedades y mencionar a otros usuarios.",
    examples: [
      "Revisión realizada; se necesita repuesto. Próxima visita: 16/07/2026.",
    ],
    screenshots: [],
  },
  {
    version: "2.2.2",
    date: "2026-07-14",
    title: "Notificaciones de menciones en registros",
    functions: [
      "Las menciones @usuario en comentarios de registros generan una notificación interna.",
    ],
    problem:
      "Los comentarios se guardaban, pero el usuario mencionado no recibía el aviso cuando el comentario pertenecía a un registro de la bitácora.",
    affectedUsers: "Usuarios mencionados en comentarios de registros.",
    usage:
      "Escribí @ y seleccioná a la persona de la lista. Al enviar, verá el aviso en la campana y, si tiene push activo, también en su dispositivo.",
    examples: ["@Jazmín Davicini, por favor revisá este registro."],
    screenshots: [],
  },
  {
    version: "2.2.1",
    date: "2026-07-14",
    title: "Autoría y fecha de creación de tareas",
    functions: [
      "Las tareas nuevas registran quién las creó.",
      "Las tarjetas y el listado muestran autor y fecha de creación.",
      "La información está disponible en escritorio y mobile.",
    ],
    problem:
      "Las tareas mostraban responsable y vencimiento, pero no permitían identificar quién las había generado ni cuándo se habían dado de alta.",
    affectedUsers: "Todos los usuarios que consultan o gestionan tareas.",
    usage:
      "Abrí una tarea para consultar “Creada por” y “Creada el”. En el listado de escritorio, ambas columnas aparecen en pantallas amplias.",
    examples: [
      "Las tareas históricas conservan su fecha y muestran “Autor no registrado” cuando el dato nunca fue almacenado.",
    ],
    screenshots: [],
  },
  {
    version: "2.2.0",
    date: "2026-07-14",
    title: "Fly Gestión y comunicación de actualizaciones",
    functions: [
      "Nueva sección independiente de Actualizaciones.",
      "Aviso automático al ingresar cuando existe una versión no vista.",
      "Nueva identidad general Fly Gestión, conservando la bitácora como módulo operativo.",
      "Versión visible unificada en toda la aplicación.",
    ],
    problem:
      "Las mejoras del sistema se comunicaban fuera de la aplicación y el nombre anterior ya no representaba el alcance integral de la plataforma.",
    affectedUsers: "Todos los usuarios de escritorio y mobile.",
    usage:
      "Al ingresar, revisá la ficha de la nueva versión y elegí “Entendido”. Después podés volver a consultarla desde Actualizaciones. Los avisos operativos continúan en el Tablón.",
    examples: [
      "Tablón: cortes de servicio, cambios de horario y avisos para sedes.",
      "Actualizaciones: nuevas funciones, cambios de uso y mejoras de Fly Gestión.",
    ],
    screenshots: [],
  },
];

export const LATEST_RELEASE = RELEASES[0];

export function releaseSeenKey(userId) {
  return `fly-gestion.release-seen.${userId || "anonymous"}`;
}

export function hasSeenLatestRelease(userId) {
  return (
    localStorage.getItem(releaseSeenKey(userId)) === LATEST_RELEASE.version
  );
}

export function markLatestReleaseSeen(userId) {
  localStorage.setItem(releaseSeenKey(userId), LATEST_RELEASE.version);
}
