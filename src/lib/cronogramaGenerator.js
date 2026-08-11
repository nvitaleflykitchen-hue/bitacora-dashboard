export const REGIMENES_FRANCO = {
  "4x1": { nombre:"4x1", patron:["T","T","T","T","F"] },
  "6x1": { nombre:"6x1", patron:["T","T","T","T","T","T","F"] },
  "6x1_5x2": { nombre:"6x1 / 5x2", patron:["T","T","T","T","T","T","F","T","T","T","T","T","F","F"] },
  "8x2": { nombre:"8x2", patron:["T","T","T","T","T","T","T","T","F","F"] },
  "5_5x1_5": { nombre:"5,5x1,5", patron:["T","T","T","T","T","M","F"] },
};

const iso = date => date.toISOString().slice(0,10);
const weekday = date => date.getUTCDay() === 0 ? 7 : date.getUTCDay();
const activeOn = (item,day) => (!item.fecha_desde || item.fecha_desde<=day)&&(!item.fecha_hasta||item.fecha_hasta>=day);

export function generarCronogramaMensual({ anio, mes, regimenCodigo, fechaAncla, generarDesde, necesidades=[], personas=[], ausencias=[], turnos=[] }) {
  const regimen=REGIMENES_FRANCO[regimenCodigo];
  if(!regimen) throw new Error("Régimen de francos inválido");
  const days=new Date(Date.UTC(anio,mes,0)).getUTCDate();
  const ordenadas=[...personas].sort((a,b)=>String(a.persona_id).localeCompare(String(b.persona_id)));
  const cargas=new Map(ordenadas.map(p=>[p.persona_id,0]));
  const ancla=new Date(`${fechaAncla||`${anio}-01-01`}T00:00:00Z`);
  const asignaciones=[]; const faltantes=[]; const estados=[];
  const cargasTurno=new Map();
  for(let numero=1;numero<=days;numero++){
    const date=new Date(Date.UTC(anio,mes-1,numero)); const fecha=iso(date); const dia=weekday(date);
    const offset=Math.floor((date-ancla)/86400000);
    ordenadas.forEach((persona,index)=>{
      const patron=regimen.patron[((offset+index)%regimen.patron.length+regimen.patron.length)%regimen.patron.length];
      let estado=patron==="F"?"franco":patron==="M"?"media_disponible":"disponible";
      if(generarDesde&&fecha<generarDesde) estado="fuera_periodo";
      else if(!activeOn(persona,fecha)) estado="no_vigente";
      else if(ausencias.some(a=>a.persona_id===persona.persona_id&&activeOn(a,fecha))) estado="ausente";
      estados.push({fecha,persona_id:persona.persona_id,estado});
    });
    if(generarDesde&&fecha<generarDesde) continue;
    const ocupadas=new Set();
    const reqs=necesidades.filter(n=>Number(n.dia_semana)===dia&&n.activo!==false);
    for(const req of reqs){
      for(let slot=0;slot<Number(req.cantidad_requerida||1);slot++){
        const candidates=ordenadas.filter((p,index)=>p.rol_operativo_id===req.rol_operativo_id&&activeOn(p,fecha)&&!ocupadas.has(p.persona_id)&&!ausencias.some(a=>a.persona_id===p.persona_id&&activeOn(a,fecha))&&regimen.patron[((offset+index)%regimen.patron.length+regimen.patron.length)%regimen.patron.length]!=="F").sort((a,b)=>(cargas.get(a.persona_id)||0)-(cargas.get(b.persona_id)||0));
        const elegido=candidates[0];
        if(!elegido){faltantes.push({fecha,sector_id:req.sector_id,turno_id:req.turno_id,rol_operativo_id:req.rol_operativo_id,cantidad:1});continue;}
        const index=ordenadas.indexOf(elegido); const marca=regimen.patron[((offset+index)%regimen.patron.length+regimen.patron.length)%regimen.patron.length];
        asignaciones.push({fecha,persona_id:elegido.persona_id,persona_nombre:elegido.persona_nombre,sector_id:req.sector_id,turno_id:req.turno_id,rol_operativo_id:req.rol_operativo_id,estado:marca==="M"?"media_jornada":"asignado",origen:"generado"});
        ocupadas.add(elegido.persona_id); cargas.set(elegido.persona_id,(cargas.get(elegido.persona_id)||0)+1);
        cargasTurno.set(`${fecha}:${req.turno_id}`,(cargasTurno.get(`${fecha}:${req.turno_id}`)||0)+1);
      }
    }
    const cortado=turnos.find(t=>(t.tipo||t.nombre)==="Cortado");
    if(cortado){
      for(let index=faltantes.length-1;index>=0;index--){
        const falta=faltantes[index]; if(falta.fecha!==fecha) continue;
        const existente=asignaciones.find(a=>a.fecha===fecha&&a.sector_id===falta.sector_id&&a.rol_operativo_id===falta.rol_operativo_id&&a.turno_id!==falta.turno_id&&a.turno_id!==cortado.id);
        if(!existente) continue;
        existente.cubre_turnos=[existente.turno_id,falta.turno_id]; existente.turno_id=cortado.id; existente.origen="cobertura_cortado";
        faltantes.splice(index,1);
      }
    }
    // La cobertura de la plantilla expresa el mínimo requerido, no la totalidad
    // de las personas que deben recibir horario. Completamos la jornada del resto
    // priorizando los turnos configurados para su rol y usando los turnos normales
    // de la sede como alternativa cuando el rol aún no tiene cobertura definida.
    for(const persona of ordenadas){
      const index=ordenadas.indexOf(persona);
      const marca=regimen.patron[((offset+index)%regimen.patron.length+regimen.patron.length)%regimen.patron.length];
      if(marca==="F"||!activeOn(persona,fecha)||ocupadas.has(persona.persona_id)||ausencias.some(a=>a.persona_id===persona.persona_id&&activeOn(a,fecha))) continue;
      const delRolHoy=reqs.filter(n=>n.rol_operativo_id===persona.rol_operativo_id).map(n=>n.turno_id);
      const delRol=necesidades.filter(n=>n.activo!==false&&n.rol_operativo_id===persona.rol_operativo_id).map(n=>n.turno_id);
      const normales=turnos.filter(t=>(t.tipo||t.nombre)!=="Cortado").map(t=>t.id);
      const opciones=[...new Set(delRolHoy.length?delRolHoy:delRol.length?delRol:normales)].filter(Boolean);
      if(!opciones.length) continue;
      const turnoId=[...opciones].sort((a,b)=>(cargasTurno.get(`${fecha}:${a}`)||0)-(cargasTurno.get(`${fecha}:${b}`)||0))[0];
      asignaciones.push({fecha,persona_id:persona.persona_id,persona_nombre:persona.persona_nombre,sector_id:null,turno_id:turnoId,rol_operativo_id:persona.rol_operativo_id,estado:marca==="M"?"media_jornada":"asignado",origen:"complemento_dotacion"});
      ocupadas.add(persona.persona_id);
      cargas.set(persona.persona_id,(cargas.get(persona.persona_id)||0)+1);
      cargasTurno.set(`${fecha}:${turnoId}`,(cargasTurno.get(`${fecha}:${turnoId}`)||0)+1);
    }
  }
  return {asignaciones,faltantes,estados,dias:days,complementarias:asignaciones.filter(x=>x.origen==="complemento_dotacion").length};
}
