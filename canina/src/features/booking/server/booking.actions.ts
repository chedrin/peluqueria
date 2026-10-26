"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { DomainError, toActionResult } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { cancelByOwner, canOwnerModify, createBooking, getAvailability } from "./booking.service";
import { audit } from "@/lib/audit";
import { addMinutes, atLocalMinutes } from "@/lib/time";
import { findConflict } from "@/features/scheduling/domain/availability";
import { loadStaffDays } from "@/features/scheduling/server/availability.service";

const bookSchema = z.object({
  dogId: z.string(),
  serviceIds: z.array(z.string()).min(1),
  staffId: z.string(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.number().int(),
  notes: z.string().max(500).optional(),
  acceptCancellation: z.literal(true),
});

export async function bookOnlineAction(input: z.infer<typeof bookSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["CLIENT"]);
    const p = bookSchema.parse(input);
    const appt = await createBooking({ ...p, ownerId: s.ownerId!, source: "ONLINE", actorId: s.sub });
    revalidatePath("/mi-cuenta/citas");
    return { id: appt.id };
  });
}

export async function availabilityAction(input: { day: string; dogId: string; serviceIds: string[]; staffId?: string | null }) {
  return toActionResult(async () => {
    await requireRole(["CLIENT", "ADMIN", "RECEPTION", "GROOMER"]);
    return getAvailability(input);
  });
}

export async function cancelMyAppointmentAction(appointmentId: string) {
  return toActionResult(async () => {
    const s = await requireRole(["CLIENT"]);
    await cancelByOwner({ appointmentId, ownerId: s.ownerId!, actorId: s.sub });
    revalidatePath("/mi-cuenta/citas");
  });
}

/** Reprogramar desde el área privada: mismo peluquero si está libre, si no, cualquiera libre a esa hora. */
export async function rescheduleMyAppointmentAction(input: { appointmentId: string; day: string; startMin: number; staffId: string }) {
  return toActionResult(async () => {
    const s = await requireRole(["CLIENT"]);
    const a = await prisma.appointment.findUnique({ where: { id: input.appointmentId } });
    if (!a || a.ownerId !== s.ownerId) throw new DomainError("NOT_FOUND", "Cita no encontrada.");
    if (!["PENDING", "CONFIRMED"].includes(a.status) || !(await canOwnerModify(a.startsAt)))
      throw new DomainError("POLICY", "Fuera del plazo para reprogramar online. Llámanos, por favor.");
    const duration = (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.staffId + input.day}))`;
      const [day] = await loadStaffDays(input.day, [input.staffId], tx);
      const c = day && findConflict({ start: input.startMin, end: input.startMin + duration }, day.working, day.appointments, day.blocks, a.id);
      if (!day || c) throw new DomainError("SLOT_TAKEN", c?.message ?? "Hueco no disponible.");
      const startsAt = atLocalMinutes(input.day, input.startMin);
      await tx.appointment.update({
        where: { id: a.id },
        data: { startsAt, endsAt: addMinutes(startsAt, duration), groomerId: input.staffId, status: "PENDING", version: { increment: 1 } },
      });
      await audit(tx, { actorId: s.sub, action: "MOVE", entity: "Appointment", entityId: a.id, before: { startsAt: a.startsAt }, after: { startsAt, by: "owner" } });
    });
    revalidatePath("/mi-cuenta/citas");
  });
}
