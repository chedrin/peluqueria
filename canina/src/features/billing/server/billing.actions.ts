"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { DomainError, toActionResult } from "@/lib/errors";
import { computeRedeem } from "@/features/loyalty/domain/rules";
import { calculateInvoice } from "../domain/calculator";
import { createDraftFromAppointment, createRectifyingDraft, issueInvoice, registerPayment, updateDraft } from "./invoice.service";

const CASHIER = ["ADMIN", "RECEPTION"] as const;
const invoiceType = z.enum(["STANDARD", "SIMPLIFIED"]);

export async function createInvoiceFromAppointmentAction(appointmentId: string, type: z.infer<typeof invoiceType>) {
  return toActionResult(async () => {
    const s = await requireRole([...CASHIER]);
    const existing = await prisma.invoice.findFirst({ where: { appointmentId, status: "DRAFT" } });
    if (existing) return { id: existing.id };
    const inv = await createDraftFromAppointment(appointmentId, { type: invoiceType.parse(type), actorId: s.sub });
    return { id: inv.id };
  });
}

export async function updateDraftAction(invoiceId: string, p: { type?: "STANDARD" | "SIMPLIFIED"; withholdingBp?: number }) {
  return toActionResult(async () => {
    const s = await requireRole([...CASHIER]);
    await updateDraft(invoiceId, { ...p, actorId: s.sub });
    revalidatePath(`/admin/facturas/${invoiceId}`);
  });
}

export async function issueInvoiceAction(invoiceId: string) {
  return toActionResult(async () => {
    const s = await requireRole([...CASHIER]);
    const inv = await issueInvoice(invoiceId, s.sub);
    revalidatePath(`/admin/facturas/${invoiceId}`);
    revalidatePath("/admin/facturas");
    return { fullNumber: inv.fullNumber };
  });
}

const paySchema = z.object({
  invoiceId: z.string(),
  method: z.enum(["CASH", "CARD", "BIZUM", "TRANSFER"]),
  amountCents: z.number().int(),
  reference: z.string().optional(),
});

export async function registerPaymentAction(input: z.infer<typeof paySchema>) {
  return toActionResult(async () => {
    const s = await requireRole([...CASHIER]);
    const p = paySchema.parse(input);
    await registerPayment(p.invoiceId, { ...p, actorId: s.sub });
    revalidatePath(`/admin/facturas/${p.invoiceId}`);
  });
}

export async function rectifyInvoiceAction(invoiceId: string, reason: string) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN"]);
    if (reason.trim().length < 5) throw new DomainError("VALIDATION", "Describe el motivo de la rectificación.");
    const draft = await createRectifyingDraft(invoiceId, { reason, actorId: s.sub });
    return { id: draft.id };
  });
}

/** Canjea puntos como descuento en un borrador (línea negativa al 21 %). */
export async function redeemPointsOnDraftAction(invoiceId: string, points: number) {
  return toActionResult(async () => {
    const s = await requireRole([...CASHIER]);
    return prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: true } });
      if (!inv || inv.status !== "DRAFT" || !inv.ownerId) throw new DomainError("INVALID_STATE", "Solo en borradores con cliente.");
      const [rules, card] = await Promise.all([
        tx.loyaltyProgram.findUniqueOrThrow({ where: { id: "default" } }),
        tx.loyaltyCard.findUnique({ where: { ownerId: inv.ownerId } }),
      ]);
      if (!card) throw new DomainError("NOT_FOUND", "El cliente no tiene tarjeta de fidelización.");
      let discount: number;
      try {
        discount = computeRedeem(rules, card.pointsBalance, points);
      } catch (e) {
        throw new DomainError("LOYALTY", (e as Error).message);
      }
      discount = Math.min(discount, inv.totalCents);

      const lines = [
        ...inv.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPriceCents: i.unitPriceCents, discountBp: i.discountBp, taxRate: i.taxRate, exemptionCause: i.exemptionCause ?? undefined })),
        { description: `Descuento fidelización (${points} puntos)`, quantity: 1, unitPriceCents: -discount, taxRate: "GENERAL_21" as const },
      ];
      const calc = calculateInvoice(lines, { pricesIncludeTax: inv.pricesIncludeTax, withholdingBp: inv.withholdingRate });
      const last = calc.lines[calc.lines.length - 1];
      await tx.invoiceItem.create({
        data: {
          invoiceId, position: last.position, description: last.description, quantity: 1, unitPriceCents: last.unitPriceCents,
          netUnitPriceCents: last.netUnitPriceCents, taxRate: last.taxRate, taxRateBp: last.taxRateBp, baseCents: last.baseCents, taxCents: last.taxCents, totalCents: last.totalCents,
        },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { subtotalCents: calc.subtotalCents, taxCents: calc.taxCents, totalCents: calc.totalCents, withholdingCents: calc.withholdingCents, taxBreakdown: calc.breakdown },
      });
      await tx.loyaltyCard.update({ where: { id: card.id }, data: { pointsBalance: { decrement: points } } });
      await tx.loyaltyTransaction.create({ data: { cardId: card.id, type: "REDEEM", points: -points, invoiceId, note: `Descuento ${discount} cts` } });
      await audit(tx, { actorId: s.sub, action: "UPDATE", entity: "Invoice", entityId: invoiceId, after: { loyaltyDiscountCents: discount, points } });
      revalidatePath(`/admin/facturas/${invoiceId}`);
      return { discountCents: discount };
    });
  });
}
