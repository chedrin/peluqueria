import "server-only";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { DomainError } from "@/lib/errors";
import { addMinutes, atLocalMinutes, formatHM, localDay, localMinutes } from "@/lib/time";
import { resolveServicePrice } from "@/features/catalog/domain/pricing";
import { findConflict, freeSlots, freeSlotsAnyStaff } from "@/features/scheduling/domain/availability";
import { loadStaffDays } from "@/features/scheduling/server/availability.service";
import { notifyAppointmentChange } from "./notifications";

async function quote(dogId: string, serviceIds: string[]) {
  const dog = await prisma.dog.findUnique({ where: { id: dogId } });
  if (!dog) throw new DomainError("NOT_FOUND", "Mascota no encontrada.");
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, isActive: true },
    include: { pricing: true },
  });
  if (services.length !== serviceIds.length) throw new DomainError("NOT_FOUND", "Algún servicio no está disponible.");
  const lines = services.map((s) => {
    const r = resolveServicePrice(
      {
        ...s,
        pricing: s.pricing.map((p) => ({ ...p, minWeightKg: p.minWeightKg?.toNumber(), maxWeightKg: p.maxWeightKg?.toNumber() })),
      },
      { size: dog.size, coatType: dog.coatType, weightKg: dog.currentWeightKg?.toNumber() },
    );
    return { serviceId: s.id, name: s.name, ...r };
  });
  return {
    dog,
    lines,
    totalCents: lines.reduce((s, l) => s + l.priceCents, 0),
    totalMin: lines.reduce((s, l) => s + l.blockMin, 0),
  };
}

/** Huecos libres en tiempo real para la reserva online. */
export async function getAvailability(p: { day: string; dogId: string; serviceIds: string[]; staffId?: string | null }) {
  const q = await quote(p.dogId, p.serviceIds);
  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  const days = (await loadStaffDays(p.day, p.staffId ? [p.staffId] : undefined)).filter((d) => d.bookableOnline);
  const now = new Date();
  const notBefore = localDay(now) === p.day ? localMinutes(now) + 60 : 0; // 1 h de margen
  const g = settings?.slotGranularityMin ?? 15;
  const slots = p.staffId
    ? days.flatMap((d) => freeSlots(d, q.totalMin, { granularity: g, notBefore }))
    : freeSlotsAnyStaff(days, q.totalMin, { granularity: g, notBefore });
  return { quote: { lines: q.lines, totalCents: q.totalCents, totalMin: q.totalMin }, slots: slots.map((s) => ({ ...s, label: formatHM(s.start) })) };
}

/** Crea la reserva re-comprobando el hueco dentro de la transacción (evita doble reserva). */
export async function createBooking(p: {
  ownerId: string;
  dogId: string;
  serviceIds: string[];
  staffId: string;
  day: string;
  startMin: number;
  notes?: string;
  source: "ONLINE" | "BACKOFFICE" | "PHONE" | "WALK_IN";
  actorId: string;
}) {
  const q = await quote(p.dogId, p.serviceIds);
  if (q.dog.ownerId !== p.ownerId) throw new DomainError("FORBIDDEN", "La mascota no pertenece a este cliente.");

  const appt = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${p.staffId + p.day}))`;
    const [day] = await loadStaffDays(p.day, [p.staffId], tx);
    const conflict = day && findConflict({ start: p.startMin, end: p.startMin + q.totalMin }, day.working, day.appointments, day.blocks);
    if (!day || conflict) throw new DomainError("SLOT_TAKEN", conflict?.message ?? "Hueco no disponible.");

    const startsAt = atLocalMinutes(p.day, p.startMin);
    const created = await tx.appointment.create({
      data: {
        dogId: p.dogId,
        ownerId: p.ownerId,
        groomerId: p.staffId,
        startsAt,
        endsAt: addMinutes(startsAt, q.totalMin),
        status: p.source === "ONLINE" ? "PENDING" : "CONFIRMED",
        source: p.source,
        clientNotes: p.notes,
        estimatedCents: q.totalCents,
        createdById: p.actorId,
        services: { create: q.lines.map((l) => ({ serviceId: l.serviceId, priceCents: l.priceCents, durationMin: l.durationMin })) },
      },
    });
    await audit(tx, { actorId: p.actorId, action: "CREATE", entity: "Appointment", entityId: created.id, after: created });
    return created;
  });

  await notifyAppointmentChange(
    appt.id,
    `¡Reserva recibida! ${q.dog.name} tiene cita el ${p.day} a las ${formatHM(p.startMin)}. Te confirmaremos en breve.`,
    "booking_received",
  );
  return appt;
}

/** Política de cancelación/reprogramación desde el área privada. */
export async function cancelByOwner(p: { appointmentId: string; ownerId: string; actorId: string; reason?: string }) {
  const a = await prisma.appointment.findUnique({ where: { id: p.appointmentId } });
  if (!a || a.ownerId !== p.ownerId) throw new DomainError("NOT_FOUND", "Cita no encontrada.");
  if (!["PENDING", "CONFIRMED"].includes(a.status)) throw new DomainError("INVALID_STATE", "Esta cita ya no se puede cancelar.");
  const s = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  const windowH = s?.cancellationWindowHours ?? 24;
  if (a.startsAt.getTime() - Date.now() < windowH * 3_600_000)
    throw new DomainError("POLICY", `Solo se puede cancelar online con ${windowH} h de antelación. Llámanos, por favor.`);
  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({
      where: { id: a.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: p.reason ?? "Cancelada por el cliente", version: { increment: 1 } },
    });
    await audit(tx, { actorId: p.actorId, action: "STATUS_CHANGE", entity: "Appointment", entityId: a.id, after: { status: "CANCELLED", by: "owner" } });
  });
}

export async function canOwnerModify(startsAt: Date) {
  const s = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  return startsAt.getTime() - Date.now() >= (s?.cancellationWindowHours ?? 24) * 3_600_000;
}
