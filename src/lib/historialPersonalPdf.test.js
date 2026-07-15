import { describe, expect, it } from "vitest";
import {
  historialPersonalFilename,
  textoHistorialPersonal,
} from "./historialPersonalPdf";

describe("historialPersonalPdf", () => {
  it("genera un nombre de archivo estable", () => {
    expect(
      historialPersonalFilename(
        { nombre: "Micaela", apellido: "Araujo" },
        { tipo: "llamado_atencion", fecha: "2026-07-14" },
      ),
    ).toBe("llamado-atencion-araujo-micaela-2026-07-14.pdf");
  });

  it("arma el texto para compartir", () => {
    const text = textoHistorialPersonal(
      { nombre: "Micaela", apellido: "Araujo" },
      {
        tipo: "apercibimiento",
        fecha: "2026-07-14",
        descripcion: "Prueba",
        registrado_por: "Jazmín",
      },
    );
    expect(text).toContain("APERCIBIMIENTO - Micaela Araujo");
    expect(text).toContain("Descripción: Prueba");
  });
});
