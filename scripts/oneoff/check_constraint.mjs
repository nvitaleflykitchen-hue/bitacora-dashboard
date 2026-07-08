import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mixyhfdlzjarvszinytk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1peHloZmRsemphcnZzemlueXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTQwMTIsImV4cCI6MjA3OTk5MDAxMn0.Lvo9zw5KWaERGzZwfeCvrcwwm_CN00qTRTZ1lMXnuT4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraint() {
  const { data, error } = await supabase.rpc('execute_sql', { query: 'SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = \'capa_tipo_check\';' });
  if (error) {
    console.error('Error fetching constraint:', error);
    // Alternatively just select an existing row to see its tipo
    const { data: row } = await supabase.schema('bitacora').from('capa').select('tipo, estado').limit(1);
    console.log('Sample row:', row);
  } else {
    console.log('Constraint:', data);
  }
}
checkConstraint();
