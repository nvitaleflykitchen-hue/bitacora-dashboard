import { describe, expect, it } from "vitest";
import { enrichAuditRowsWithReporters } from "./auditoriaAttribution";

describe("enrichAuditRowsWithReporters", () => {
  it("recupera el reportante para un evento automatico de registros", () => {
    const [row] = enrichAuditRowsWithReporters(
      [{ tabla: "registros", registro_id: "2771", usuario_nombre: null }],
      [
        {
          id: 2771,
          reportante: "JAZMIN DAVICINI",
          email_reportante: "jazmin@example.com",
        },
      ],
    );
    expect(row.usuario_nombre).toBe("JAZMIN DAVICINI");
    expect(row.usuario_email).toBe("jazmin@example.com");
    expect(row.usuario_origen).toBe("reportante_formulario");
  });

  it("no reemplaza la identidad autenticada existente", () => {
    const original = {
      tabla: "registros",
      registro_id: "1",
      usuario_nombre: "Nicolas",
    };
    expect(
      enrichAuditRowsWithReporters(
        [original],
        [{ id: 1, reportante: "Otro" }],
      )[0],
    ).toEqual(original);
  });
});
