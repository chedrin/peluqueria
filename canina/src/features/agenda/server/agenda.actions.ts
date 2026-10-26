"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { DomainError, toActionResult } from "@/lib/errors";
import { addMinutes, atLocalMinutes, formatHM } from "@/lib/time";
import { findConflict } from "@/features/scheduling/domain/availability";
import { loadStaffDays } from "@/features/scheduling/server/availability.service";
import { notifyAppointmentChange } from "@/features/booking/server/notifications";
import { canTransition, DRAGGABLE } from "../domain/status";

const moveSchema = z.object({
  appointmentId: z.string().min(1),
  groomerId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMin: z.number().int().min(0).max(24 * 60),
  version: z.number().int(),
});

/**
 * Mueve una cita (drag-and-drop): cambio de hora y/o reasignación de peluquero.
 *  - Bloqueo consultivo por peluquero+día → dos recepcionistas no pueden
 *    soltar dos citas en el mismo hueco a la vez.
 *  - Control optimista por `version` → si la cita cambió desde que se pintó,
 *    se rechaza y la UI recarga.
 */
export async function moveAppointment(input: z.infer<typeof moveSchema>) {
  return toActionResult(async () => {
    const session = await requireRole(["ADMIN", "RECEPTION", "GROOMER"]);
    const p = moveSchema.parse(input);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${p.groomerId + p.day}))`;

      const appt = await tx.appointment.findUnique({
        where: { id: p.appointmentId },
        include: { services: { select: { serviceId: true } } },
      });
      if (!appt) throw new DomainError("NOT_FOUND", "La cita ya no existe.");
      if (appt.version !== p.version) throw new DomainError("STALE", "La cita ha cambiado. Recargando agenda…");
      if (!DRAGGABLE.includes(appt.status))
        throw new DomainError("LOCKED", "Solo se pueden mover citas pendientes o confirmadas.");
      if (session.role === "GROOMER" && appt.groomerId !== session.staffId)
        throw new DomainError("FORBIDDEN", "Solo puedes mover tus propias citas.");

      // ¿El peluquero destino sabe hacer todos los servicios?
      const skills = await tx.staffService.findMany({ where: { staffId: p.groomerId } });
      if (skills.length) {
        const can = new Set(skills.map((s) => s.serviceId));
        if (!appt.services.every((s) => can.has(s.serviceId)))
          throw new DomainError("SKILL", "El peluquero destino no realiza alguno de los servicios de la cita.");
      }

      const durationMin = Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000);
      const target = { start: p.startMin, end: p.startMin + durationMin };
      const [day] = await loadStaffDays(p.day, [p.groomerId], tx);
      if (!day) throw new DomainError("NOT_FOUND", "Peluquero no disponible.");
      const conflict = findConflict(target, day.working, day.appointments, day.blocks, appt.id);
      if (conflict) throw new DomainError(conflict.kind, conflict.message);

      const startsAt = atLocalMinutes(p.day, p.startMin);
      const updated = await tx.appointment.update({
        where: { id: appt.id, version: p.version },
        data: { startsAt, endsAt: addMinutes(startsAt, durationMin), groomerId: p.groomerId, version: { increment: 1 } },
      });
      await audit(tx, {
        actorId: session.sub,
        action: "MOVE",
        entity: "Appointment",
        entityId: appt.id,
        before: { startsAt: appt.startsAt, groomerId: appt.groomerId },
        after: { startsAt, groomerId: p.groomerId },
      });
      return { updated, timeChanged: appt.startsAt.getTime() !== startsAt.getTime() };
    });

    if (result.timeChanged)
      await notifyAppointmentChange(result.updated.id, `Tu cita se ha movido a las ${formatHM(p.startMin)} del ${p.day}.`);
    revalidatePath("/admin/agenda");
    return { id: result.updated.id, version: result.updated.version };
  });
}

const statusSchema = z.object({
  appointmentId: z.string(),
  status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  stage: z.enum(["BATH", "CUT", "DRY", "FINISHING"]).nullable().optional(),
  reason: z.string().optional(),
});

export async function changeAppointmentStatus(input: z.infer<typeof statusSchema>) {
  return toActionResult(async () => {
    const session = await requireRole(["ADMIN", "RECEPTION", "GROOMER"]);
    const p = statusSchema.parse(input);
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: p.appointmentId } });
    const to = p.status as AppointmentStatus;
    if (to !== appt.status && !canTransition(appt.status, to))
      throw new DomainError("TRANSITION", `No se puede pasar de ${appt.status} a ${to}.`);

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appt.id },
        data: {
          status: to,
          stage: to === "IN_PROGRESS" ? (p.stage ?? "BATH") : null,
          cancelledAt: to === "CANCELLED" ? new Date() : undefined,
          cancelReason: to === "CANCELLED" ? p.reason : undefined,
          version: { increment: 1 },
        },
      });
      await audit(tx, { actorId: session.sub, action: "STATUS_CHANGE", entity: "Appointment", entityId: appt.id, before: { status: appt.status, stage: appt.stage }, after: { status: to, stage: p.stage } });
    });
    revalidatePath("/admin/agenda");
  });
}

const blockSchema = z.object({
  staffId: z.string().nullable(),
  type: z.enum(["BREAK", "SICK_LEAVE", "HOLIDAY", "INCIDENT", "TRAINING"]),
  day: z.string(),
  startMin: z.number().int(),
  endMin: z.number().int(),
  untilDay: z.string().optional(),
  reason: z.string().optional(),
});

/** Bloquea una franja (descanso, baja, incidencia). Devuelve las citas afectadas para reubicarlas. */
export async function createTimeBlock(input: z.infer<typeof blockSchema>) {
  return toActionResult(async () => {
    const session = await requireRole(["ADMIN", "RECEPTION"]);
    const p = blockSchema.parse(input);
    const startsAt = atLocalMinutes(p.day, p.startMin);
    const endsAt = atLocalMinutes(p.untilDay ?? p.day, p.endMin);
    if (endsAt <= startsAt) throw new DomainError("RANGE", "El fin debe ser posterior al inicio.");

    const block = await prisma.timeBlock.create({ data: { staffId: p.staffId, type: p.type, startsAt, endsAt, reason: p.reason } });
    await audit(prisma, { actorId: session.sub, action: "CREATE", entity: "TimeBlock", entityId: block.id, after: block });

    const affected = await prisma.appointment.findMany({
      where: {
        ...(p.staffId ? { groomerId: p.staffId } : {}),
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { id: true, startsAt: true, dog: { select: { name: true } } },
    });
    revalidatePath("/admin/agenda");
    return { blockId: block.id, affected };
  });
}

export async function deleteTimeBlock(blockId: string) {
  return toActionResult(async () => {
    const session = await requireRole(["ADMIN", "RECEPTION"]);
    const block = await prisma.timeBlock.delete({ where: { id: blockId } });
    await audit(prisma, { actorId: session.sub, action: "DELETE", entity: "TimeBlock", entityId: blockId, before: block });
    revalidatePath("/admin/agenda");
  });
}
