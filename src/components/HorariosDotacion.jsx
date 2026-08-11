import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Layers3, Plus, Save, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { mensajeError } from "../lib/errores";
import { toast } from "../lib/feedback";

const DIAS = [[1,"Lun"],[2,"Mar"],[3,"Mié"],[4,"Jue"],[5,"Vie"],[6,"Sáb"],[7,"Dom"]];

export default function HorariosDotacion({ sedes = [], canManage = false }) {
  const { user } = useAuth();
  const [sedeId, setSedeId] = useState("");
  const [data, setData] = useState({ sectores:[], turnos:[], plantillas:[], necesidades:[], roles:[] });
  const [plantillaId, setPlantillaId] = useState("");
  const [sector, setSector] = useState("");
  const [turno, setTurno] = useState({ nombre:"", desde:"06:00", hasta:"14:00" });
  const [plantilla, setPlantilla] = useState("");
  const [need, setNeed] = useState({ sector_id:"", turno_id:"", rol_operativo_id:"", cantidad:1, dias:[1,2,3,4,5] });

  useEffect(() => { if (!sedeId && sedes[0]) setSedeId(String(sedes[0].id)); }, [sedeId, sedes]);
  const load = useCallback(async () => {
    if (!sedeId) return;
    const sid = Number(sedeId);
    const [s,t,p,n,r] = await Promise.all([
      supabase.schema("equipo").from("horario_sectores").select("*").eq("sede_id",sid).eq("activo",true).order("orden").order("nombre"),
      supabase.schema("equipo").from("horario_turnos").select("*").eq("sede_id",sid).eq("activo",true).order("hora_desde"),
      supabase.schema("equipo").from("horario_plantillas").select("*").eq("sede_id",sid).neq("estado","archivada").order("created_at",{ascending:false}),
      supabase.schema("equipo").from("horario_necesidades").select("*").eq("sede_id",sid).eq("activo",true),
      supabase.schema("equipo").from("roles_operativos").select("id,nombre,sede_id,activo").eq("activo",true).order("nombre"),
    ]);
    const failed=[s,t,p,n,r].find(x=>x.error); if(failed) toast.error(mensajeError(failed.error));
    const next={sectores:s.data||[],turnos:t.data||[],plantillas:p.data||[],necesidades:n.data||[],roles:(r.data||[]).filter(x=>!x.sede_id||x.sede_id===sid)};
    setData(next); setPlantillaId(current=>next.plantillas.some(x=>x.id===current)?current:next.plantillas.find(x=>x.estado==="activa")?.id||next.plantillas[0]?.id||"");
  },[sedeId]);
  useEffect(()=>{load();},[load]);

  const selected=data.plantillas.find(x=>x.id===plantillaId);
  const rows=data.necesidades.filter(x=>x.plantilla_id===plantillaId);
  const perDay=useMemo(()=>new Map(DIAS.map(([d])=>[d,rows.filter(x=>x.dia_semana===d).reduce((a,x)=>a+x.cantidad_requerida,0)])),[rows]);
  const insert=async(table,payload,message)=>{const {error}=await supabase.schema("equipo").from(table).insert({...payload,created_by:user?.id||null,updated_by:user?.id||null});if(error)return toast.error(mensajeError(error));toast.ok(message);await load();};
  const addSector=async()=>{if(!sector.trim())return toast.warn("Indicá el sector.");await insert("horario_sectores",{sede_id:Number(sedeId),nombre:sector.trim()},"Sector agregado.");setSector("");};
  const addTurno=async()=>{if(!turno.nombre.trim())return toast.warn("Indicá el turno.");await insert("horario_turnos",{sede_id:Number(sedeId),nombre:turno.nombre.trim(),hora_desde:turno.desde,hora_hasta:turno.hasta},"Turno agregado.");setTurno({nombre:"",desde:"06:00",hasta:"14:00"});};
  const addPlantilla=async()=>{if(!plantilla.trim())return toast.warn("Indicá el nombre de la plantilla.");await insert("horario_plantillas",{sede_id:Number(sedeId),nombre:plantilla.trim(),estado:"borrador"},"Plantilla creada.");setPlantilla("");};
  const addNeed=async()=>{if(!plantillaId||!need.sector_id||!need.turno_id||!need.rol_operativo_id||!need.dias.length)return toast.warn("Completá sector, turno, rol y días.");const payload=need.dias.map(d=>({plantilla_id:plantillaId,sede_id:Number(sedeId),sector_id:need.sector_id,turno_id:need.turno_id,rol_operativo_id:need.rol_operativo_id,dia_semana:d,cantidad_requerida:Number(need.cantidad),created_by:user?.id||null,updated_by:user?.id||null}));const {error}=await supabase.schema("equipo").from("horario_necesidades").upsert(payload,{onConflict:"plantilla_id,sector_id,turno_id,rol_operativo_id,dia_semana"});if(error)return toast.error(mensajeError(error));toast.ok("Dotación actualizada.");load();};
  const activate=async()=>{if(!selected)return;const active=data.plantillas.filter(x=>x.estado==="activa"&&x.id!==selected.id);if(active.length){const {error}=await supabase.schema("equipo").from("horario_plantillas").update({estado:"archivada",updated_by:user?.id||null}).in("id",active.map(x=>x.id));if(error)return toast.error(mensajeError(error));}const {error}=await supabase.schema("equipo").from("horario_plantillas").update({estado:"activa",vigencia_desde:selected.vigencia_desde||new Date().toISOString().slice(0,10),updated_by:user?.id||null}).eq("id",selected.id);if(error)return toast.error(mensajeError(error));toast.ok("Plantilla activada.");load();};
  const remove=async id=>{const {error}=await supabase.schema("equipo").from("horario_necesidades").update({activo:false,updated_by:user?.id||null}).eq("id",id);if(error)return toast.error(mensajeError(error));load();};

  if(!sedes.length)return <div className="glass p-8 text-center" style={{color:"var(--text-dim)"}}>No hay sedes disponibles.</div>;
  return <div className="space-y-4 max-w-[1500px]">
    <div className="glass p-4 flex flex-wrap items-center gap-4"><div className="flex-1"><p className="font-title font-bold" style={{color:"var(--phosphor)"}}>HORARIOS Y DOTACIÓN</p><p style={{color:"var(--text-dim)",fontSize:".7rem"}}>Definí primero la cobertura requerida. La asignación de personas se incorpora después.</p></div><select className="input-dark min-w-[250px]" value={sedeId} onChange={e=>setSedeId(e.target.value)}>{sedes.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[[Layers3,"Sectores",data.sectores.length],[Clock3,"Turnos",data.turnos.length],[CalendarDays,"Plantillas",data.plantillas.length],[Users,"Posiciones semanales",rows.reduce((a,x)=>a+x.cantidad_requerida,0)]].map(([Icon,label,value])=><div className="glass p-3 flex gap-3 items-center" key={label}><Icon size={18} style={{color:"var(--phosphor)"}}/><div><p className="font-title font-bold text-lg">{value}</p><p className="font-metric" style={{fontSize:".57rem",color:"var(--text-dim)"}}>{label.toUpperCase()}</p></div></div>)}</div>
    {canManage&&<div className="grid grid-cols-1 lg:grid-cols-3 gap-3"><Setup title="1 · SECTORES"><input className="input-dark flex-1" value={sector} onChange={e=>setSector(e.target.value)} placeholder="Ej. Cocina"/><Add onClick={addSector}/></Setup><Setup title="2 · TURNOS"><input className="input-dark w-full mb-2" value={turno.nombre} onChange={e=>setTurno({...turno,nombre:e.target.value})} placeholder="Ej. Mañana"/><div className="flex gap-2"><input type="time" className="input-dark flex-1" value={turno.desde} onChange={e=>setTurno({...turno,desde:e.target.value})}/><input type="time" className="input-dark flex-1" value={turno.hasta} onChange={e=>setTurno({...turno,hasta:e.target.value})}/><Add onClick={addTurno}/></div></Setup><Setup title="3 · PLANTILLA"><input className="input-dark flex-1" value={plantilla} onChange={e=>setPlantilla(e.target.value)} placeholder="Ej. Operación habitual"/><Add onClick={addPlantilla}/></Setup></div>}
    <div className="glass p-4"><div className="flex flex-wrap gap-3 mb-4"><select className="input-dark min-w-[260px]" value={plantillaId} onChange={e=>setPlantillaId(e.target.value)}><option value="">Seleccionar plantilla...</option>{data.plantillas.map(x=><option key={x.id} value={x.id}>{x.nombre} · {x.estado}</option>)}</select>{selected&&<span className="font-metric px-2 py-1" style={{fontSize:".58rem",color:selected.estado==="activa"?"var(--phosphor)":"#f59e0b"}}>{selected.estado.toUpperCase()}</span>}{canManage&&selected?.estado!=="activa"&&<button className="btn-ghost" onClick={activate}>Activar</button>}</div>
      {!selected?<p style={{color:"var(--text-dim)",fontSize:".72rem"}}>Creá o seleccioná una plantilla.</p>:<>{canManage&&<div className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 mb-4" style={{border:"1px solid rgba(57,255,20,.12)"}}><Select value={need.sector_id} set={v=>setNeed({...need,sector_id:v})} label="Sector" items={data.sectores}/><Select value={need.turno_id} set={v=>setNeed({...need,turno_id:v})} label="Turno" items={data.turnos}/><div className="md:col-span-2"><Select value={need.rol_operativo_id} set={v=>setNeed({...need,rol_operativo_id:v})} label="Rol Fly" items={data.roles}/></div><input type="number" min="1" max="200" className="input-dark" value={need.cantidad} onChange={e=>setNeed({...need,cantidad:e.target.value})}/><button className="btn-primary flex justify-center items-center gap-1" onClick={addNeed}><Save size={12}/> Guardar</button><div className="md:col-span-6 flex flex-wrap gap-2">{DIAS.map(([d,l])=><label key={d} className="px-2 py-1" style={{border:"1px solid rgba(255,255,255,.1)",color:need.dias.includes(d)?"var(--phosphor)":"var(--text-dim)",fontSize:".68rem"}}><input className="mr-1" type="checkbox" checked={need.dias.includes(d)} onChange={()=>setNeed({...need,dias:need.dias.includes(d)?need.dias.filter(x=>x!==d):[...need.dias,d]})}/>{l}</label>)}</div>{!data.roles.length&&<p className="md:col-span-6" style={{color:"#f59e0b",fontSize:".68rem"}}>No hay roles Fly para esta sede. Crealos desde la ficha de un colaborador.</p>}</div>}
      <div className="grid grid-cols-7 gap-2 mb-4">{DIAS.map(([d,l])=><div className="text-center p-2" key={d} style={{background:"rgba(255,255,255,.025)"}}><p className="font-metric" style={{fontSize:".57rem",color:"var(--text-dim)"}}>{l.toUpperCase()}</p><p className="font-title font-bold" style={{color:"var(--phosphor)"}}>{perDay.get(d)||0}</p></div>)}</div><table className="w-full" style={{fontSize:".7rem"}}><thead><tr style={{color:"var(--text-dim)"}}><th className="text-left py-2">Día</th><th className="text-left">Sector</th><th className="text-left">Turno</th><th className="text-left">Rol</th><th className="text-right">Cantidad</th><th/></tr></thead><tbody>{rows.sort((a,b)=>a.dia_semana-b.dia_semana).map(x=><tr key={x.id} style={{borderTop:"1px solid rgba(255,255,255,.05)"}}><td className="py-2">{DIAS.find(([d])=>d===x.dia_semana)?.[1]}</td><td>{data.sectores.find(v=>v.id===x.sector_id)?.nombre}</td><td>{data.turnos.find(v=>v.id===x.turno_id)?.nombre}</td><td>{data.roles.find(v=>v.id===x.rol_operativo_id)?.nombre}</td><td className="text-right font-bold">{x.cantidad_requerida}</td><td className="text-right">{canManage&&<button className="btn-ghost" onClick={()=>remove(x.id)}>Quitar</button>}</td></tr>)}{!rows.length&&<tr><td colSpan="6" className="text-center py-8" style={{color:"var(--text-dim)"}}>Sin necesidades cargadas.</td></tr>}</tbody></table></>}</div>
  </div>;
}

function Setup({title,children}){return <div className="glass p-4"><p className="font-metric mb-3" style={{color:"var(--phosphor)",fontSize:".65rem"}}>{title}</p><div className="flex gap-2 flex-wrap">{children}</div></div>}
function Add({onClick}){return <button className="btn-primary" onClick={onClick}><Plus size={13}/></button>}
function Select({value,set,label,items}){return <select className="input-dark w-full" value={value} onChange={e=>set(e.target.value)}><option value="">{label}...</option>{items.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select>}
