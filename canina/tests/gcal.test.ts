import { describe, expect, it } from "vitest";
import { blockSummary, mapSize, matchServices, normalizePhone, parseAgentEvent, samePhone } from "@/features/gcal/domain/mapping";

const services = [
  { id: "1", name: "Baño básico", slug: "bano-basico" },
  { id: "2", name: "Corte a tijera", slug: "corte-tijera" },
  { id: "3", name: "Stripping", slug: "stripping" },
  { id: "4", name: "Corte de uñas", slug: "corte-unas" },
];

describe("eventos del agente de WhatsApp", () => {
  it("lee perro, servicio, tamaño y datos del cliente", () => {
    const b = parseAgentEvent({
      summary: "Toby · Baño y Corte Completo (Mediano)",
      description: "Teléfono: +34600112233\nCliente: Ana López\nRaza: sin indicar\nNotas: ninguna\nReservado por el agente de WhatsApp",
      extendedProperties: { private: { telefono: "34600112233", perro: "Toby", origen: "agente-whatsapp" } },
    });
    expect(b).toEqual({ phone: "34600112233", dogName: "Toby", serviceText: "Baño y Corte Completo", sizeText: "Mediano", clientName: "Ana López", breed: null, notes: null });
  });

  it("ignora eventos que no son del agente", () => {
    expect(parseAgentEvent({ summary: "Dentista", extendedProperties: { private: {} } })).toBeNull();
    expect(parseAgentEvent({ summary: "Cerrado" })).toBeNull();
  });

  it("normaliza teléfonos españoles y los compara por los últimos 9 dígitos", () => {
    expect(normalizePhone("600 11 22 33")).toBe("34600112233");
    expect(normalizePhone("+34 600-112-233")).toBe("34600112233");
    expect(normalizePhone("0034600112233")).toBe("34600112233");
    expect(samePhone("+34 600 11 22 33", "34600112233")).toBe(true);
    expect(samePhone("600112233", "600112234")).toBe(false);
    expect(samePhone(null, "600112233")).toBe(false);
  });

  it("traduce tamaños y servicios", () => {
    expect(mapSize("Toy")).toBe("SMALL");
    expect(mapSize("Mediano")).toBe("MEDIUM");
    expect(mapSize("Grande (20 - 35 kg)")).toBe("LARGE");
    expect(mapSize("Gigante")).toBe("GIANT");
    expect(matchServices("Baño y Corte Completo", services).map((s) => s.slug)).toEqual(["bano-basico", "corte-tijera"]);
    expect(matchServices("Baño Básico e Higiene", services).map((s) => s.slug)).toEqual(["bano-basico"]);
    expect(matchServices("Stripping / Manto Duro", services).map((s) => s.slug)).toEqual(["stripping"]);
    expect(matchServices("Corte de uñas", services).map((s) => s.slug)).toEqual(["corte-unas"]);
    expect(matchServices("Algo raro", services)).toEqual([]);
  });

  it("los bloqueos de todo el salón empiezan por «Bloqueo» para que el agente cierre el turno", () => {
    expect(blockSummary("HOLIDAY", "Puente", null)).toBe("Bloqueo · Vacaciones: Puente");
    expect(blockSummary("SICK_LEAVE", null, "Laura")).toBe("Ausencia · Laura · Baja");
  });
});
