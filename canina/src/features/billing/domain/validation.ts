import type { InvoiceType } from "@prisma/client";
import { isValidSpanishTaxId } from "./nif";
import type { InvoiceCalculation } from "./calculator";

export type InvoiceValidationInput = {
  type: InvoiceType;
  calc: InvoiceCalculation;
  customer?: { name?: string | null; taxId?: string | null; address?: string | null };
  issuer: { name: string; taxId: string; address: string };
  rectifies?: { id: string; reason: string } | null;
  /** Límite de factura simplificada en céntimos (IVA incluido). Por defecto 400 €. */
  simplifiedLimitCents?: number;
};

export type InvoiceValidationIssue = { field: string; message: string };

/**
 * Validación fiscal previa a la emisión (RD 1619/2012, Reglamento de facturación).
 * Devuelve la lista de incidencias; vacía = factura emitible.
 */
export function validateInvoice(input: InvoiceValidationInput): InvoiceValidationIssue[] {
  const issues: InvoiceValidationIssue[] = [];
  const { calc, type } = input;
  const limit = input.simplifiedLimitCents ?? 40_000;

  // Emisor (art. 6.1.c-e / 7.1.d)
  if (!input.issuer.name) issues.push({ field: "issuer.name", message: "Falta la razón social del emisor." });
  if (!isValidSpanishTaxId(input.issuer.taxId))
    issues.push({ field: "issuer.taxId", message: "El NIF del emisor no es válido." });
  if (!input.issuer.address) issues.push({ field: "issuer.address", message: "Falta el domicilio del emisor." });

  // Líneas
  if (calc.lines.length === 0) issues.push({ field: "lines", message: "La factura no tiene conceptos." });
  calc.lines.forEach((l, i) => {
    if (!l.description.trim()) issues.push({ field: `lines.${i}.description`, message: "Concepto vacío." });
    if (l.quantity === 0) issues.push({ field: `lines.${i}.quantity`, message: "Cantidad 0." });
    if (l.taxRate === "EXEMPT" && !l.exemptionCause)
      issues.push({
        field: `lines.${i}.exemptionCause`,
        message: "Las operaciones exentas deben indicar el precepto de exención (art. 6.1.j).",
      });
  });

  // Importes negativos solo en rectificativas
  if (type !== "RECTIFYING" && calc.totalCents < 0)
    issues.push({ field: "total", message: "Un importe negativo requiere factura rectificativa." });

  if (type === "SIMPLIFIED") {
    // Art. 4.1.a: hasta 400 € IVA incluido
    if (Math.abs(calc.totalCents) > limit)
      issues.push({
        field: "total",
        message: `El importe supera el límite de factura simplificada (${(limit / 100).toFixed(2)} €). Emite factura completa.`,
      });
    if (calc.withholdingCents !== 0)
      issues.push({ field: "withholding", message: "Las facturas simplificadas no admiten retención IRPF." });
  }

  if (type === "STANDARD" || (type === "RECTIFYING" && input.customer?.taxId)) {
    // Art. 6.1.d-e: datos completos del destinatario
    const c = input.customer ?? {};
    if (!c.name) issues.push({ field: "customer.name", message: "Falta el nombre del destinatario." });
    if (!c.taxId || !isValidSpanishTaxId(c.taxId))
      issues.push({ field: "customer.taxId", message: "NIF/DNI/NIE del destinatario no válido." });
    if (!c.address) issues.push({ field: "customer.address", message: "Falta el domicilio del destinatario." });
  }

  if (type === "RECTIFYING") {
    // Art. 15: identificar la factura rectificada y el motivo
    if (!input.rectifies?.id)
      issues.push({ field: "rectifies", message: "Indica la factura que se rectifica." });
    if (!input.rectifies?.reason?.trim())
      issues.push({ field: "rectifyReason", message: "Indica el motivo de la rectificación." });
  }

  if (calc.withholdingCents < 0 || calc.withholdingBp > 10_000)
    issues.push({ field: "withholding", message: "Retención IRPF no válida." });

  return issues;
}
