import React from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/feedback';
import { mensajeError } from '../lib/errores';
import { esPersonaExterna } from '../lib/personaVinculo';

export default function PersonaVinculoPanel({ persona, canManage, onChanged }) {
  const [saving, setSaving] = React.useState(false);
  const externo = esPersonaExterna(persona);
  const guardar = async (tipo) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.schema('equipo').from('personas')
        .update({ tipo_vinculo: tipo }).eq('id', persona.id).select('id,tipo_vinculo').single();
      if (error) throw error;
      if (!data) throw new Error('No se pudo actualizar la persona.');
      await onChanged?.();
      toast.ok(tipo === 'externo' ? 'Persona clasificada como externa. Conserva su ficha e historial.' : 'Persona incorporada al staff.');
    } catch (error) {
      toast.error(mensajeError(error));
    } finally {
      setSaving(false);
    }
  };
  return <div className="glass p-4" style={{ marginBottom: 12 }}>
    <label style={{ color: 'var(--text)', display: 'block' }}>Tipo de vínculo
      <select className="input-dark" style={{ display: 'block', marginTop: 8, width: '100%' }}
        value={externo ? 'externo' : 'staff'} disabled={!canManage || saving}
        onChange={(event) => guardar(event.target.value)}>
        <option value="staff">Staff</option>
        <option value="externo">Externo · asesoría / prestación de servicios</option>
      </select>
    </label>
    <p style={{ color: 'var(--text-dim)', fontSize: '.78rem', marginTop: 8 }}>
      {saving ? 'Guardando…' : externo
        ? 'Vínculo externo activo. Conserva su sede, ficha e historial; no integra la dotación, los cronogramas ni las vacaciones del staff.'
        : 'Integra el staff de la organización. Los asesores y prestadores externos se consultan por separado.'}
    </p>
  </div>;
}
