import type { DogSize, VoucherStatus } from "@prisma/client";

export type VoucherSnapshot = {
  id: string;
  ownerId: string;
  dogId: string | null;
  status: VoucherStatus;
  totalSessions: number;
  usedSessions: number;
  expiresAt: Date;
  productSize: DogSize | null;
  allowedServiceIds: string[];
};

export type RedemptionTarget = {
  ownerId: string;
  dogId: string;
  dogSize: DogSize;
  serviceId: string;
  /** Fecha de la cita: el bono debe estar vigente el día del servicio */
  serviceDate: Date;
};

export type RedeemCheck = { ok: true; sessionNumber: number; remainingAfter: number } | { ok: false; reason: string };

/**
 * Reglas de negocio para consumir UNA sesión de bono.
 * Pura y sin I/O: se testea de forma aislada y se reutiliza en UI (mostrar si el bono aplica).
 */
export function checkRedemption(v: VoucherSnapshot, t: RedemptionTarget): RedeemCheck {
  if (v.status !== "ACTIVE") return { ok: false, reason: `El bono no está activo (${v.status}).` };
  if (v.ownerId !== t.ownerId) return { ok: false, reason: "El bono pertenece a otro cliente." };
  if (v.dogId && v.dogId !== t.dogId) return { ok: false, reason: "El bono es nominativo para otro perro." };
  if (t.serviceDate > v.expiresAt) return { ok: false, reason: "El bono está caducado para la fecha de la cita." };
  if (v.usedSessions >= v.totalSessions) return { ok: false, reason: "El bono no tiene sesiones disponibles." };
  if (v.productSize && v.productSize !== t.dogSize)
    return { ok: false, reason: "El bono es para otro tamaño de perro." };
  if (!v.allowedServiceIds.includes(t.serviceId))
    return { ok: false, reason: "El servicio no está incluido en el bono." };
  const sessionNumber = v.usedSessions + 1;
  return { ok: true, sessionNumber, remainingAfter: v.totalSessions - sessionNumber };
}

/** Estado tras consumir/revertir sesiones. */
export function nextVoucherStatus(total: number, used: number, expiresAt: Date, now = new Date()): VoucherStatus {
  if (used >= total) return "EXHAUSTED";
  if (now > expiresAt) return "EXPIRED";
  return "ACTIVE";
}
