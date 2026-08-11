import { describe,expect,it } from "vitest";
import { generarCronogramaMensual,REGIMENES_FRANCO } from "./cronogramaGenerator";

describe("generarCronogramaMensual",()=>{
  it("define los regímenes de sede acordados",()=>expect(Object.keys(REGIMENES_FRANCO)).toEqual(["4x1","6x1","6x1_5x2","8x2","5_5x1_5"]));
  it("asigna solo personas del rol y expone faltantes",()=>{
    const result=generarCronogramaMensual({anio:2026,mes:8,regimenCodigo:"4x1",necesidades:[{dia_semana:1,cantidad_requerida:2,rol_operativo_id:"cocinero",sector_id:"cocina",turno_id:"m"}],personas:[{persona_id:"1",persona_nombre:"Ana",rol_operativo_id:"cocinero",fecha_desde:"2026-01-01"}],ausencias:[]});
    expect(result.asignaciones.every(x=>x.persona_id==="1")).toBe(true);
    expect(result.faltantes.length).toBeGreaterThan(0);
  });
  it("excluye carpetas médicas durante su período",()=>{
    const result=generarCronogramaMensual({anio:2026,mes:8,regimenCodigo:"6x1",necesidades:[{dia_semana:1,cantidad_requerida:1,rol_operativo_id:"r",sector_id:"s",turno_id:"t"}],personas:[{persona_id:"1",persona_nombre:"Ana",rol_operativo_id:"r"}],ausencias:[{persona_id:"1",fecha_desde:"2026-08-03",fecha_hasta:"2026-08-03"}]});
    expect(result.asignaciones.some(x=>x.fecha==="2026-08-03")).toBe(false);
    expect(result.faltantes.some(x=>x.fecha==="2026-08-03")).toBe(true);
  });
  it("usa Cortado para cubrir dos turnos del mismo rol y sector",()=>{
    const result=generarCronogramaMensual({anio:2026,mes:8,regimenCodigo:"6x1",fechaAncla:"2026-08-01",necesidades:[
      {dia_semana:1,cantidad_requerida:1,rol_operativo_id:"cocinero",sector_id:"cocina",turno_id:"m"},
      {dia_semana:1,cantidad_requerida:1,rol_operativo_id:"cocinero",sector_id:"cocina",turno_id:"t"},
    ],personas:[{persona_id:"1",persona_nombre:"Ana",rol_operativo_id:"cocinero"}],ausencias:[],turnos:[{id:"m",tipo:"Matutino"},{id:"t",tipo:"Vespertino"},{id:"c",tipo:"Cortado"}]});
    const lunes=result.asignaciones.find(x=>x.fecha==="2026-08-03");
    expect(lunes.turno_id).toBe("c");
    expect(lunes.cubre_turnos).toEqual(["m","t"]);
    expect(result.faltantes.some(x=>x.fecha==="2026-08-03")).toBe(false);
  });
  it("no convierte días previos a la generación en faltantes ni francos",()=>{
    const result=generarCronogramaMensual({anio:2026,mes:8,regimenCodigo:"6x1",generarDesde:"2026-08-11",necesidades:[{dia_semana:1,cantidad_requerida:1,rol_operativo_id:"r",sector_id:"s",turno_id:"m"}],personas:[{persona_id:"1",rol_operativo_id:"r",fecha_desde:"2026-08-11"}]});
    expect(result.faltantes.some(x=>x.fecha<"2026-08-11")).toBe(false);
    expect(result.estados.find(x=>x.fecha==="2026-08-03"&&x.persona_id==="1")?.estado).toBe("fuera_periodo");
  });
  it("asigna horario a toda persona disponible aunque supere la cobertura mínima",()=>{
    const result=generarCronogramaMensual({anio:2026,mes:8,regimenCodigo:"6x1",fechaAncla:"2026-08-01",necesidades:[{dia_semana:1,cantidad_requerida:1,rol_operativo_id:"r",sector_id:"s",turno_id:"m"}],personas:[{persona_id:"1",rol_operativo_id:"r"},{persona_id:"2",rol_operativo_id:"r"}],turnos:[{id:"m",tipo:"Matutino",hora_desde:"06:00",hora_hasta:"14:00"}]});
    const lunes=result.asignaciones.filter(x=>x.fecha==="2026-08-03");
    expect(lunes).toHaveLength(2);
    expect(lunes.some(x=>x.origen==="complemento_dotacion")).toBe(true);
  });
  it("usa turnos de sede como alternativa para roles sin cobertura",()=>{
    const result=generarCronogramaMensual({anio:2026,mes:8,regimenCodigo:"6x1",fechaAncla:"2026-08-01",necesidades:[],personas:[{persona_id:"1",rol_operativo_id:"camarera"}],turnos:[{id:"m",tipo:"Matutino"},{id:"v",tipo:"Vespertino"},{id:"c",tipo:"Cortado"}]});
    expect(result.asignaciones.some(x=>x.persona_id==="1"&&x.origen==="complemento_dotacion")).toBe(true);
    expect(result.asignaciones.every(x=>x.turno_id!=="c")).toBe(true);
  });
});
