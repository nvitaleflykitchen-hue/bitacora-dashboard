import { describe, expect, it } from "vitest";
import { deduplicarHistorialPersonal } from "./historialPersonal";

describe("deduplicarHistorialPersonal", () => {
  it("oculta duplicados generados por el mismo registro", () => {
    const base = { persona_id: "persona-1", tipo: "otro", fecha: "2026-08-01", descripcion: "[Registro #3087 · Otro] Se rompió el celular" };
    expect(deduplicarHistorialPersonal([{ ...base, id: "a" }, { ...base, id: "b" }])).toEqual([{ ...base, id: "a" }]);
  });

  it("conserva cargas manuales aunque tengan el mismo texto", () => {
    const base = { persona_id: "persona-1", tipo: "otro", fecha: "2026-08-01", descripcion: "Nota manual" };
    expect(deduplicarHistorialPersonal([{ ...base, id: "a" }, { ...base, id: "b" }])).toHaveLength(2);
  });
});
