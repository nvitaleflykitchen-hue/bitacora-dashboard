export const APP_NAME = "Fly Gestión";
export const APP_VERSION = "2.5.0";

export const RELEASES = [
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
