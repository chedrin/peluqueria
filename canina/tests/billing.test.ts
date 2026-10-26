import { describe, expect, it } from "vitest";
import { calculateInvoice } from "@/features/billing/domain/calculator";
import { validateInvoice } from "@/features/billing/domain/validation";
import { isValidSpanishTaxId } from "@/features/billing/domain/nif";
import { buildChainString, computeInvoiceHash, formatInvoiceNumber } from "@/features/billing/domain/verifactu";

const issuer = { name: "Peluquería Canina CANIA S.L.", taxId: "B12345674", address: "C/ Mayor 1, 28001 Madrid" };

describe("calculateInvoice", () => {
  it("ticket con PVP: respeta el total al céntimo y desglosa base y cuota 21 %", () => {
    const c = calculateInvoice([{ description: "Baño mediano", quantity: 1, unitPriceCents: 3500, taxRate: "GENERAL_21" }], { pricesIncludeTax: true });
    expect(c.totalCents).toBe(3500);
    expect(c.subtotalCents).toBe(2893); // 35 / 1,21 = 28,925… → 28,93
    expect(c.taxCents).toBe(607);
  });

  it("agrupa por tipo y calcula la cuota sobre la base agregada (no suma de cuotas redondeadas)", () => {
    const lines = Array.from({ length: 3 }, () => ({ description: "Corte uñas", quantity: 1, unitPriceCents: 333, taxRate: "GENERAL_21" as const }));
    const c = calculateInvoice(lines);
    expect(c.subtotalCents).toBe(999);
    expect(c.taxCents).toBe(210); // 999 × 21 % = 209,79 → 210 (por línea saldría 70×3 = 210 aquí; ver caso siguiente)
    const c2 = calculateInvoice(Array.from({ length: 3 }, () => ({ description: "x", quantity: 1, unitPriceCents: 102, taxRate: "GENERAL_21" as const })));
    // por línea: 21,42 → 21 ×3 = 63; agregado: 306 × 0,21 = 64,26 → 64
    expect(c2.taxCents).toBe(64);
  });

  it("varios tipos de IVA + exento", () => {
    const c = calculateInvoice([
      { description: "Corte a tijera", quantity: 1, unitPriceCents: 4000, taxRate: "GENERAL_21" },
      { description: "Pienso 3 kg", quantity: 2, unitPriceCents: 1500, taxRate: "REDUCED_10" },
      { description: "Servicio veterinario", quantity: 1, unitPriceCents: 2000, taxRate: "EXEMPT", exemptionCause: "E1 - Art. 20 LIVA" },
    ]);
    expect(c.breakdown.map((b) => [b.taxRate, b.baseCents, b.taxCents])).toEqual([
      ["GENERAL_21", 4000, 840],
      ["REDUCED_10", 3000, 300],
      ["EXEMPT", 2000, 0],
    ]);
    expect(c.totalCents).toBe(10140);
  });

  it("aplica descuento de línea y retención IRPF sobre la base", () => {
    const c = calculateInvoice([{ description: "Pack", quantity: 1, unitPriceCents: 10000, discountBp: 1000, taxRate: "GENERAL_21" }], { withholdingBp: 1500 });
    expect(c.subtotalCents).toBe(9000);
    expect(c.discountCents).toBe(1000);
    expect(c.taxCents).toBe(1890);
    expect(c.withholdingCents).toBe(1350);
    expect(c.totalCents).toBe(9000 + 1890 - 1350);
  });

  it("servicio pagado con bono → línea a 0 €", () => {
    const c = calculateInvoice([{ description: "Baño (bono)", quantity: 1, unitPriceCents: 0, taxRate: "GENERAL_21" }], { pricesIncludeTax: true });
    expect(c.totalCents).toBe(0);
  });
});

describe("validateInvoice", () => {
  const simple = (total: number) => calculateInvoice([{ description: "Servicio", quantity: 1, unitPriceCents: total, taxRate: "GENERAL_21" }], { pricesIncludeTax: true });

  it("ticket correcto sin datos del cliente", () => {
    expect(validateInvoice({ type: "SIMPLIFIED", calc: simple(4500), issuer })).toEqual([]);
  });

  it("rechaza ticket por encima de 400 €", () => {
    const issues = validateInvoice({ type: "SIMPLIFIED", calc: simple(40001), issuer });
    expect(issues.map((i) => i.field)).toContain("total");
  });

  it("factura completa exige NIF válido y domicilio del destinatario", () => {
    const bad = validateInvoice({ type: "STANDARD", calc: simple(5000), issuer, customer: { name: "Ana", taxId: "12345678A" } });
    expect(bad.map((i) => i.field)).toEqual(expect.arrayContaining(["customer.taxId", "customer.address"]));
    const ok = validateInvoice({ type: "STANDARD", calc: simple(5000), issuer, customer: { name: "Ana", taxId: "12345678Z", address: "C/ Sol 2" } });
    expect(ok).toEqual([]);
  });

  it("exento sin causa y negativo fuera de rectificativa son errores", () => {
    const c = calculateInvoice([{ description: "x", quantity: -1, unitPriceCents: 100, taxRate: "EXEMPT" }]);
    const fields = validateInvoice({ type: "SIMPLIFIED", calc: c, issuer }).map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(["lines.0.exemptionCause", "total"]));
  });

  it("rectificativa exige referencia y motivo", () => {
    const c = simple(-3500);
    expect(validateInvoice({ type: "RECTIFYING", calc: c, issuer }).map((i) => i.field)).toEqual(expect.arrayContaining(["rectifies", "rectifyReason"]));
    expect(validateInvoice({ type: "RECTIFYING", calc: c, issuer, rectifies: { id: "x", reason: "Error en precio" } })).toEqual([]);
  });
});

describe("NIF/NIE/CIF", () => {
  it.each([
    ["12345678Z", true],
    ["12345678A", false],
    ["X1234567L", true],
    ["Y1234567X", true],
    ["B12345674", true],
    ["B12345675", false],
    ["Q2826000H", true],
  ])("%s → %s", (id, ok) => expect(isValidSpanishTaxId(id)).toBe(ok));
});

describe("Veri*Factu", () => {
  const rec = {
    issuerTaxId: "B12345674",
    fullNumber: formatInvoiceNumber("T", 2026, 7),
    issueDate: new Date("2026-10-26T10:00:00Z"),
    aeatType: "F2" as const,
    taxCents: 607,
    totalCents: 3500,
    previousHash: null,
    generatedAt: new Date("2026-10-26T10:00:00Z"),
  };
  it("numeración con serie, año y ceros", () => expect(rec.fullNumber).toBe("T2026-000007"));
  it("cadena con el formato de la especificación", () =>
    expect(buildChainString(rec)).toBe(
      "IDEmisorFactura=B12345674&NumSerieFactura=T2026-000007&FechaExpedicionFactura=26-10-2026&TipoFactura=F2&CuotaTotal=6.07&ImporteTotal=35.00&Huella=&FechaHoraHusoGenRegistro=2026-10-26T10:00:00+00:00",
    ));
  it("el encadenamiento cambia la huella si se altera la anterior", () => {
    const h1 = computeInvoiceHash(rec);
    expect(h1).toMatch(/^[0-9A-F]{64}$/);
    expect(computeInvoiceHash({ ...rec, previousHash: h1 })).not.toBe(h1);
    expect(computeInvoiceHash({ ...rec, totalCents: 3501 })).not.toBe(h1);
  });
});
