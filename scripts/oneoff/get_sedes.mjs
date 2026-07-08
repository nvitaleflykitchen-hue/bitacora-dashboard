import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mixyhfdlzjarvszinytk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1peHloZmRsemphcnZzemlueXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTQwMTIsImV4cCI6MjA3OTk5MDAxMn0.Lvo9zw5KWaERGzZwfeCvrcwwm_CN00qTRTZ1lMXnuT4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSedes() {
  const { data, error } = await supabase.schema('bitacora').from('sedes').select('*');
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
checkSedes();
