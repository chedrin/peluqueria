import type { AppointmentStatus, GroomingStage } from "@prisma/client";

export const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-amber-50 border-amber-400 text-amber-900" },
  CONFIRMED: { label: "Confirmada", className: "bg-sky-50 border-sky-500 text-sky-900" },
  IN_PROGRESS: { label: "En curso", className: "bg-violet-50 border-violet-500 text-violet-900" },
  COMPLETED: { label: "Completada", className: "bg-emerald-50 border-emerald-500 text-emerald-900" },
  CANCELLED: { label: "Cancelada", className: "bg-zinc-100 border-zinc-300 text-zinc-500 line-through" },
  NO_SHOW: { label: "No presentado", className: "bg-rose-50 border-rose-300 text-rose-700" },
};

export const STAGE_LABEL: Record<GroomingStage, string> = {
  BATH: "Baño",
  CUT: "Corte",
  DRY: "Secado",
  FINISHING: "Acabado",
};

/** Máquina de estados de la cita: transiciones permitidas */
export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW", "IN_PROGRESS"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW", "PENDING"],
  IN_PROGRESS: ["COMPLETED", "CONFIRMED"],
  COMPLETED: [],
  CANCELLED: ["PENDING"],
  NO_SHOW: ["PENDING"],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Solo se pueden arrastrar citas que aún no han empezado */
export const DRAGGABLE: AppointmentStatus[] = ["PENDING", "CONFIRMED"];
