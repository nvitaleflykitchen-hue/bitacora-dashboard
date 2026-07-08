// Central de Ayuda — contenido estático del manual de uso
// Organizado por módulo. Cada módulo tiene: id, label, icon, intro y secciones[].
// Cada sección tiene: title y body (array de párrafos o bloques).

export const HELP_MODULES = [
  {
    id: 'general',
    label: 'Primeros pasos',
    icon: '🚀',
    intro: 'Todo lo que necesitás saber para empezar a usar la bitácora.',
    sections: [
      {
        title: '¿Qué es Bitácora?',
        body: [
          'Bitácora es el sistema central de operaciones de la empresa: un lugar donde registrar novedades del turno, gestionar mantenimiento, controlar la flota, hacer seguimiento de calidad y coordinar compras.',
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
    intro: 'El registro histórico de todas las novedades del sistema.',
    sections: [
      {
        title: '¿Qué es el Tablón?',
        body: [
          'El Tablón muestra todas las novedades cargadas en el sistema, de todas las sedes. Es la vista "histórica" de la bitácora.',
          'Podés filtrar por sede, módulo, fecha y estado para encontrar lo que buscás.',
        ],
      },
      {
        title: 'Filtros y búsqueda',
        body: [
          'Usá los filtros en la parte superior para acotar la búsqueda por: sede, módulo (Operaciones, Personal, Mantenimiento, etc.), rango de fechas.',
          'El buscador global (Ctrl+K en la computadora) te permite buscar en toda la app, incluyendo novedades.',
        ],
      },
      {
        title: 'Estados de las novedades',
        body: [
          '• Pendiente: registrada, sin resolver.',
          '• En gestión: fue escalada y está siendo atendida.',
          '• Resuelta: la novedad fue cerrada con resolución.',
          '• Rechazada: fue marcada como no procedente.',
        ],
      },
    ],
  },
  {
    id: 'pendientes',
    label: 'Pendientes',
    icon: '⏳',
    intro: 'Gestión de escalamientos, tareas asignadas y seguimiento de alertas.',
    sections: [
      {
        title: '¿Qué muestra Pendientes?',
        body: [
          'Muestra todas las novedades que fueron escaladas y requieren acción de tu parte o de tu área.',
          'También incluye tareas asignadas y escalamientos vencidos que no fueron resueltos.',
        ],
      },
      {
        title: 'Resolver un escalamiento',
        body: [
          '1. Entrá a Pendientes y buscá el escalamiento en cuestión.',
          '2. Abrilo para ver el detalle de la novedad original.',
          '3. Agregá una respuesta o resolución y marcalo como resuelto.',
          '4. El área que escaló recibirá la notificación.',
        ],
      },
      {
        title: 'Escalamientos vencidos',
        body: [
          'Los escalamientos que superan el plazo configurado sin respuesta se marcan en rojo como "vencidos" y generan una alerta en el sistema.',
          'Revisá Pendientes regularmente para evitar acumulación.',
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
        title: 'Activos y equipos',
        body: [
          'El inventario de activos incluye todos los equipos e instalaciones de cada sede: cámaras, freezers, equipos de frío, instalaciones eléctricas, etc.',
          'Podés ver el historial de mantenimiento de cada activo y programarle planes preventivos.',
          'Para registrar un activo: Mantenimiento → Activos → Nuevo.',
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
    ],
  },
]
