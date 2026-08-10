// Central de Ayuda — contenido estático del manual de uso
// Organizado por módulo. Cada módulo tiene: id, label, icon, intro y secciones[].
// Cada sección tiene: title y body (array de párrafos o bloques).

export const HELP_MANUAL_UPDATED_AT = '2026-08-10'

export const HELP_MODULES = [
  {
    id: 'general',
    label: 'Primeros pasos',
    icon: '🚀',
    intro: 'Todo lo que necesitás saber para empezar a usar Fly Gestión.',
    sections: [
      {
        title: '¿Qué es Fly Gestión?',
        body: [
          'Fly Gestión es la plataforma integral de gestión de la empresa. La bitácora operativa es su base para registrar novedades y mantener trazabilidad, y se complementa con tareas, personal, mantenimiento, flota, calidad, compras e Investigación y Desarrollo (I+D).',
          'Cada área tiene su módulo. Dependiendo de tu rol (encargado, sede, flota, etc.) vas a ver solo lo que te corresponde.',
        ],
      },
      {
        title: 'Cómo iniciar sesión',
        body: [
          '1. Abrí la app en tu dispositivo (celular o computadora).',
          '2. Ingresá tu email y contraseña. Si es tu primer ingreso, usá la contraseña que te dio el administrador.',
          '3. El sistema te puede pedir que cambies la contraseña al ingresar por primera vez.',
          'Si no podés ingresar, contactá al administrador para verificar que tu cuenta esté activa.',
        ],
      },
      {
        title: 'Cambiar tu contraseña',
        body: [
          'En cualquier momento podés cambiar tu contraseña desde el footer del menú lateral (escritorio) o desde el ícono de llave en la parte inferior izquierda.',
          'La contraseña debe tener al menos 6 caracteres.',
        ],
      },
      {
        title: 'Orientarse en la aplicación',
        body: [
          'En escritorio, el menú lateral reúne los módulos principales. Las funciones menos frecuentes aparecen dentro de Más o Más herramientas para mantener las pantallas despejadas.',
          'En celular, la barra inferior muestra las cinco áreas de uso habitual. Abrí Más para encontrar Trabajo diario, Gestión e Información y cuenta.',
          'La aplicación conserva por usuario la última sección y los filtros principales. Si querés volver al estado inicial, usá Limpiar filtros en la pantalla correspondiente.',
          'El resumen superior de alertas agrupa los avisos por destino. Elegí Ver alertas para desplegar el detalle y entrar al módulo que requiere atención.',
        ],
      },
      {
        title: 'Ayuda y actualizaciones',
        body: [
          'El botón ? abre esta Central de ayuda desde cualquier pantalla. Elegí un módulo en el índice o usá Imprimir para obtener el manual completo y guardarlo como PDF.',
          'Actualizaciones explica qué cambió en cada versión y cómo usarlo. El Tablón se reserva para comunicaciones operativas, avisos de sedes y cumpleaños.',
        ],
      },
    ],
  },
  {
    id: 'reporte',
    label: 'Nuevo Reporte',
    icon: '📋',
    intro: 'Cómo registrar una novedad del turno, con fotos, escalamiento y seguimiento.',
    sections: [
      {
        title: '¿Qué es un reporte?',
        body: [
          'Un reporte (o novedad) es cualquier evento que ocurre durante el turno que amerita quedar registrado: un incidente, un problema de mantenimiento, una novedad de personal, una entrega, etc.',
          'Los reportes quedan registrados en la bitácora y pueden ser escalados al área correspondiente.',
        ],
      },
      {
        title: 'Crear un nuevo reporte',
        body: [
          '1. Desde el celular: tocá el botón verde "Nuevo Reporte" en la pantalla principal.',
          '2. Desde la computadora: usá el botón "Nuevo Reporte" en la parte superior del menú lateral.',
          '3. Completá el formulario: elegí la sede, el módulo (Operaciones, Personal, Mantenimiento, Vehículos, etc.) y describí la novedad.',
          '4. Podés adjuntar fotos o imágenes desde la cámara o la galería.',
          '5. Si la novedad requiere acción de otra área, usá el botón "Escalar" para derivarla (Mantenimiento, Calidad, Compras, etc.).',
          '6. Tocá "Enviar" para guardar el reporte.',
        ],
      },
      {
        title: 'Crear una novedad desde una ficha',
        body: [
          'Desde la ficha de una persona, sede, activo o vehículo elegí Crear novedad. La aplicación preselecciona la sede y la entidad de origen y las valida contra tu alcance antes de habilitar el envío.',
          'Completá la descripción y los datos propios del módulo. Después de guardar, volverás a la ficha desde la que comenzaste.',
          'Los borradores contextuales se guardan separados de un reporte general. Antes de enviar, verificá siempre que el encabezado muestre la entidad correcta.',
        ],
      },
      {
        title: 'Borradores, errores y recuperación',
        body: [
          'En celular, Nuevo Reporte guarda automáticamente la carga en el dispositivo. Si cerrás o cambiás de pantalla, al volver con el mismo usuario se ofrece recuperar el borrador.',
          'Los adjuntos no se guardan dentro del borrador por seguridad del navegador: después de recuperar una carga, seleccioná nuevamente fotos y archivos.',
          'Si faltan datos obligatorios, revisá el resumen de errores y usá sus accesos para ir directamente a cada campo. Elegí Descartar sólo cuando quieras comenzar de cero.',
          'Al enviarse correctamente, el borrador se elimina. Mientras se procesa el envío, no vuelvas a tocar el botón: la aplicación bloquea los dobles envíos inmediatos.',
        ],
      },
      {
        title: 'Dotación del turno o novedad de una persona',
        body: [
          'Usá “Dotación y cobertura del turno” para informar la situación general del equipo durante ese turno: dotación insuficiente, puestos sin cubrir, reemplazos, reorganización o impacto en el servicio.',
          'Usá “Novedades de personal” cuando el hecho corresponda a una persona concreta. Seleccioná a la persona y registrá la categoría correspondiente: ausentismo, llegada tarde, desempeño, conducta u otro.',
          'Ejemplo: si faltó una persona y fue necesario reorganizar el turno, registrá la cobertura general en Dotación y agregá la ausencia individual en Novedades de personal. De esta forma, ambos hechos quedan vinculados en un mismo reporte sin mezclar sus finalidades.',
        ],
      },
      {
        title: 'Adjuntar fotos',
        body: [
          'En el formulario de reporte hay un campo para adjuntar imágenes. Podés tomar una foto en el momento o elegir una de la galería.',
          'Tip: una foto vale más que mil palabras. Siempre adjuntá evidencia visual cuando haya daños, roturas o situaciones que requieran intervención.',
        ],
      },
      {
        title: 'Escalar una novedad',
        body: [
          'Escalar significa derivar la novedad a otra área para que tomen acción. Al escalar, seleccionás el área destino (Mantenimiento, Calidad, Compras, etc.) y opcionalmente agregás una nota adicional.',
          'El área escalada recibe una alerta y puede gestionar el caso desde su módulo correspondiente.',
          'Podés ver el estado del escalamiento desde la sección Pendientes.',
        ],
      },
    ],
  },
  {
    id: 'tablon',
    label: 'Tablón',
    icon: '📌',
    intro: 'Anuncios operativos dirigidos a toda la organización o a sedes específicas.',
    sections: [
      {
        title: '¿Qué es el Tablón?',
        body: [
          'El Tablón muestra comunicaciones operativas publicadas por administradores para toda la organización, grupos o sedes específicas.',
          'Las nuevas versiones y cambios de funciones se consultan por separado en Actualizaciones.',
        ],
      },
      {
        title: 'Anuncios y alcance',
        body: [
          'Cada usuario ve los anuncios destinados a su alcance. Un anuncio puede incluir texto, imágenes y archivos.',
          'Al abrir el Tablón, los anuncios pendientes quedan marcados como leídos.',
        ],
      },
      {
        title: 'Qué no se publica acá',
        body: [
          'Las versiones, funciones nuevas y cambios de uso se publican en Actualizaciones.',
          'Las novedades de turno continúan en la bitácora operativa y sus vistas de seguimiento.',
        ],
      },
    ],
  },
  {
    id: 'pendientes',
    label: 'Bandeja',
    icon: '⏳',
    intro: 'Bandeja única para priorizar tareas, CAPA, proyectos, escalamientos, tickets y compras.',
    sections: [
      {
        title: '¿Qué muestra la Bandeja?',
        body: [
          'La Bandeja reúne el trabajo que requiere seguimiento: tareas, CAPA, proyectos, escalamientos, tickets y compras, respetando tus permisos y sedes.',
          'Los indicadores Total, Vencidos/alta, Sin responsable, Próximos 7 días y Míos aplican el filtro correspondiente con un solo clic.',
          'Cuando un escalamiento ya generó un ticket vinculado, se muestra el ticket como trabajo operativo y no se duplica el pendiente.',
        ],
      },
      {
        title: 'Cumpleaños del equipo',
        body: [
          'El Tablón muestra los cumpleaños de hoy y los próximos siete días usando la fecha de nacimiento registrada en la ficha privada de RR. HH.',
          'Durante el cumpleaños, si la persona tiene teléfono cargado, elegí Saludar para abrir WhatsApp con un mensaje preparado. Revisalo antes de enviarlo: la aplicación no envía mensajes automáticamente.',
        ],
      },
      {
        title: 'Filtrar y retomar el trabajo',
        body: [
          'Elegí el foco, área, prioridad, vista o búsqueda que necesites. La Bandeja conserva esa selección por usuario cuando entrás a un elemento y luego regresás.',
          'Usá Limpiar filtros para quitar todas las condiciones y recuperar la vista general. Un estado vacío debe indicar si no existe trabajo o si los filtros no encontraron resultados.',
          'Los estados comparten seis conceptos: Pendiente, En curso, Bloqueado, Observado, Finalizado y Cancelado. La etapa particular del módulo puede aparecer como información secundaria.',
        ],
      },
      {
        title: 'Resolver un escalamiento',
        body: [
          '1. Entrá a Bandeja y buscá el escalamiento en cuestión.',
          '2. Abrilo para ver el detalle de la novedad original.',
          '3. Agregá una respuesta o resolución y marcalo como resuelto.',
          '4. El área que escaló recibirá la notificación.',
        ],
      },
      {
        title: 'Escalamientos vencidos',
        body: [
          'Los escalamientos que superan el plazo configurado sin respuesta se marcan en rojo como "vencidos" y generan una alerta en el sistema.',
          'Revisá la Bandeja regularmente para evitar acumulación.',
        ],
      },
    ],
  },
  {
    id: 'sedes',
    label: 'Sedes',
    icon: '🏢',
    intro: 'Vista por sede: cumplimiento, novedades y estado general de cada local.',
    sections: [
      {
        title: 'Informe por sede',
        body: [
          'Desde Sedes podés acceder a un informe detallado de cada local: novedades del período, cumplimiento de registros, tickets de mantenimiento abiertos, etc.',
          'Es útil para encargados y gestores que supervisan múltiples sedes.',
        ],
      },
      {
        title: 'Registro de empleados y vehículos',
        body: [
          'Cada sede puede tener asociado su directorio de empleados y vehículos. Desde la ficha de la sede podés acceder a novedades de personal.',
        ],
      },
    ],
  },
  {
    id: 'equipo',
    label: 'Equipo y RR. HH.',
    icon: '👥',
    intro: 'Fichas del personal, documentación, evaluaciones, historial laboral, organigrama, credenciales y formularios disciplinarios.',
    sections: [
      {
        title: 'Ficha de una persona',
        body: [
          'Ingresá a Equipo, buscá a la persona y abrí su ficha. Las pestañas reúnen datos y puesto, documentación, evaluaciones, historial, logros, RR. HH. y formularios.',
          'Usá el lápiz junto al nombre para corregir datos personales, puesto, área o sedes asignadas. Una persona puede pertenecer a más de una sede.',
          'No elimines una ficha con actividad vinculada. Usá “Enviar a obsoletos” o el flujo de baja para retirarla del equipo activo conservando su trazabilidad.',
        ],
      },
      {
        title: 'Navegación y acciones de la ficha',
        body: [
          'La ficha deja visible Mensaje como contacto frecuente. Abrí Más acciones para Llamar, Email, Credencial y operaciones administrativas.',
          'Las pestañas principales reúnen Info y puesto, Documentación, Evaluaciones, Historial y RR. HH. Logros y Formularios se encuentran dentro de Más.',
          'Desde Crear novedad podés registrar un hecho de esa persona con la sede y la ficha ya seleccionadas. Al guardar, regresás a la misma persona.',
        ],
      },
      {
        title: 'Documentación y ficha privada de RR. HH.',
        body: [
          'Documentación permite registrar requisitos, vencimientos y evidencias de la persona. Los avisos muestran documentos vencidos o próximos a renovar.',
          'La pestaña RR. HH. contiene información privada y está reservada a perfiles autorizados. No debe usarse para observaciones operativas generales.',
          'El Historial conserva antecedentes laborales, reconocimientos, apercibimientos, suspensiones y sus documentos. Los registros formales no se eliminan: cuando corresponde se solicita su anulación con trazabilidad.',
        ],
      },
      {
        title: 'Evaluaciones objetivas y biblioteca',
        body: [
          'La pestaña Análisis reemplaza el ranking. Muestra cobertura y calidad de las evaluaciones, sin comparar personas ni entregar medallas por información incompleta.',
          'Antes de guardar, el control de objetividad revisa período, evaluador, evidencia para puntajes altos o bajos, expresiones genéricas y oportunidad de seguimiento. La app señala qué corregir, pero no modifica calificaciones automáticamente.',
          'En Recursos están disponibles los instructivos vigentes y el cuaderno de NotebookLM. Los mismos accesos aparecen dentro del formulario para consultar los criterios mientras se evalúa.',
          '“Solicitar revisión” copia un mensaje con las observaciones detectadas para enviarlo al evaluador. La validación definitiva y la devolución continúan siendo responsabilidad humana.',
        ],
      },
      {
        title: 'Apercibimientos',
        body: [
          'En Formularios, el encargado describe objetivamente el hecho y puede agregar descargo, evidencia, fundamento y texto propuesto. Un administrador revisa y aprueba o rechaza la solicitud.',
          'Después de la aprobación, descargá el PDF, notificá al trabajador y confirmá “Fue notificado”. Esa confirmación crea el antecedente en Historial.',
          'Una vez notificado, adjuntá la copia firmada. El mismo documento se visualiza desde Formularios y desde el registro correspondiente del Historial.',
        ],
      },
      {
        title: 'Suspensiones firmadas',
        body: [
          'En Formularios → Suspensiones firmadas indicá el primer día, la cantidad de días y el motivo. El sistema calcula la fecha final y el día de reintegro.',
          'Elegí el archivo firmado o usá “Tomar foto”. Al registrar, se crea automáticamente el antecedente de tipo Suspensión y el documento queda vinculado en Historial.',
          'Las suspensiones ya registradas se muestran en la misma sección con sus fechas, reintegro, motivo y adjuntos.',
        ],
      },
      {
        title: 'Período de prueba, bajas y obsoletos',
        body: [
          'La pestaña Período de prueba ordena al personal por vencimiento y muestra la cuenta regresiva para facilitar el seguimiento.',
          'Para una baja laboral, registrá fecha, motivo y observaciones. La persona sale de la nómina activa sin perder evaluaciones, documentos ni historial.',
          '“Enviar a obsoletos” se usa para fichas que deben quedar inactivas pero conservar sus vínculos. Las fichas inactivas se consultan en Historial de bajas y pueden reactivarse.',
        ],
      },
      {
        title: 'Organigrama',
        body: [
          'El Organigrama abre un editor visual de pantalla completa. Permite ubicar personas y unidades, crear conexiones y representar funciones transversales como Calidad.',
          'Guardá los cambios antes de salir. Usá la exportación PDF para obtener una versión legible destinada a impresión o comunicación.',
        ],
      },
      {
        title: 'Credenciales',
        body: [
          'Desde la ficha individual se puede emitir o consultar la credencial de una persona autorizada.',
          'La pestaña Credenciales emitidas permite filtrar, seleccionar varias credenciales y descargar hojas A4 con frentes, dorsos y guías de corte para impresión doble faz.',
        ],
      },
      {
        title: 'Informes de personal y gestión',
        body: [
          'Informe de novedades reúne novedades del período y antecedentes disciplinarios vinculados a las personas y sedes seleccionadas.',
          'En el tablero global, Informe de gestión permite elegir fechas, una o varias sedes y los temas del resumen: Operación, Escalamientos, Mantenimiento, Flota, Compras, Calidad, Tareas y RR. HH.',
          'Para el seguimiento mensual, elegí el primer y último día del mes y usá Calcular indicadores. La vista Global empresa consolida los casos reales de todas las sedes seleccionadas; el selector también permite abrir el resultado individual de cada sede.',
          'El índice mensual pondera Cumplimiento (30%), Documentación (20%), Gestión (25%), Compromiso operativo (15%) y Mejora continua (10%). Cada indicador muestra su numerador y denominador. Cuando no existen casos aplicables se informa S/D y ese eje no reduce el promedio.',
          'El PDF incluye únicamente el alcance seleccionado. Revisá siempre el período y las sedes antes de descargarlo.',
        ],
      },
    ],
  },
  {
    id: 'mantenimiento',
    label: 'Mantenimiento',
    icon: '🔧',
    intro: 'Gestión completa del ciclo de mantenimiento: tickets, activos, planes preventivos, matafuegos, insumos y proveedores.',
    sections: [
      {
        title: 'Tickets de mantenimiento',
        body: [
          'Un ticket es una solicitud de trabajo o reparación. Puede crearse manualmente o a partir de una novedad escalada.',
          'Cada ticket tiene: sede, descripción, prioridad (baja / media / alta / urgente), estado (abierto / en proceso / resuelto) y responsable.',
          'Desde la vista de Tickets podés filtrar por estado, sede y prioridad.',
        ],
      },
      {
        title: 'Coordinación global de Mantenimiento',
        body: [
          'Un administrador puede dar alcance de Mantenimiento para todas las sedes sin modificar el rol principal ni ampliar permisos en otros módulos.',
          'La habilitación se realiza en Usuarios, columna Mantenimiento, mediante Todas las sedes. Después del cambio, el usuario debe cerrar sesión y volver a ingresar.',
          'El alcance global permite coordinar tickets, activos, preventivos, insumos, proveedores y responsables de Mantenimiento. Pablo Fernández está configurado como coordinador de segundo nivel.',
        ],
      },
      {
        title: 'Trabajo desde el celular',
        body: [
          'Los usuarios de Gestión Mantenimiento ingresan directamente a Mi trabajo y solo ven los tickets que tienen asignados.',
          'Abrí un ticket y tocá Iniciar trabajo. Registrá el diagnóstico o la tarea realizada y agregá fotos, archivos o comentarios como evidencia.',
          'Cuando el trabajo esté terminado, tocá Finalizar trabajo. El sistema exige una descripción del trabajo realizado y conserva el ticket en Historial.',
          'La cámara del teléfono se abre desde Evidencias → Tomar foto. Si el navegador solicita permiso, elegí Permitir.',
        ],
      },
      {
        title: 'Activos y equipos',
        body: [
          'El inventario de activos incluye todos los equipos e instalaciones de cada sede: cámaras, freezers, equipos de frío, instalaciones eléctricas, etc.',
          'Podés ver el historial de mantenimiento de cada activo y programarle planes preventivos.',
          'Para registrar un activo: Mantenimiento → Activos → Nuevo.',
          'Desde la ficha de un activo elegí Crear novedad para informar una falla sin volver a seleccionar equipo ni sede. También podés asociar un activo desde Equipos / Mantenimiento al crear un reporte general.',
        ],
      },
      {
        title: 'Planes preventivos',
        body: [
          'Los planes preventivos son rutinas de mantenimiento programadas (limpieza de filtros, calibración, etc.). Se asignan a un activo con una frecuencia (mensual, trimestral, anual).',
          'Desde el Tablero Kanban podés ver qué tareas están pendientes, en proceso o completadas.',
        ],
      },
      {
        title: 'Matafuegos',
        body: [
          'El registro de matafuegos incluye todos los extintores de las sedes: código, tipo, capacidad, fecha de vencimiento y estado.',
          'Los matafuegos próximos a vencer o vencidos aparecen destacados en rojo o naranja.',
          'Para actualizar el estado tras una recarga: abrí el matafuego correspondiente y editá la fecha de vencimiento y última recarga.',
        ],
      },
      {
        title: 'Proveedores e insumos',
        body: [
          'Desde Proveedores podés registrar los contactos de servicio técnico y sus especialidades.',
          'Insumos lleva el stock de repuestos y materiales usados en mantenimiento.',
        ],
      },
    ],
  },
  {
    id: 'flota',
    label: 'Flota',
    icon: '🚚',
    intro: 'Gestión de la flota vehicular: vehículos, documentación, matafuegos por vehículo, planes preventivos y tickets.',
    sections: [
      {
        title: 'Resumen de Flota',
        body: [
          'La pantalla de Resumen muestra el estado general de la flota: vehículos activos, tickets abiertos, documentos vencidos o por vencer, matafuegos vencidos.',
          'Los indicadores en rojo requieren atención inmediata.',
        ],
      },
      {
        title: 'Registro de vehículos',
        body: [
          'En la pestaña Vehículos podés ver todos los vehículos de la flota con sus datos: dominio (patente), modelo, año, y fechas de vencimiento de seguro, VTV, SENASA y RTO.',
          'Para agregar un vehículo: botón "+ Nuevo".',
          'Cuando una fecha de vencimiento está próxima o vencida, el sistema la resalta automáticamente.',
        ],
      },
      {
        title: 'Documentos y POEs',
        body: [
          'La pestaña Documentos centraliza toda la documentación de la flota: POEs (Procedimientos Operativos Estándar), seguros, manuales, documentación de circulación, etc.',
          'Para subir un PDF: Documentos → "+ Nuevo" → completá título, tipo y vehículo (o dejalo en "General") → Guardar → aparece el panel para adjuntar el archivo.',
          'Importante: el archivo se adjunta después de guardar el documento por primera vez.',
          'Los documentos con fecha de vencimiento se resaltan cuando están próximos a vencer (30 días) o ya vencidos.',
        ],
      },
      {
        title: 'Matafuegos de la flota',
        body: [
          'Cada vehículo puede tener uno o más matafuegos registrados. En la pestaña Matafuegos podés ver todos los extintores de la flota con su estado y fecha de vencimiento.',
          'Para agregar un matafuego: "+ Nuevo" → seleccioná el vehículo y completá los datos.',
        ],
      },
      {
        title: 'Tickets de flota',
        body: [
          'Los tickets de la pestaña Tickets corresponden a novedades o solicitudes de mantenimiento de vehículos.',
          'Se crean automáticamente cuando se escala una novedad de vehículo, o manualmente desde esta pantalla.',
        ],
      },
      {
        title: 'Historial por vehículo y PDF',
        body: [
          'Ingresá a Flota → Tickets y elegí Por unidad. Seleccioná un vehículo para reunir sus tickets abiertos y resueltos, novedades operativas, kilometraje y costos registrados.',
          'Usá Exportar PDF para descargar la ficha histórica con estados, prioridades, diagnósticos, responsables, costos y novedades.',
          'Desde la ficha del vehículo también podés elegir Crear novedad. La unidad queda preseleccionada y, después de guardar, volvés a su ficha.',
        ],
      },
      {
        title: 'Mantenimiento preventivo',
        body: [
          'La pestaña Preventivo muestra los planes de mantenimiento programados para vehículos: revisiones periódicas, cambios de aceite, etc.',
          'Los planes se crean y gestionan igual que en el módulo de Mantenimiento general.',
        ],
      },
    ],
  },
  {
    id: 'calidad',
    label: 'Calidad',
    icon: '✅',
    intro: 'No conformidades y acciones correctivas/preventivas (CAPA) para la mejora continua.',
    sections: [
      {
        title: 'Auditorías internas',
        body: [
          'Desde Calidad → Auditorías internas podés programar una auditoría y seleccionar la sede, fecha, tipo y plantilla. La misma sección también aparece dentro de la ficha de cada sede.',
          'Cada punto se evalúa como Cumple, Parcial, No cumple o No observado. Los puntos Parcial o No cumple deben llevar una observación y pueden originar un hallazgo con criticidad, responsable, plazo y evidencia.',
          'Calidad y Seguridad e Higiene pueden auditar todas las sedes. Miguel Riviere puede gestionar auditorías de aeropuertos. Los responsables territoriales pueden consultar y aportar respuestas o evidencias en sus sedes.',
          'Desde el celular, usá “Tomar foto” debajo de cada punto para abrir la cámara trasera. También podés elegir imágenes de la galería o adjuntar documentos.',
          'En mobile, cada punto aparece como un paso independiente. Elegí el resultado, describí los desvíos y usá Guardar y seguir: el avance se guarda antes de abrir el punto siguiente.',
          'Si interrumpís el recorrido, al volver se abre el primer punto pendiente. La revisión final muestra el resumen y no permite finalizar mientras queden puntos sin responder.',
          'En los hallazgos, cargá por separado la evidencia inicial y la evidencia de corrección o cierre. Usá “Editar” para actualizar los datos generales sin cambiar la plantilla.',
          'Desde un hallazgo se puede generar una No Conformidad y su CAPA. La auditoría se considera finalizada cuando el relevamiento, los hallazgos y el porcentaje estén completos; el cierre definitivo requiere verificar las acciones.',
        ],
      },
      {
        title: 'No conformidades',
        body: [
          'Una no conformidad es cualquier desviación respecto a los estándares operativos, de calidad o normativos.',
          'Para registrar una: Calidad → No Conformidades → "+ Nueva".',
          'Completá: título, descripción, área afectada, causa raíz (si se conoce) y adjuntá evidencia.',
        ],
      },
      {
        title: 'CAPA (Acciones Correctivas y Preventivas)',
        body: [
          'El módulo CAPA permite registrar y hacer seguimiento de las acciones tomadas para resolver no conformidades y evitar que se repitan.',
          'Cada CAPA tiene: descripción de la acción, responsable, fecha límite y estado de cumplimiento.',
          'Las CAPA vencidas o próximas a vencer aparecen destacadas.',
          'Las altas de No Conformidades y CAPA guardan borradores locales durante siete días. Al regresar desde el mismo dispositivo podés recuperar la carga, excepto los adjuntos.',
        ],
      },
    ],
  },
  {
    id: 'id',
    label: 'I+D',
    icon: '🧪',
    intro: 'Gestión trazable de desarrollos, versiones, pruebas, opiniones y validaciones técnicas.',
    sections: [
      {
        title: 'Qué se gestiona en I+D',
        body: [
          'El módulo I+D centraliza desarrollos de productos, materias primas, proveedores, procesos, costos, rendimiento, presentación, vida útil, conservación y requerimientos especiales.',
          'Cada proyecto tiene un código único, objetivo, categoría, origen, responsable, sede o alcance corporativo, prioridad, fecha objetivo, etapa, situación y próximo paso.',
          'El tablero muestra proyectos activos, pendientes de validación, demorados y pausados. Usá Proyectos para buscar y filtrar el historial completo.',
        ],
      },
      {
        title: 'Crear y organizar un proyecto',
        body: [
          '1. Ingresá a I+D y elegí Nuevo proyecto.',
          '2. Describí el desarrollo y su objetivo verificable. Seleccioná categoría, origen, responsable, sede, prioridad y fecha objetivo.',
          '3. Definí un próximo paso concreto para que el proyecto no quede detenido sin una acción visible.',
          '4. Dentro del proyecto, actualizá la etapa y la situación a medida que avance. Las etapas van desde Idea hasta Seguimiento.',
          'En Equipo, elegí Incorporar y buscá personas por nombre, apellido, puesto o correo. Se pueden incorporar empleados aunque todavía no tengan acceso a la aplicación; solamente quienes tengan usuario podrán editar o recibir tareas dentro de la app.',
        ],
      },
      {
        title: 'Versiones y pruebas',
        body: [
          'Antes de ensayar una alternativa, creá una versión con su formulación, cambios y proceso. Las versiones conservan el historial técnico y no se reemplazan entre sí.',
          'Para registrar una prueba, completá fecha, versión, proveedor, proceso realizado y las mediciones que correspondan: temperatura, tiempo, rendimiento, merma y costo.',
          'En Participantes y opiniones, buscá a cada persona y registrá su opinión individual: aprobar, aprobar con ajustes, repetir la prueba o rechazar. También podés agregar el motivo u observación de cada participante.',
          'El resultado de la prueba se calcula automáticamente por mayoría. Ante un empate, la aplicación aplica el criterio más conservador. El responsable no modifica ese resultado: redacta una conclusión técnica a partir de las opiniones y mediciones y, cuando corresponde, define el próximo ajuste.',
          'Las pruebas históricas creadas antes de incorporar las opiniones individuales continúan visibles con su resultado original.',
        ],
      },
      {
        title: 'Validaciones técnicas',
        body: [
          'Solicitá una validación cuando exista una versión o definición que deba ser revisada por Calidad, Producción, Operaciones, Costos, Compras, Cliente o Dirección.',
          'Seleccioná el área, el validador responsable y la versión a validar. La validación queda pendiente hasta que responda la persona asignada.',
          'El validador debe elegir una decisión y desarrollar un fundamento técnico indicando qué revisó, qué evidencia consideró y por qué corresponde esa decisión. No se admite resolver la validación con un clic sin explicación.',
          'Si la decisión es Aprobado con condiciones, también debe detallar la condición o el ajuste requerido. El fundamento y las condiciones quedan visibles en el proyecto para mantener trazabilidad.',
          'El responsable del proyecto puede solicitar y consultar validaciones, pero no debe responder en nombre del validador asignado.',
          'Si una validación fue cargada por error o solamente como prueba, un administrador puede retirarla desde la tarjeta de validación. La aplicación solicita confirmación antes de eliminarla.',
        ],
      },
      {
        title: 'Actividad, archivos y criterios de cierre',
        body: [
          'Actividad y archivos reúne adjuntos, comentarios e historial de eventos. Usá esta pestaña para conservar fichas técnicas, cotizaciones, imágenes, resultados, informes y acuerdos vinculados al desarrollo.',
          'Un proyecto debe avanzar de etapa solamente cuando la evidencia necesaria esté registrada. Una prueba aprobada no reemplaza las validaciones requeridas y una validación favorable no reemplaza las mediciones de la prueba.',
          'Antes de completar el proyecto, verificá que exista una versión definida, pruebas suficientes, conclusiones, validaciones aplicables y un próximo paso de implementación o seguimiento.',
        ],
      },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: '🛒',
    intro: 'Solicitudes de compra y requerimientos de insumos o servicios.',
    sections: [
      {
        title: 'Crear un requerimiento',
        body: [
          '1. Desde el módulo Compras → "+ Nuevo requerimiento".',
          '2. Describí qué necesitás: producto/servicio, cantidad, urgencia y sede.',
          '3. El requerimiento queda en estado "Pendiente" hasta que un encargado o editor lo gestione.',
          'También podés crear un requerimiento al escalar una novedad: elegí "Compras" como área destino.',
          'El formulario guarda un borrador local. Si muestra un resumen de errores, seleccioná cada aviso para completar directamente el campo pendiente.',
        ],
      },
      {
        title: 'Contactos rápidos',
        body: [
          'Abrí Contactos para llamar, enviar WhatsApp o escribir un email sin salir del módulo.',
          'Administradores y editores pueden elegir Editar contactos para agregar, modificar o desactivar registros, vincularlos con usuarios y asignarlos a una o varias sedes.',
          'Al cerrar la edición, el directorio se actualiza para mostrar los cambios recientes.',
        ],
      },
      {
        title: 'Estados de un requerimiento',
        body: [
          '• Pendiente: cargado, sin gestión.',
          '• En proceso: está siendo cotizado o gestionado.',
          '• Aprobado: fue autorizado para su compra.',
          '• Resuelto: el pedido fue realizado o el insumo fue entregado.',
          '• Rechazado: no procede o fue cancelado.',
        ],
      },
    ],
  },
  {
    id: 'mobile',
    label: 'Uso desde el celular',
    icon: '📱',
    intro: 'Accesos rápidos, favoritos, recientes y recuperación segura del trabajo en mobile.',
    sections: [
      {
        title: 'Navegación principal',
        body: [
          'La barra inferior reúne cinco destinos de uso frecuente. Las demás funciones están en Más, ordenadas como Trabajo diario, Gestión e Información y cuenta.',
          'La primera apertura de un módulo puede mostrar Cargando sección durante un instante. Es normal: mobile descarga cada sección cuando realmente se necesita.',
          'La aplicación recuerda la última pestaña, el módulo abierto dentro de Más y los filtros principales para que puedas retomar el trabajo.',
        ],
      },
      {
        title: 'Favoritos y recientes',
        body: [
          'En Más, tocá la estrella de un módulo para fijarlo en Favoritos. Los últimos cuatro módulos utilizados aparecen automáticamente en Recientes.',
          'Favoritos y recientes pertenecen al usuario en ese dispositivo y sólo muestran opciones que sus permisos permiten.',
          'Usá Limpiar recientes cuando quieras borrar ese historial. Esta acción no elimina favoritos ni datos operativos.',
        ],
      },
      {
        title: 'Formularios y conexión',
        body: [
          'Nuevo Reporte, tareas, compras, tickets, No Conformidades, CAPA y otros formularios extensos pueden conservar un borrador local según el tipo de carga.',
          'Un aviso indica si se recuperó o guardó un borrador. Los archivos y fotos deben elegirse nuevamente porque el navegador no los conserva.',
          'Antes de descartar, cerrar, rechazar, anular o eliminar, leé la confirmación: explica qué ocurrirá y si existe una forma de recuperación.',
        ],
      },
      {
        title: 'Acciones y estados vacíos',
        body: [
          'Las acciones importantes muestran un nombre visible, por ejemplo Crear CAPA, Agregar persona, Volver o Limpiar filtros. No dependas sólo del ícono.',
          'Si una lista está vacía, usá la acción propuesta para crear el primer registro, quitar filtros o actualizar. Si aparece un error de carga, elegí Reintentar.',
        ],
      },
    ],
  },
  {
    id: 'roles',
    label: 'Roles y permisos',
    icon: '🔐',
    intro: 'Referencia rápida de qué puede hacer cada tipo de usuario.',
    sections: [
      {
        title: 'Tipos de usuario',
        body: [
          '• Admin: acceso completo a todo el sistema, incluyendo gestión de usuarios.',
          '• Editor: puede crear y editar en todos los módulos operativos, sin administrar usuarios.',
          '• Encargado: gestión operativa de su(s) sede(s): reportes, mantenimiento, calidad, compras.',
          '• Grupo: similar al encargado pero con visibilidad sobre un grupo de sedes.',
          '• Consultor: solo lectura en todos los módulos. No puede crear ni modificar.',
          '• Sede: acceso restringido para el personal de un local. Puede crear reportes y solicitar compras.',
          '• Operario: solo puede crear reportes desde el celular y completar checklists.',
          '• Flota: gestión exclusiva del módulo Flota (vehículos, documentos, matafuegos, tickets).',
        ],
      },
      {
        title: 'Acceso desde celular vs. computadora',
        body: [
          'La app se adapta al dispositivo. En celular, la interfaz está optimizada para operaciones en campo: nuevo reporte, checklists, novedades del turno.',
          'En computadora, tenés acceso a todos los módulos de gestión con más detalle y opciones de administración.',
          'El rol Operario solo puede usar la versión móvil.',
        ],
      },
      {
        title: 'Permisos especiales por módulo',
        body: [
          'Además del rol principal, un administrador puede otorgar alcances específicos para Compras o Mantenimiento. Estos permisos no habilitan automáticamente otras áreas.',
          'El alcance global de Mantenimiento permite administrar todas las sedes dentro de ese módulo conservando el alcance territorial habitual en el resto de la aplicación.',
          'Después de modificar permisos, el usuario debe cerrar sesión y volver a ingresar para actualizar su acceso.',
        ],
      },
    ],
  },
]
