// Directorio de contactos por módulo.
// Editar este archivo para agregar, modificar o eliminar contactos.
//
// Campos por contacto:
//   nombre      — nombre del canal o persona
//   descripcion — para qué sirve / qué gestiona
//   telefono    — número local tal como se marca (para mostrar)
//   tel         — número para llamar (formato internacional sin +, ej: 549351XXXXXXX)
//   wa          — número para WhatsApp (formato wa.me, sin + ni espacios)
//                 Si no tiene WhatsApp, omitir el campo.
//   icono       — emoji representativo
//
// Formato WhatsApp Argentina:
//   Córdoba móvil (351XXXXXXX)  → wa: '549351XXXXXXX'
//   Buenos Aires móvil          → wa: '5491133878738'
//   Para emergencias (101,100…) → no incluir wa (son líneas fijas/emergencia)

export const CONTACTOS = {

  rrhh: {
    label: 'Recursos Humanos',
    descripcion: 'Consultas, solicitudes y gestiones de RRHH',
    contactos: [
      {
        nombre: 'Ausencias',
        descripcion: 'Comunicar ausencias y licencias',
        telefono: '3513628059',
        tel: '5493513628059',
        wa: '5493513628059',
        icono: '📩',
      },
      {
        nombre: 'ART',
        descripcion: 'Accidentes de trabajo y cobertura médica laboral',
        telefono: '3513617203',
        tel: '5493513617203',
        wa: '5493513617203',
        icono: '🛡️',
      },
      {
        nombre: 'Consultas Varias',
        descripcion: 'Consultas generales de RRHH',
        telefono: '3512314408',
        tel: '5493512314408',
        wa: '5493512314408',
        icono: '💬',
      },
      {
        nombre: 'ASIRIY — Recibo de sueldos',
        descripcion: 'Gestión de recibos de sueldo digitales',
        telefono: '+5491133878738',
        tel: '5491133878738',
        wa: '5491133878738',
        icono: '💰',
      },
      {
        nombre: 'BROWIX — Fichaje',
        descripcion: 'Problemas con el sistema de fichaje y marcaciones',
        telefono: '3513655571',
        tel: '5493513655571',
        wa: '5493513655571',
        icono: '🔐',
      },
      {
        nombre: 'Licencia por Maternidad',
        descripcion: 'Trámites y seguimiento de licencia por maternidad',
        telefono: '3516505911',
        tel: '5493516505911',
        wa: '5493516505911',
        icono: '🤱',
      },
      {
        nombre: 'Selección de Personal',
        descripcion: 'Postulaciones, entrevistas y proceso de ingreso',
        telefono: '3513646601',
        tel: '5493513646601',
        wa: '5493513646601',
        icono: '👥',
      },
    ],
  },

  mantenimiento: {
    label: 'Mantenimiento',
    descripcion: 'Técnicos, proveedores y contactos de emergencia técnica',
    contactos: [
      // Agregá aquí los contactos de Mantenimiento
      // Ejemplo:
      // {
      //   nombre: 'Técnico Refrigeración',
      //   descripcion: 'Reparación de equipos de frío',
      //   telefono: '351XXXXXXX',
      //   tel: '549351XXXXXXX',
      //   wa: '549351XXXXXXX',
      //   icono: '❄️',
      // },
    ],
  },

  flota: {
    label: 'Flota',
    descripcion: 'Grúas, seguros vehiculares, ART flota y soporte',
    contactos: [
      // Agregá aquí los contactos de Flota
      // Ejemplo:
      // {
      //   nombre: 'Servicio de Grúas',
      //   descripcion: 'Auxilio vehicular 24hs',
      //   telefono: '0800XXXXXXX',
      //   tel: '54800XXXXXXX',
      //   icono: '🚛',
      // },
    ],
  },

  emergencias: {
    label: 'Emergencias',
    descripcion: 'Números de emergencia y servicios críticos',
    contactos: [
      {
        nombre: 'Emergencias Médicas — SAME',
        descripcion: 'Urgencias y emergencias médicas',
        telefono: '107',
        tel: '107',
        icono: '🚑',
      },
      {
        nombre: 'Bomberos',
        descripcion: 'Incendios y emergencias de riesgo',
        telefono: '100',
        tel: '100',
        icono: '🚒',
      },
      {
        nombre: 'Policía',
        descripcion: 'Seguridad y emergencias policiales',
        telefono: '101',
        tel: '101',
        icono: '🚓',
      },
      {
        nombre: 'Defensa Civil',
        descripcion: 'Emergencias y catástrofes',
        telefono: '103',
        tel: '103',
        icono: '⚠️',
      },
    ],
  },

}

// Orden de aparición en el directorio completo (mobile)
export const CONTACTOS_ORDER = ['rrhh', 'mantenimiento', 'flota', 'emergencias']
