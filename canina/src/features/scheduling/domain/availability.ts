/**
 * Motor de disponibilidad (idea tomada de Cal.com / Easy!Appointments):
 *   huecos = horario laboral − bloqueos − citas existentes, troceado según la
 *   granularidad y la duración del servicio.
 * Trabaja con minutos del día local para ser determinista y fácil de testear.
 */
export type Interval = { start: number; end: number }; // minutos desde 00:00 locales

export type StaffDay = {
  staffId: string;
  working: Interval[]; // puede haber turno partido
  busy: Interval[]; // citas + bloqueos (descansos, bajas, incidencias)
};

export type Slot = { staffId: string; start: number; end: number };

export function subtract(base: Interval[], remove: Interval[]): Interval[] {
  let result = [...base].sort((a, b) => a.start - b.start);
  for (const r of remove) {
    result = result.flatMap((b) => {
      if (r.end <= b.start || r.start >= b.end) return [b];
      const out: Interval[] = [];
      if (r.start > b.start) out.push({ start: b.start, end: r.start });
      if (r.end < b.end) out.push({ start: r.end, end: b.end });
      return out;
    });
  }
  return result;
}

export function freeSlots(
  day: StaffDay,
  durationMin: number,
  opts: { granularity?: number; notBefore?: number } = {},
): Slot[] {
  const g = opts.granularity ?? 15;
  const free = subtract(day.working, day.busy);
  const slots: Slot[] = [];
  for (const f of free) {
    let t = Math.ceil(Math.max(f.start, opts.notBefore ?? 0) / g) * g;
    for (; t + durationMin <= f.end; t += g) slots.push({ staffId: day.staffId, start: t, end: t + durationMin });
  }
  return slots;
}

/**
 * Para "cualquier peluquero": une los huecos de todos y asigna al que tenga
 * menos carga ese día (balanceo), en caso de empate el primero por orden.
 */
export function freeSlotsAnyStaff(days: StaffDay[], durationMin: number, opts: { granularity?: number; notBefore?: number } = {}) {
  const load = new Map(days.map((d) => [d.staffId, d.busy.reduce((s, b) => s + (b.end - b.start), 0)]));
  const byStart = new Map<number, Slot>();
  for (const d of days)
    for (const s of freeSlots(d, durationMin, opts)) {
      const cur = byStart.get(s.start);
      if (!cur || (load.get(s.staffId) ?? 0) < (load.get(cur.staffId) ?? 0)) byStart.set(s.start, s);
    }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

export type Conflict = { kind: "OUTSIDE_HOURS" | "OVERLAP" | "BLOCKED"; message: string };

/** Comprueba si [start,end) cabe para un peluquero. Usado al mover citas en la agenda. */
export function findConflict(
  target: Interval,
  working: Interval[],
  appointments: (Interval & { id: string })[],
  blocks: Interval[],
  ignoreAppointmentId?: string,
): Conflict | null {
  const inside = working.some((w) => target.start >= w.start && target.end <= w.end);
  if (!inside) return { kind: "OUTSIDE_HOURS", message: "Fuera del horario del peluquero." };
  if (blocks.some((b) => target.start < b.end && b.start < target.end))
    return { kind: "BLOCKED", message: "La franja está bloqueada (descanso, baja o incidencia)." };
  const hit = appointments.find((a) => a.id !== ignoreAppointmentId && target.start < a.end && a.start < target.end);
  if (hit) return { kind: "OVERLAP", message: "Se solapa con otra cita." };
  return null;
}
