const requisitos = [
  ['Datos del proveedor', ['Razón social o nombre completo.', 'CUIT o identificación fiscal.', 'Teléfono y correo electrónico de contacto.', 'Persona de contacto o responsable técnico.']],
  ['Trabajo a realizar', ['Descripción detallada de las tareas, alcance e insumos o repuestos a utilizar.', 'Ubicación y área: sector de la planta o cocina donde se ejecutará la labor.', 'Plazo de ejecución: duración estimada y fechas tentativas de inicio y finalización.', 'Garantía: cobertura de la mano de obra y de los repuestos aplicados.']],
  ['Condiciones económicas', ['Importe desglosado de mano de obra, materiales y total, indicando los impuestos aplicables e IVA.', 'Validez del presupuesto: período de vigencia de la oferta (por ejemplo, 15 días).', 'Forma de pago: condiciones comerciales (por ejemplo, 30 días, transferencia o e-check).']],
]

export default function MntInstructivos() {
  return <article tabIndex={0} aria-label="Instructivo de presupuestos" className="h-full min-h-0 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-5 max-w-5xl mx-auto w-full" style={{ color: 'var(--text)', overflowWrap: 'anywhere' }}>
    <header>
      <p className="font-metric text-sm mb-2" style={{ color: 'var(--primary)' }}>INSTRUCTIVOS DE MANTENIMIENTO</p>
      <h2 className="font-title text-xl font-bold">Solicitud y aprobación de presupuestos de proveedores</h2>
      <p className="text-sm mt-2" style={{ color: 'var(--text-dim)' }}>Fuente: procedimiento comunicado por Pablo A. Fernandez, Coordinador operativo de comedores industriales, el 15/10/2026. Contenido del instructivo organizado para consulta.</p>
    </header>
    <aside className="glass p-4 rounded" style={{ border: '1px solid var(--alert, #ef4444)' }}>
      <strong>No iniciar trabajos sin aprobación escrita</strong>
      <p className="mt-2">Ningún trabajo podrá iniciarse sin la aprobación explícita de Fly Kitchen por correo electrónico. Una autorización verbal o por mensajería informal, como WhatsApp, no habilita la ejecución.</p>
    </aside>
    <section className="glass p-4 rounded space-y-2">
      <h3 className="font-bold">1. Objetivo y alcance</h3>
      <p>Establecer el procedimiento obligatorio para solicitar, enviar, validar y aprobar presupuestos de proveedores externos antes de ejecutar cualquier trabajo o servicio para Fly Kitchen.</p>
      <p>Aplica a proveedores externos, contratistas, prestadores de servicios y al personal interno responsable de Compras y Mantenimiento.</p>
    </section>
    <section className="glass p-4 rounded space-y-3">
      <h3 className="font-bold">2. Solicitud y envío del presupuesto</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li>El equipo de Fly Kitchen entrega al proveedor el detalle del trabajo, la ubicación y la fecha sugerida de ejecución.</li>
        <li>El proveedor confecciona un presupuesto formal, en PDF o en el cuerpo del mensaje, y lo envía únicamente por correo electrónico a la dirección oficial autorizada.</li>
      </ol>
      <p><strong>Destinatarios indicados en el original:</strong> compras@flykitchen.com.ar / pablofernandez@flykitchen.com.ar.</p>
      <p className="text-sm" style={{ color: 'var(--text-dim)' }}>El original indica “modificar según corresponda”. Confirmar con Compras o Mantenimiento cuál de estas direcciones corresponde antes del envío.</p>
      <p><strong>Asunto del correo:</strong></p>
      <p className="font-mono text-sm p-3 rounded" style={{ background: 'var(--surface)' }}>[PRESUPUESTO] - [Nombre del Proveedor] - [Descripción Breve del Trabajo]</p>
    </section>
    <section className="space-y-3">
      <h3 className="font-bold">3. Requisitos obligatorios del presupuesto</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{requisitos.map(([titulo, items]) => <section key={titulo} className="glass p-4 rounded">
        <h4 className="font-bold mb-3">{titulo}</h4>
        <ul className="list-disc pl-5 space-y-2">{items.map(item => <li key={item}>{item}</li>)}</ul>
      </section>)}</div>
    </section>
    <section className="glass p-4 rounded space-y-3">
      <h3 className="font-bold">4. Revisión, aprobación e inicio</h3>
      <ol className="list-decimal pl-5 space-y-2">
        <li><strong>Revisión interna:</strong> el responsable del área evalúa la factibilidad técnica y económica.</li>
        <li><strong>Aprobación oficial:</strong> Fly Kitchen emite una aprobación escrita y explícita por correo electrónico con la orden de compra o referencia correspondiente.</li>
        <li><strong>Inicio de trabajos:</strong> el proveedor solo puede comenzar después de recibir esa aprobación.</li>
      </ol>
      <blockquote className="p-3 border-l-2">“Presupuesto APROBADO bajo la O.C. / Referencia N° XXXX”</blockquote>
      <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Texto modelo del procedimiento: XXXX debe reemplazarse por el número real de orden de compra o referencia. Este instructivo no constituye una aprobación de trabajo.</p>
    </section>
    <section className="glass p-4 rounded space-y-2">
      <h3 className="font-bold">5. Seguridad de contratistas</h3>
      <p>Todo personal contratista debe ingresar a las instalaciones con los elementos de protección personal (EPP) correspondientes y el seguro de accidentes de trabajo al día.</p>
    </section>
  </article>
}
