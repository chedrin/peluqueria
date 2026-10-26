import "server-only";
import { prisma, type Db } from "@/lib/prisma";
import { atLocalMinutes, localDay, localMinutes, localWeekday } from "@/lib/time";
import type { Interval, StaffDay } from "../domain/availability";

/** Estados que ocupan hueco en la agenda */
export const BLOCKING_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

function clampToDay(day: string, start: Date, end: Date): Interval {
  const s = localDay(start) < day ? 0 : localMinutes(start);
  const e = localDay(end) > day ? 24 * 60 : localMinutes(end);
  return { start: s, end: e };
}

/** Construye la foto del día por peluquero: horario, citas y bloqueos en minutos locales. */
export async function loadStaffDays(day: string, staffIds?: string[], db: Db = prisma) {
  const dayStart = atLocalMinutes(day, 0);
  const dayEnd = atLocalMinutes(day, 24 * 60);
  const weekday = localWeekday(day);

  const staff = await db.staffProfile.findMany({
    where: { ...(staffIds ? { id: { in: staffIds } } : {}), user: { isActive: true } },
    include: {
      workingHours: { where: { weekday } },
      appointments: {
        where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart }, status: { in: [...BLOCKING_STATUSES] } },
        select: { id: true, startsAt: true, endsAt: true },
      },
      timeBlocks: { where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } } },
    },
    orderBy: { sortOrder: "asc" },
  });
  const salonBlocks = await db.timeBlock.findMany({ where: { staffId: null, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } } });

  return staff.map((s) => {
    const appts = s.appointments.map((a) => ({ id: a.id, ...clampToDay(day, a.startsAt, a.endsAt) }));
    const blocks = [...s.timeBlocks, ...salonBlocks].map((b) => clampToDay(day, b.startsAt, b.endsAt));
    const result: StaffDay & { appointments: typeof appts; blocks: Interval[]; bookableOnline: boolean } = {
      staffId: s.id,
      working: s.workingHours.map((w) => ({ start: w.startMin, end: w.endMin })),
      busy: [...appts, ...blocks],
      appointments: appts,
      blocks,
      bookableOnline: s.bookableOnline,
    };
    return result;
  });
}
