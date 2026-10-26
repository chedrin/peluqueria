import { describe, expect, it } from "vitest";
import { checkRedemption, nextVoucherStatus, type VoucherSnapshot } from "@/features/vouchers/domain/voucher-rules";
import { computeEarn, computeRedeem, stampsRewardReady } from "@/features/loyalty/domain/rules";

const voucher: VoucherSnapshot = {
  id: "v1", ownerId: "o1", dogId: null, status: "ACTIVE", totalSessions: 6, usedSessions: 2,
  expiresAt: new Date("2027-01-01"), productSize: "MEDIUM", allowedServiceIds: ["bano"],
};
const target = { ownerId: "o1", dogId: "d1", dogSize: "MEDIUM" as const, serviceId: "bano", serviceDate: new Date("2026-11-01") };

describe("consumo de bono", () => {
  it("consume la siguiente sesión", () => expect(checkRedemption(voucher, target)).toEqual({ ok: true, sessionNumber: 3, remainingAfter: 3 }));
  it.each([
    ["otro dueño", { ...target, ownerId: "o2" }, {}],
    ["otro perro (nominativo)", target, { dogId: "d9" }],
    ["caducado el día de la cita", { ...target, serviceDate: new Date("2027-02-01") }, {}],
    ["sin sesiones", target, { usedSessions: 6 }],
    ["otro tamaño", { ...target, dogSize: "GIANT" as const }, {}],
    ["servicio no incluido", { ...target, serviceId: "corte" }, {}],
    ["bono cancelado", target, { status: "CANCELLED" as const }],
  ])("rechaza: %s", (_, t, v) => expect(checkRedemption({ ...voucher, ...v }, t).ok).toBe(false));

  it("estado tras consumir la última sesión", () => {
    expect(nextVoucherStatus(6, 6, new Date("2027-01-01"))).toBe("EXHAUSTED");
    expect(nextVoucherStatus(6, 5, new Date("2020-01-01"))).toBe("EXPIRED");
    expect(nextVoucherStatus(6, 5, new Date("2099-01-01"))).toBe("ACTIVE");
  });
});

describe("fidelización", () => {
  const rules = { mode: "POINTS" as const, isActive: true, pointsPerEuro: 1, centsPer100Points: 500, minPointsToRedeem: 100, stampsForReward: 10 };
  it("1 punto por euro completo", () => expect(computeEarn(rules, 4599, true)).toEqual({ points: 45, stamps: 0 }));
  it("sellos por visita", () => expect(computeEarn({ ...rules, mode: "STAMPS" }, 4599, true)).toEqual({ points: 0, stamps: 1 }));
  it("canje: 200 puntos = 10 €", () => expect(computeRedeem(rules, 250, 200)).toBe(1000));
  it("canje bajo mínimo o sin saldo lanza error", () => {
    expect(() => computeRedeem(rules, 250, 50)).toThrow();
    expect(() => computeRedeem(rules, 150, 200)).toThrow();
  });
  it("tarjeta de sellos completa", () => expect(stampsRewardReady({ ...rules, mode: "STAMPS" }, 10)).toBe(true));
});
