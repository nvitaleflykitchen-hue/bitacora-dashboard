import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mixyhfdlzjarvszinytk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1peHloZmRsemphcnZzemlueXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTQwMTIsImV4cCI6MjA3OTk5MDAxMn0.Lvo9zw5KWaERGzZwfeCvrcwwm_CN00qTRTZ1lMXnuT4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function insertCapas() {
  const capas = [
    {
      codigo: 'SLA-CAPA-01',
      tipo: 'Correctiva',
      descripcion: 'Gramaje insuficiente en servicio YC BKF-1. Acción: Reforzar control de gramaje previo al armado final. Pesar componentes críticos.',
      responsable: 'Responsable de escala + Equipo de armado',
      estado: 'Pendiente',
      sede_id: 20,
      sede_nombre: 'Aeropuerto Salta',
      fecha_limite: '2026-06-08',
      notas: 'Auditoría Copa Airlines - SLA - 05/06/2026'
    },
    {
      codigo: 'SLA-CAPA-02',
      tipo: 'Correctiva',
      descripcion: 'Componente incompleto en servicio YC BKF-1. Acción: Implementar checklist obligatorio de componentes por bandeja.',
      responsable: 'Responsable de escala + Equipo de armado',
      estado: 'Pendiente',
      sede_id: 20,
      sede_nombre: 'Aeropuerto Salta',
      fecha_limite: '2026-06-08',
      notas: 'Auditoría Copa Airlines - SLA - 05/06/2026'
    },
    {
      codigo: 'SLA-CAPA-03',
      tipo: 'Correctiva',
      descripcion: 'Faltante de componentes en servicio YC BKF-2. Acción: Estandarizar conteo de piezas unitarias y control cruzado.',
      responsable: 'Responsable de escala + Armador designado + Despacho',
      estado: 'Pendiente',
      sede_id: 20,
      sede_nombre: 'Aeropuerto Salta',
      fecha_limite: '2026-06-08',
      notas: 'Auditoría Copa Airlines - SLA - 05/06/2026'
    },
    {
      codigo: 'SLA-CAPA-04',
      tipo: 'Correctiva',
      descripcion: 'Debilidad de control final en YC/BKF. Acción: Aplicar punto de liberación final con ficha técnica, foto, gramaje y conteo.',
      responsable: 'Responsable de escala + Calidad',
      estado: 'Pendiente',
      sede_id: 20,
      sede_nombre: 'Aeropuerto Salta',
      fecha_limite: '2026-06-12',
      notas: 'Auditoría Copa Airlines - SLA - 05/06/2026'
    },
    {
      codigo: 'TUC-CAPA-01',
      tipo: 'Correctiva',
      descripcion: 'Desvíos en YC BKF-2: tamaño/peso bajo, distribución deficiente y cocción. Acción: Revalidar especificación, controlar tamaño mínimo, incorporar control visual con foto y registrar evidencia.',
      responsable: 'Responsable de escala TUC',
      estado: 'Pendiente',
      sede_id: 18,
      sede_nombre: 'Aeropuerto Tucumán',
      fecha_limite: '2026-06-16',
      notas: 'Auditoría Copa Airlines - TUC - 09/06/2026'
    }
  ];

  const { data, error } = await supabase.schema('bitacora').from('capa').insert(capas).select();
  if (error) {
    console.error('Error inserting CAPAs:', error);
  } else {
    console.log('CAPAs inserted successfully:', data);
  }
}

insertCapas();
