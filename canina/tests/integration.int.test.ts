/**
 * Tests de integración contra PostgreSQL real (con el seed cargado).
 *   INTEGRATION=1 npm test
 */
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createDraftFromAppointment, createRectifyingDraft, issueInvoice, registerPayment } from "@/features/billing/server/invoice.service";
import { redeemVoucherSession, reverseVoucherSession } from "@/features/vouchers/server/voucher.service";
import { loadStaffDays } from "@/features/scheduling/server/availability.service";
import { findConflict } from "@/features/scheduling/domain/availability";
import { localDay } from "@/lib/time";
import { renderInvoicePdf } from "@/features/billing/pdf/invoice-pdf";

const run = process.env.INTEGRATION === "1";

describe.skipIf(!run)("integración con PostgreSQL", () => {
  afterAll(() => prisma.$disconnect());

  async function tobyAppointment() {
    const a = await prisma.appointment.findFirstOrThrow({
      where: { dog: { name: "Toby" }, status: "IN_PROGRESS" },
      include: { services: { include: { service: true } } },
    });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@cania.test" } });
    return { a, actorId: admin.id };
  }

  it("consume una sesión de bono y rechaza el doble consumo", async () => {
    const { a, actorId } = await tobyAppointment();
    const line = a.services.find((s) => s.service.slug === "bano-basico")!;
    const v = await prisma.voucher.findUniqueOrThrow({ where: { code: "B-DEMO0001" } });

    const r = await redeemVoucherSession({ voucherId: v.id, appointmentServiceId: line.id, actorId });
    expect(r.redemption.sessionNumber).toBe(v.usedSessions + 1);
    expect((await prisma.appointmentService.findUniqueOrThrow({ where: { id: line.id } })).priceCents).toBe(0);
    await expect(redeemVoucherSession({ voucherId: v.id, appointmentServiceId: line.id, actorId })).rejects.toThrow(/ya se pagó/);

    // Revertir y volver a consumir (deja traza de la reversión)
    await reverseVoucherSession({ appointmentServiceId: line.id, actorId, restorePriceCents: 3200 });
    expect((await prisma.voucher.findUniqueOrThrow({ where: { id: v.id } })).usedSessions).toBe(v.usedSessions);
    await redeemVoucherSession({ voucherId: v.id, appointmentServiceId: line.id, actorId });
    expect(await prisma.voucherRedemption.count({ where: { appointmentServiceId: line.id } })).toBe(2);
  });

  it("emite ticket con número correlativo, hash encadenado y es inalterable", async () => {
    const { a, actorId } = await tobyAppointment();
    const draft = await createDraftFromAppointment(a.id, { type: "SIMPLIFIED", actorId });
    expect(draft.fullNumber).toBeNull();
    const issued = await issueInvoice(draft.id, actorId);
    expect(issued.fullNumber).toMatch(/^T\d{4}-\d{6}$/);
    expect(issued.totalCents).toBe(800); // baño pagado con bono (0 €) + uñas 8 €
    expect(issued.hash).toMatch(/^[0-9A-F]{64}$/);
    await expect(issueInvoice(draft.id, actorId)).rejects.toThrow(/ya fue emitida/);

    // El trigger de BD impide modificar o borrar la factura emitida
    await expect(prisma.invoice.update({ where: { id: issued.id }, data: { totalCents: 1 } })).rejects.toThrow(/inalterable/);
    await expect(prisma.invoice.delete({ where: { id: issued.id } })).rejects.toThrow();
    await expect(prisma.invoiceItem.deleteMany({ where: { invoiceId: issued.id } })).rejects.toThrow(/inalterables/);

    await registerPayment(issued.id, { method: "CARD", amountCents: 800, actorId });
    await expect(registerPayment(issued.id, { method: "CASH", amountCents: 1, actorId })).rejects.toThrow(/supera/);

    // PDF (pdf-lib: mismo código en Node y en Cloudflare Workers)
    const full = await prisma.invoice.findUniqueOrThrow({ where: { id: issued.id }, include: { items: true, payments: true } });
    const pdf = await renderInvoicePdf({ invoice: full, items: full.items, payments: full.payments });
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");

    // Segunda factura → número siguiente y huella encadenada
    const d2 = await createDraftFromAppointment(a.id, { type: "SIMPLIFIED", actorId });
    const i2 = await issueInvoice(d2.id, actorId);
    expect(i2.number).toBe(issued.number! + 1);
    expect(i2.previousHash).toBe(issued.hash);

    // Rectificativa total → serie R y la original queda anulada
    const rect = await createRectifyingDraft(i2.id, { reason: "Duplicada por error", actorId });
    const rIssued = await issueInvoice(rect.id, actorId);
    expect(rIssued.fullNumber).toMatch(/^R/);
    expect(rIssued.totalCents).toBe(-i2.totalCents);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: i2.id } })).status).toBe("VOIDED");
  });

  it("factura completa sin NIF válido no se emite", async () => {
    const { a, actorId } = await tobyAppointment();
    await prisma.ownerProfile.update({ where: { id: a.ownerId }, data: { taxId: "00000000A" } });
    const d = await createDraftFromAppointment(a.id, { type: "STANDARD", actorId });
    await expect(issueInvoice(d.id, actorId)).rejects.toThrow(/requisitos legales/);
    await prisma.ownerProfile.update({ where: { id: a.ownerId }, data: { taxId: "12345678Z" } });
    await prisma.invoice.delete({ where: { id: d.id } }); // borrador: sí se puede borrar
  });

  it("la agenda detecta solapes y bloqueos reales", async () => {
    const laura = await prisma.staffProfile.findFirstOrThrow({ where: { displayName: "Laura" } });
    const [day] = await loadStaffDays(localDay(new Date()), [laura.id]);
    expect(day.blocks.length).toBeGreaterThan(0); // descanso 13:00-13:30
    expect(findConflict({ start: 13 * 60, end: 13 * 60 + 30 }, day.working, day.appointments, day.blocks)?.kind).toBe("BLOCKED");
    expect(findConflict({ start: 9 * 60 + 45, end: 10 * 60 + 15 }, day.working, day.appointments, day.blocks)?.kind).toBe("OVERLAP");
  });

  it("el advisory lock de Postgres funciona dentro de la transacción", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"test-lock"}))`;
    });
  });
});
