import type { TaxRate } from "@prisma/client";
import { applyBp, roundHalfUp } from "@/lib/money";
import { TAX_RATE_BP } from "./tax";

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  /** Precio unitario en céntimos. Sin IVA salvo que `pricesIncludeTax` sea true. */
  unitPriceCents: number;
  /** Descuento de línea en bp (1000 = 10 %) */
  discountBp?: number;
  taxRate: TaxRate;
  exemptionCause?: string;
  serviceId?: string;
  productId?: string;
  voucherId?: string;
};

export type CalculatedLine = InvoiceLineInput & {
  position: number;
  taxRateBp: number;
  /** Precio unitario normalizado SIN IVA (lo que exige el art. 6.1.f RD 1619/2012) */
  netUnitPriceCents: number;
  baseCents: number;
  taxCents: number;
  totalCents: number;
};

export type TaxBreakdownRow = { taxRate: TaxRate; rateBp: number; baseCents: number; taxCents: number };

export type InvoiceCalculation = {
  lines: CalculatedLine[];
  breakdown: TaxBreakdownRow[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  withholdingBp: number;
  withholdingCents: number;
  totalCents: number;
};

/**
 * Calcula una factura conforme a la práctica española:
 *  - La cuota de IVA se calcula sobre la BASE AGREGADA de cada tipo (no sumando
 *    cuotas redondeadas por línea), lo que evita descuadres de céntimos.
 *  - Con `pricesIncludeTax` (tickets/PVP) el total por tipo se respeta al céntimo
 *    y la base se obtiene por división: base = PVP / (1 + tipo).
 *  - La retención IRPF se aplica sobre la suma de bases.
 */
export function calculateInvoice(
  inputLines: InvoiceLineInput[],
  opts: { pricesIncludeTax?: boolean; withholdingBp?: number } = {},
): InvoiceCalculation {
  const inclusive = !!opts.pricesIncludeTax;
  const withholdingBp = opts.withholdingBp ?? 0;

  type Group = { taxRate: TaxRate; rateBp: number; amount: number };
  const groups = new Map<TaxRate, Group>();
  let discountCents = 0;

  const lines: CalculatedLine[] = inputLines.map((l, i) => {
    const rateBp = TAX_RATE_BP[l.taxRate];
    const gross = l.quantity * l.unitPriceCents;
    const disc = applyBp(gross, l.discountBp ?? 0);
    const amount = roundHalfUp(gross - disc); // base (exclusivo) o PVP (inclusivo)

    const baseCents = inclusive ? roundHalfUp((amount * 10_000) / (10_000 + rateBp)) : amount;
    const taxCents = inclusive ? amount - baseCents : applyBp(baseCents, rateBp);
    const netUnit = inclusive ? roundHalfUp((l.unitPriceCents * 10_000) / (10_000 + rateBp)) : l.unitPriceCents;
    discountCents += inclusive ? roundHalfUp((disc * 10_000) / (10_000 + rateBp)) : disc;

    const g = groups.get(l.taxRate) ?? { taxRate: l.taxRate, rateBp, amount: 0 };
    g.amount += amount;
    groups.set(l.taxRate, g);

    return {
      ...l,
      position: i + 1,
      taxRateBp: rateBp,
      netUnitPriceCents: netUnit,
      baseCents,
      taxCents,
      totalCents: baseCents + taxCents,
    };
  });

  const breakdown: TaxBreakdownRow[] = [...groups.values()]
    .sort((a, b) => b.rateBp - a.rateBp)
    .map((g) => {
      const baseCents = inclusive ? roundHalfUp((g.amount * 10_000) / (10_000 + g.rateBp)) : g.amount;
      const taxCents = inclusive ? g.amount - baseCents : applyBp(baseCents, g.rateBp);
      return { taxRate: g.taxRate, rateBp: g.rateBp, baseCents, taxCents };
    });

  const subtotalCents = breakdown.reduce((s, r) => s + r.baseCents, 0);
  const taxCents = breakdown.reduce((s, r) => s + r.taxCents, 0);
  const withholdingCents = applyBp(subtotalCents, withholdingBp);

  return {
    lines,
    breakdown,
    subtotalCents,
    discountCents,
    taxCents,
    withholdingBp,
    withholdingCents,
    totalCents: subtotalCents + taxCents - withholdingCents,
  };
}
