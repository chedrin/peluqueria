import "server-only";
import type { InvoiceType, PaymentMethod, Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { calculateInvoice, type CalculatedLine, type InvoiceLineInput } from "../domain/calculator";
import { validateInvoice } from "../domain/validation";
import { buildAeatQrUrl, computeInvoiceHash, formatInvoiceNumber } from "../domain/verifactu";
import { earnLoyaltyForInvoice } from "@/features/loyalty/server/loyalty.service";

const SERIES_CODE: Record<InvoiceType, string> = { STANDARD: "F", SIMPLIFIED: "T", RECTIFYING: "R" };

async function getSettings(db: Tx | typeof prisma) {
  const s = await db.businessSettings.findUnique({ where: { id: "default" } });
  if (!s) throw new DomainError("NO_SETTINGS", "Configura primero los datos fiscales de la empresa.");
  return s;
}

function itemsToLines(
  items: { description: string; quantity: Prisma.Decimal | number; unitPriceCents: number; discountBp: number; taxRate: InvoiceLineInput["taxRate"]; exemptionCause: string | null; serviceId: string | null; productId: string | null; voucherId: string | null }[],
): InvoiceLineInput[] {
  return items.map((i) => ({
    description: i.description,
    quantity: Number(i.quantity),
    unitPriceCents: i.unitPriceCents,
    discountBp: i.discountBp,
    taxRate: i.taxRate,
    exemptionCause: i.exemptionCause ?? undefined,
    serviceId: i.serviceId ?? undefined,
    productId: i.productId ?? undefined,
    voucherId: i.voucherId ?? undefined,
  }));
}

/**
 * Crea un BORRADOR de factura a partir de una cita completada.
 * Los servicios pagados con bono se incluyen a 0 € (el IVA se devengó al vender el bono,
 * art. 75 LIVA) para dejar trazabilidad del consumo en el documento.
 */
export async function createDraftFromAppointment(
  appointmentId: string,
  opts: { type: InvoiceType; actorId: string; extraLines?: InvoiceLineInput[]; withholdingBp?: number },
) {
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      dog: true,
      owner: { include: { user: true } },
      services: {
        include: { service: true, redemptions: { where: { reversedAt: null }, include: { voucher: true } } },
      },
    },
  });
  if (!appt) throw new DomainError("NOT_FOUND", "Cita no encontrada.");
  if (appt.status !== "COMPLETED" && appt.status !== "IN_PROGRESS")
    throw new DomainError("INVALID_STATE", "Solo se facturan citas en curso o completadas.");

  const lines: InvoiceLineInput[] = appt.services.map((s) => {
    const r = s.redemptions[0] ?? null;
    return {
      description: r
        ? `${s.service.name} · ${appt.dog.name} (Bono ${r.voucher.code}, sesión ${r.sessionNumber}/${r.voucher.totalSessions})`
        : `${s.service.name} · ${appt.dog.name}`,
      quantity: 1,
      unitPriceCents: r ? 0 : s.priceCents,
      taxRate: s.service.taxRate,
      serviceId: s.serviceId,
      voucherId: r?.voucherId,
    };
  });
  lines.push(...(opts.extraLines ?? []));

  return createDraftInvoice({
    type: opts.type,
    ownerId: appt.ownerId,
    appointmentId: appt.id,
    lines,
    withholdingBp: opts.withholdingBp,
    actorId: opts.actorId,
  });
}

/** Borrador genérico (venta de bono, productos, servicios sueltos en mostrador…). */
export async function createDraftInvoice(p: {
  type: InvoiceType;
  ownerId?: string | null;
  appointmentId?: string | null;
  lines: InvoiceLineInput[];
  withholdingBp?: number;
  pricesIncludeTax?: boolean;
  actorId: string;
}) {
  const settings = await getSettings(prisma);
  const inclusive = p.pricesIncludeTax ?? true;
  const calc = calculateInvoice(p.lines, { pricesIncludeTax: inclusive, withholdingBp: p.withholdingBp });
  const o = p.ownerId ? await prisma.ownerProfile.findUnique({ where: { id: p.ownerId }, include: { user: true } }) : null;

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        type: p.type,
        status: "DRAFT",
        issuerName: settings.legalName,
        issuerTaxId: settings.taxId,
        issuerAddress: `${settings.address}, ${settings.postalCode} ${settings.city} (${settings.province})`,
        ownerId: o?.id,
        customerName: o ? `${o.user.firstName} ${o.user.lastName}` : null,
        customerTaxId: o?.taxId,
        customerAddress: o?.address ? `${o.address}, ${o.postalCode ?? ""} ${o.city ?? ""}`.trim() : null,
        appointmentId: p.appointmentId,
        pricesIncludeTax: inclusive,
        withholdingRate: calc.withholdingBp,
        createdById: p.actorId,
        items: { create: calc.lines.map(toItemData) },
        subtotalCents: calc.subtotalCents,
        discountCents: calc.discountCents,
        taxCents: calc.taxCents,
        withholdingCents: calc.withholdingCents,
        totalCents: calc.totalCents,
        taxBreakdown: calc.breakdown,
      },
    });
    await audit(tx, { actorId: p.actorId, action: "CREATE", entity: "Invoice", entityId: invoice.id, after: { draft: true, appointmentId: p.appointmentId } });
    return invoice;
  });
}

function toItemData(l: CalculatedLine) {
  return {
    position: l.position,
    description: l.description,
    serviceId: l.serviceId,
    productId: l.productId,
    voucherId: l.voucherId,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    netUnitPriceCents: l.netUnitPriceCents,
    discountBp: l.discountBp ?? 0,
    taxRate: l.taxRate,
    taxRateBp: l.taxRateBp,
    exemptionCause: l.exemptionCause,
    baseCents: l.baseCents,
    taxCents: l.taxCents,
    totalCents: l.totalCents,
  };
}

/** Cambia el tipo de un borrador (ticket ↔ factura completa) o refresca los datos del cliente. */
export async function updateDraft(invoiceId: string, p: { type?: InvoiceType; withholdingBp?: number; actorId: string }) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { items: true, owner: { include: { user: true } } } });
  if (!inv || inv.status !== "DRAFT") throw new DomainError("INVALID_STATE", "Solo se pueden modificar borradores.");
  const o = inv.owner;
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      type: p.type ?? inv.type,
      withholdingRate: p.withholdingBp ?? inv.withholdingRate,
      customerName: o ? `${o.user.firstName} ${o.user.lastName}` : inv.customerName,
      customerTaxId: o?.taxId ?? inv.customerTaxId,
      customerAddress: o?.address ? `${o.address}, ${o.postalCode ?? ""} ${o.city ?? ""}`.trim() : inv.customerAddress,
    },
  });
}

/**
 * EMITE una factura: valida, asigna número correlativo sin huecos y la encadena.
 *
 * Garantías:
 *  1. Numeración sin huecos → el número se asigna en la MISMA transacción que
 *     cambia el estado; si algo falla, el contador hace rollback.
 *  2. Sin duplicados en concurrencia → `SELECT … FOR UPDATE` sobre la fila de la
 *     serie y sobre BusinessSettings (mutex de la cadena de huellas).
 *  3. Inmutabilidad → solo se pasa de DRAFT a ISSUED una vez; las correcciones
 *     posteriores van por factura rectificativa.
 */
export async function issueInvoice(invoiceId: string, actorId: string) {
  return prisma.$transaction(
    async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { items: { orderBy: { position: "asc" } } } });
      if (!inv) throw new DomainError("NOT_FOUND", "Factura no encontrada.");
      if (inv.status !== "DRAFT") throw new DomainError("ALREADY_ISSUED", "La factura ya fue emitida y no puede modificarse.");

      // Mutex de cadena (serializa emisiones en todas las series)
      await tx.$queryRaw`SELECT id FROM "BusinessSettings" WHERE id = 'default' FOR UPDATE`;
      const settings = await getSettings(tx);

      const calc = calculateInvoice(itemsToLines(inv.items), {
        pricesIncludeTax: inv.pricesIncludeTax,
        withholdingBp: inv.withholdingRate,
      });
      const issues = validateInvoice({
        type: inv.type,
        calc,
        issuer: { name: inv.issuerName, taxId: inv.issuerTaxId, address: inv.issuerAddress },
        customer: { name: inv.customerName, taxId: inv.customerTaxId, address: inv.customerAddress },
        rectifies: inv.rectifiesId ? { id: inv.rectifiesId, reason: inv.rectifyReason ?? "" } : null,
        simplifiedLimitCents: settings.simplifiedInvoiceLimit,
      });
      if (issues.length) throw new DomainError("FISCAL_VALIDATION", "La factura no cumple los requisitos legales.", issues);

      const now = new Date();
      const year = now.getUTCFullYear();
      const code = SERIES_CODE[inv.type];
      const series = await tx.invoiceSeries.upsert({
        where: { code_year: { code, year } },
        create: { code, year, type: inv.type },
        update: {},
      });
      await tx.$queryRaw`SELECT id FROM "InvoiceSeries" WHERE id = ${series.id} FOR UPDATE`;
      const { lastNumber } = await tx.invoiceSeries.update({
        where: { id: series.id },
        data: { lastNumber: { increment: 1 } },
        select: { lastNumber: true },
      });
      const fullNumber = formatInvoiceNumber(code, year, lastNumber);

      const prev = await tx.invoice.findFirst({
        where: { status: { in: ["ISSUED", "VOIDED"] }, hash: { not: null } },
        orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
        select: { hash: true },
      });
      const aeatType = inv.type === "STANDARD" ? "F1" : inv.type === "SIMPLIFIED" ? "F2" : inv.customerTaxId ? "R1" : "R5";
      const chain = {
        issuerTaxId: inv.issuerTaxId,
        fullNumber,
        issueDate: now,
        aeatType,
        taxCents: calc.taxCents,
        totalCents: calc.totalCents,
        previousHash: prev?.hash ?? null,
        generatedAt: now,
      } as const;

      // Recalcular líneas con los valores definitivos
      for (const l of calc.lines) {
        const item = inv.items[l.position - 1];
        await tx.invoiceItem.update({
          where: { id: item.id },
          data: { netUnitPriceCents: l.netUnitPriceCents, taxRateBp: l.taxRateBp, baseCents: l.baseCents, taxCents: l.taxCents, totalCents: l.totalCents },
        });
      }

      const issued = await tx.invoice.update({
        where: { id: inv.id, status: "DRAFT" },
        data: {
          status: "ISSUED",
          seriesId: series.id,
          number: lastNumber,
          fullNumber,
          issueDate: now,
          subtotalCents: calc.subtotalCents,
          discountCents: calc.discountCents,
          taxCents: calc.taxCents,
          withholdingCents: calc.withholdingCents,
          totalCents: calc.totalCents,
          taxBreakdown: calc.breakdown,
          previousHash: chain.previousHash,
          hash: computeInvoiceHash(chain),
          qrPayload: buildAeatQrUrl(chain),
        },
      });

      if (inv.type === "RECTIFYING" && inv.rectifiesId) {
        const original = await tx.invoice.findUniqueOrThrow({ where: { id: inv.rectifiesId } });
        // Rectificación total → la original queda ANULADA (pero nunca se borra)
        if (original.totalCents + calc.totalCents === 0)
          await tx.invoice.update({ where: { id: original.id }, data: { status: "VOIDED" } });
      }

      await audit(tx, { actorId, action: "ISSUE", entity: "Invoice", entityId: inv.id, after: { fullNumber, totalCents: calc.totalCents, hash: issued.hash } });
      return issued;
    },
    { isolationLevel: "ReadCommitted", timeout: 15_000 },
  );
}

/**
 * Factura rectificativa por diferencias (art. 15 RD 1619/2012).
 * Sin `lines` → rectificación total (importe negativo de todas las líneas).
 */
export async function createRectifyingDraft(
  originalId: string,
  opts: { reason: string; actorId: string; lines?: InvoiceLineInput[] },
) {
  const original = await prisma.invoice.findUnique({ where: { id: originalId }, include: { items: true } });
  if (!original || original.status !== "ISSUED")
    throw new DomainError("INVALID_STATE", "Solo se pueden rectificar facturas emitidas y vigentes.");

  const lines =
    opts.lines ?? itemsToLines(original.items).map((l) => ({ ...l, quantity: -l.quantity, description: `Rectifica: ${l.description}` }));
  const calc = calculateInvoice(lines, { pricesIncludeTax: original.pricesIncludeTax, withholdingBp: original.withholdingRate });

  return prisma.invoice.create({
    data: {
      type: "RECTIFYING",
      status: "DRAFT",
      issuerName: original.issuerName,
      issuerTaxId: original.issuerTaxId,
      issuerAddress: original.issuerAddress,
      ownerId: original.ownerId,
      customerName: original.customerName,
      customerTaxId: original.customerTaxId,
      customerAddress: original.customerAddress,
      appointmentId: original.appointmentId,
      rectifiesId: original.id,
      rectifyReason: `${opts.reason} (rectifica ${original.fullNumber})`,
      pricesIncludeTax: original.pricesIncludeTax,
      withholdingRate: original.withholdingRate,
      createdById: opts.actorId,
      subtotalCents: calc.subtotalCents,
      taxCents: calc.taxCents,
      withholdingCents: calc.withholdingCents,
      totalCents: calc.totalCents,
      taxBreakdown: calc.breakdown,
      items: { create: calc.lines.map(toItemData) },
    },
  });
}

/** Registra un cobro (append-only). Al quedar pagada, acumula puntos de fidelidad. */
export async function registerPayment(
  invoiceId: string,
  p: { method: PaymentMethod; amountCents: number; reference?: string; actorId: string },
) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
    if (!inv || inv.status === "DRAFT") throw new DomainError("INVALID_STATE", "Emite la factura antes de cobrarla.");
    const paid = inv.payments.reduce((s, x) => s + x.amountCents, 0);
    const pending = inv.totalCents - paid;
    if (Math.abs(p.amountCents) > Math.abs(pending))
      throw new DomainError("OVERPAYMENT", `El importe supera lo pendiente (${(pending / 100).toFixed(2)} €).`);

    const payment = await tx.payment.create({
      data: { invoiceId, method: p.method, amountCents: p.amountCents, reference: p.reference, receivedById: p.actorId },
    });
    await audit(tx, { actorId: p.actorId, action: "PAYMENT", entity: "Invoice", entityId: invoiceId, after: payment });

    if (paid + p.amountCents === inv.totalCents && inv.ownerId && inv.totalCents > 0)
      await earnLoyaltyForInvoice(tx, { ownerId: inv.ownerId, invoiceId, amountCents: inv.totalCents, hasVisit: !!inv.appointmentId });
    return payment;
  });
}
