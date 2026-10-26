import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { checkRedemption, nextVoucherStatus } from "../domain/voucher-rules";

/**
 * FLUJO DE CONSUMO DE UNA SESIÓN DE BONO EN UNA CITA
 *
 *  1. Cargar la línea de servicio de la cita + perro + bono (con servicios incluidos).
 *  2. Validar reglas puras (`checkRedemption`): titular, perro, caducidad, tamaño,
 *     servicio incluido y sesiones restantes.
 *  3. Incrementar `usedSessions` con bloqueo optimista (`where: { version }`):
 *     si otra caja consumió la misma sesión a la vez, `count === 0` → error.
 *  4. Crear `VoucherRedemption` (índice único parcial: una sola redención activa por línea).
 *  5. Poner el precio de la línea a 0 (la venta del bono ya tributó) y auditar.
 *
 *  Todo en una transacción: o se consume todo o nada.
 */
export async function redeemVoucherSession(p: { voucherId: string; appointmentServiceId: string; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.appointmentService.findUnique({
      where: { id: p.appointmentServiceId },
      include: { appointment: { include: { dog: true } }, redemptions: { where: { reversedAt: null } } },
    });
    if (!line) throw new DomainError("NOT_FOUND", "Línea de servicio no encontrada.");
    if (line.redemptions.length > 0)
      throw new DomainError("ALREADY_REDEEMED", "Este servicio ya se pagó con un bono.");
    if (["CANCELLED", "NO_SHOW"].includes(line.appointment.status))
      throw new DomainError("INVALID_STATE", "No se puede consumir bono en una cita cancelada.");

    const voucher = await tx.voucher.findUnique({
      where: { id: p.voucherId },
      include: { product: { include: { services: true } } },
    });
    if (!voucher) throw new DomainError("NOT_FOUND", "Bono no encontrado.");

    const check = checkRedemption(
      {
        id: voucher.id,
        ownerId: voucher.ownerId,
        dogId: voucher.dogId,
        status: voucher.status,
        totalSessions: voucher.totalSessions,
        usedSessions: voucher.usedSessions,
        expiresAt: voucher.expiresAt,
        productSize: voucher.product.size,
        allowedServiceIds: voucher.product.services.map((s) => s.serviceId),
      },
      {
        ownerId: line.appointment.ownerId,
        dogId: line.appointment.dogId,
        dogSize: line.appointment.dog.size,
        serviceId: line.serviceId,
        serviceDate: line.appointment.startsAt,
      },
    );
    if (!check.ok) throw new DomainError("VOUCHER_NOT_APPLICABLE", check.reason);

    const used = voucher.usedSessions + 1;
    const updated = await tx.voucher.updateMany({
      where: { id: voucher.id, version: voucher.version },
      data: {
        usedSessions: used,
        version: { increment: 1 },
        status: nextVoucherStatus(voucher.totalSessions, used, voucher.expiresAt),
      },
    });
    if (updated.count === 0)
      throw new DomainError("CONCURRENT_UPDATE", "El bono se ha modificado a la vez desde otro puesto. Reintenta.");

    const redemption = await tx.voucherRedemption.create({
      data: {
        voucherId: voucher.id,
        appointmentId: line.appointmentId,
        appointmentServiceId: line.id,
        sessionNumber: check.sessionNumber,
        redeemedById: p.actorId,
      },
    });
    await tx.appointmentService.update({ where: { id: line.id }, data: { priceCents: 0 } });

    await audit(tx, {
      actorId: p.actorId,
      action: "CONSUME",
      entity: "Voucher",
      entityId: voucher.id,
      before: { usedSessions: voucher.usedSessions },
      after: { usedSessions: used, appointmentId: line.appointmentId, sessionNumber: check.sessionNumber },
    });
    return { redemption, remaining: check.remainingAfter };
  });
}

/**
 * Revierte una sesión (p.ej. la cita se canceló tras consumirla).
 * La redención se MARCA como revertida (trazabilidad) y se devuelve la sesión.
 */
export async function reverseVoucherSession(p: { appointmentServiceId: string; actorId: string; restorePriceCents: number }) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.voucherRedemption.findFirst({
      where: { appointmentServiceId: p.appointmentServiceId, reversedAt: null },
      include: { voucher: true },
    });
    if (!r) throw new DomainError("NOT_FOUND", "No hay consumo de bono que revertir.");
    const invoiced = await tx.invoiceItem.findFirst({
      where: { voucherId: r.voucherId, invoice: { appointmentId: r.appointmentId, status: "ISSUED" } },
    });
    if (invoiced) throw new DomainError("INVOICED", "La sesión ya figura en una factura emitida: rectifícala primero.");

    const used = r.voucher.usedSessions - 1;
    await tx.voucher.update({
      where: { id: r.voucherId },
      data: { usedSessions: used, version: { increment: 1 }, status: nextVoucherStatus(r.voucher.totalSessions, used, r.voucher.expiresAt) },
    });
    await tx.voucherRedemption.update({ where: { id: r.id }, data: { reversedAt: new Date() } });
    await tx.appointmentService.update({ where: { id: p.appointmentServiceId }, data: { priceCents: p.restorePriceCents } });
    await audit(tx, { actorId: p.actorId, action: "UPDATE", entity: "Voucher", entityId: r.voucherId, after: { reversed: r.id, usedSessions: used } });
  });
}

/** Vende un bono: crea el Voucher. La factura de venta se emite aparte con `createDraft…`. */
export async function sellVoucher(p: { productId: string; ownerId: string; dogId?: string; actorId: string }) {
  const product = await prisma.voucherProduct.findUnique({ where: { id: p.productId } });
  if (!product?.isActive) throw new DomainError("NOT_FOUND", "Tipo de bono no disponible.");
  const expiresAt = new Date(Date.now() + product.validityDays * 86_400_000);
  const voucher = await prisma.voucher.create({
    data: {
      code: `B-${randomBytes(4).toString("hex").toUpperCase()}`,
      productId: product.id,
      ownerId: p.ownerId,
      dogId: p.dogId,
      totalSessions: product.totalSessions,
      expiresAt,
    },
  });
  await audit(prisma, { actorId: p.actorId, action: "CREATE", entity: "Voucher", entityId: voucher.id, after: voucher });
  return voucher;
}
