import "server-only";
import { prisma } from "@/lib/prisma";
import { atLocalMinutes, localMinutes, localDay } from "@/lib/time";
import { loadStaffDays } from "@/features/scheduling/server/availability.service";

export type AgendaAppointment = Awaited<ReturnType<typeof getAgendaDay>>["appointments"][number];

/** Datos de la vista Día: columnas por peluquero + citas + bloqueos. */
export async function getAgendaDay(day: string, staffFilter?: string[]) {
  const start = atLocalMinutes(day, 0);
  const end = atLocalMinutes(day, 24 * 60);
  const now = new Date();

  const [staff, appts, staffDays] = await Promise.all([
    prisma.staffProfile.findMany({
      where: { user: { isActive: true }, ...(staffFilter?.length ? { id: { in: staffFilter } } : {}) },
      orderBy: { sortOrder: "asc" },
      select: { id: true, displayName: true, color: true },
    }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: start, lt: end }, ...(staffFilter?.length ? { groomerId: { in: staffFilter } } : {}) },
      include: {
        dog: {
          select: {
            id: true, name: true, size: true, temperament: true, needsMuzzle: true, breedText: true,
            breed: { select: { name: true } },
            healthAlerts: { where: { isActive: true, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } },
          },
        },
        owner: { select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
        services: { select: { id: true, service: { select: { name: true } } } },
      },
      orderBy: { startsAt: "asc" },
    }),
    loadStaffDays(day, staffFilter?.length ? staffFilter : undefined),
  ]);

  return {
    day,
    staff,
    workingByStaff: Object.fromEntries(staffDays.map((d) => [d.staffId, { working: d.working, blocks: d.blocks }])),
    appointments: appts.map((a) => ({
      id: a.id,
      version: a.version,
      groomerId: a.groomerId,
      startMin: localMinutes(a.startsAt),
      endMin: localDay(a.endsAt) > day ? 24 * 60 : localMinutes(a.endsAt),
      status: a.status,
      stage: a.stage,
      dog: {
        id: a.dog.id,
        name: a.dog.name,
        breed: a.dog.breed?.name ?? a.dog.breedText ?? "Mestizo",
        size: a.dog.size,
        temperament: a.dog.temperament,
        needsMuzzle: a.dog.needsMuzzle,
        alerts: a.dog.healthAlerts.map((h) => ({ id: h.id, type: h.type, severity: h.severity, description: h.description })),
      },
      ownerName: `${a.owner.user.firstName} ${a.owner.user.lastName}`,
      ownerPhone: a.owner.user.phone,
      services: a.services.map((s) => s.service.name),
    })),
  };
}

/** Vista Semana/Mes: recuento de citas por día y peluquero (para el resumen). */
export async function getAgendaRange(fromDay: string, toDayExclusive: string, staffFilter?: string[]) {
  const appts = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: atLocalMinutes(fromDay, 0), lt: atLocalMinutes(toDayExclusive, 0) },
      status: { notIn: ["CANCELLED"] },
      ...(staffFilter?.length ? { groomerId: { in: staffFilter } } : {}),
    },
    select: { id: true, startsAt: true, status: true, groomerId: true, dog: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
  });
  const byDay = new Map<string, typeof appts>();
  for (const a of appts) {
    const d = localDay(a.startsAt);
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  }
  return byDay;
}
