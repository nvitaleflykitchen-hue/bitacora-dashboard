import { describe, expect, it } from "vitest";
import { proximosCumpleanios, telefonoWhatsApp } from "./cumpleanios";

describe("proximosCumpleanios", () => {
  it("incluye hoy y los siguientes siete días sin exponer la edad", () => {
    const personas = [
      { id: 1, nombre: "Ana", fecha_nacimiento: "1990-08-05" },
      { id: 2, nombre: "Beto", fecha_nacimiento: "1985-08-12" },
      { id: 3, nombre: "Caro", fecha_nacimiento: "1992-08-13" },
    ];
    expect(proximosCumpleanios(personas, new Date(2026, 7, 5))).toMatchObject([{ id: 1, dias_hasta: 0 }, { id: 2, dias_hasta: 7 }]);
  });

  it("ordena correctamente al cruzar fin de año", () => {
    const resultado = proximosCumpleanios([{ id: 1, nombre: "Enero", fecha_nacimiento: "1990-01-01" }], new Date(2026, 11, 30));
    expect(resultado[0].dias_hasta).toBe(2);
  });
});

describe("telefonoWhatsApp", () => {
  it("normaliza un número argentino", () => {
    expect(telefonoWhatsApp("+54 9 351 555-1234")).toBe("5493515551234");
  });
});
