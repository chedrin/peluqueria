"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { toActionResult } from "@/lib/errors";
import { createDraftInvoice } from "@/features/billing/server/invoice.service";
import { redeemVoucherSession, reverseVoucherSession, sellVoucher } from "./voucher.service";

export async function redeemVoucherAction(voucherId: string, appointmentServiceId: string) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "RECEPTION"]);
    const r = await redeemVoucherSession({ voucherId, appointmentServiceId, actorId: s.sub });
    revalidatePath("/admin/caja");
    return { remaining: r.remaining };
  });
}

export async function reverseVoucherAction(appointmentServiceId: string) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "RECEPTION"]);
    const line = await prisma.appointmentService.findUniqueOrThrow({
      where: { id: appointmentServiceId },
      include: { appointment: { include: { dog: true } }, service: { include: { pricing: true } } },
    });
    // Restaurar el precio de tarifa vigente para ese perro
    const { resolveServicePrice } = await import("@/features/catalog/domain/pricing");
    const price = resolveServicePrice(
      { ...line.service, pricing: line.service.pricing.map((p) => ({ ...p, minWeightKg: p.minWeightKg?.toNumber(), maxWeightKg: p.maxWeightKg?.toNumber() })) },
      { size: line.appointment.dog.size, coatType: line.appointment.dog.coatType, weightKg: line.appointment.dog.currentWeightKg?.toNumber() },
    );
    await reverseVoucherSession({ appointmentServiceId, actorId: s.sub, restorePriceCents: price.priceCents });
    revalidatePath("/admin/caja");
  });
}

/** Vende un bono y genera el borrador de factura de la venta (el IVA se devenga al cobrarlo). */
export async function sellVoucherAction(input: { productId: string; ownerId: string; dogId?: string }) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "RECEPTION"]);
    const voucher = await sellVoucher({ ...input, actorId: s.sub });
    const product = await prisma.voucherProduct.findUniqueOrThrow({ where: { id: input.productId } });
    const invoice = await createDraftInvoice({
      type: "SIMPLIFIED",
      ownerId: input.ownerId,
      lines: [{ description: `${product.name} (bono ${voucher.code}, ${product.totalSessions} sesiones)`, quantity: 1, unitPriceCents: product.priceCents, taxRate: product.taxRate, voucherId: voucher.id }],
      actorId: s.sub,
    });
    await prisma.voucher.update({ where: { id: voucher.id }, data: { saleInvoiceId: invoice.id } });
    revalidatePath("/admin/bonos");
    return { voucherId: voucher.id, invoiceId: invoice.id };
  });
}

const productSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  totalSessions: z.number().int().min(1).max(100),
  validityDays: z.number().int().min(1).max(1095),
  size: z.enum(["SMALL", "MEDIUM", "LARGE", "GIANT"]).nullable(),
  serviceIds: z.array(z.string()).min(1, "Selecciona al menos un servicio"),
});

export async function createVoucherProductAction(input: z.input<typeof productSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN"]);
    const { serviceIds, ...p } = productSchema.parse(input);
    const product = await prisma.voucherProduct.create({ data: { ...p, services: { create: serviceIds.map((serviceId) => ({ serviceId })) } } });
    await audit(prisma, { actorId: s.sub, action: "CREATE", entity: "VoucherProduct", entityId: product.id, after: product });
    revalidatePath("/admin/bonos");
  });
}

export async function toggleVoucherProductAction(id: string, isActive: boolean) {
  return toActionResult(async () => {
    await requireRole(["ADMIN"]);
    await prisma.voucherProduct.update({ where: { id }, data: { isActive } });
    revalidatePath("/admin/bonos");
  });
}
