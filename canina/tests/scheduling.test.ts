import { describe, expect, it } from "vitest";
import { findConflict, freeSlots, freeSlotsAnyStaff, subtract } from "@/features/scheduling/domain/availability";
import { resolveServicePrice, sizeFromWeight } from "@/features/catalog/domain/pricing";
import { dragToStart, DEFAULT_GRID } from "@/features/agenda/domain/grid";
import { canTransition } from "@/features/agenda/domain/status";
import { atLocalMinutes, localMinutes } from "@/lib/time";

const H = (h: number, m = 0) => h * 60 + m;

describe("disponibilidad", () => {
  const ana = { staffId: "ana", working: [{ start: H(9), end: H(14) }, { start: H(16), end: H(20) }], busy: [{ start: H(10), end: H(11, 30) }] };

  it("resta intervalos", () => expect(subtract([{ start: 0, end: 100 }], [{ start: 20, end: 30 }, { start: 90, end: 120 }])).toEqual([{ start: 0, end: 20 }, { start: 30, end: 90 }]));

  it("huecos de 60 min respetando citas y turno partido", () => {
    const starts = freeSlots(ana, 60, { granularity: 30 }).map((s) => s.start);
    expect(starts).toContain(H(9));
    expect(starts).not.toContain(H(9, 30)); // chocaría con la cita de las 10:00
    expect(starts).toContain(H(11, 30));
    expect(starts).not.toContain(H(13, 30)); // acabaría a las 14:30, fuera de turno
    expect(starts).toContain(H(16));
  });

  it("'cualquiera' asigna al peluquero menos cargado", () => {
    const luis = { staffId: "luis", working: [{ start: H(9), end: H(14) }], busy: [] };
    const s = freeSlotsAnyStaff([ana, luis], 60, { granularity: 60 });
    expect(s.find((x) => x.start === H(9))?.staffId).toBe("luis");
  });

  it("detecta solape, bloqueo y fuera de horario al mover", () => {
    const appts = [{ id: "a1", start: H(10), end: H(11) }];
    expect(findConflict({ start: H(10, 30), end: H(11, 30) }, ana.working, appts, [])?.kind).toBe("OVERLAP");
    expect(findConflict({ start: H(10), end: H(11) }, ana.working, appts, [], "a1")).toBeNull(); // la propia cita no cuenta
    expect(findConflict({ start: H(13, 30), end: H(14, 30) }, ana.working, appts, [])?.kind).toBe("OUTSIDE_HOURS");
    expect(findConflict({ start: H(12), end: H(13) }, ana.working, appts, [{ start: H(12, 30), end: H(13) }])?.kind).toBe("BLOCKED");
  });
});

describe("tarifas", () => {
  const svc = {
    basePriceCents: 3000, baseDurationMin: 60, bufferAfterMin: 10,
    pricing: [
      { size: "SMALL" as const, coatType: null, priceCents: 2500, durationMin: 45 },
      { size: "LARGE" as const, coatType: null, priceCents: 4500, durationMin: 90 },
      { size: "LARGE" as const, coatType: "DOUBLE" as const, priceCents: 6000, durationMin: 120 },
    ],
  };
  it("tamaño + pelo tiene prioridad", () => expect(resolveServicePrice(svc, { size: "LARGE", coatType: "DOUBLE" })).toMatchObject({ priceCents: 6000, durationMin: 120, blockMin: 130 }));
  it("solo tamaño", () => expect(resolveServicePrice(svc, { size: "LARGE", coatType: "SHORT" }).priceCents).toBe(4500));
  it("sin tarifa → base", () => expect(resolveServicePrice(svc, { size: "MEDIUM", coatType: "SHORT" })).toMatchObject({ priceCents: 3000, matched: "base" }));
  it("tamaño por peso", () => expect([4, 12, 30, 50].map(sizeFromWeight)).toEqual(["SMALL", "MEDIUM", "LARGE", "GIANT"]));
});

describe("agenda drag-and-drop", () => {
  it("convierte píxeles a minutos con snap de 15", () => {
    expect(dragToStart(H(10), 60, 40 * DEFAULT_GRID.pxPerMin)).toBe(H(10, 45)); // +40 min → 10:45 (snap)
    expect(dragToStart(H(10), 60, 7 * DEFAULT_GRID.pxPerMin)).toBe(H(10)); // +7 min → 10:00
    expect(dragToStart(H(8, 30), 60, -500)).toBe(DEFAULT_GRID.dayStartMin); // no sale del día
  });
  it("máquina de estados", () => {
    expect(canTransition("CONFIRMED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("COMPLETED", "PENDING")).toBe(false);
  });
});

describe("zona horaria Europe/Madrid", () => {
  it("10:00 en verano = 08:00Z; en invierno = 09:00Z", () => {
    expect(atLocalMinutes("2026-07-01", H(10)).toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(atLocalMinutes("2026-12-01", H(10)).toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(localMinutes(new Date("2026-12-01T09:00:00Z"))).toBe(H(10));
  });
});
