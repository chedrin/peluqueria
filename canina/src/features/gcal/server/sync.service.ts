import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { localDay, localMinutes } from "@/lib/time";
import { resolveServicePrice } from "@/features/catalog/domain/pricing";
import { findConflict } from "@/features/scheduling/domain/availability";
import { loadStaffDays } from "@/features/scheduling/server/availability.service";
import {
  ORIGIN_CANIA,
  ORIGIN_CANIA_BLOCK,
  appointmentSummary,
  blockSummary,
  mapSize,
  matchServices,
  normalizePhone,
  parseAgentEvent,
  samePhone,
  strip,
  type AgentBooking,
} from "../domain/mapping";
import { deleteEvent, googleConfig, GoogleApiError, insertEvent, listEvents, patchEvent, type GoogleEvent } from "./google-client";

const TZ = "Europe/Madrid";
const PAST_DAYS = 2;
const FUTURE_DAYS = 120;
/** Citas que se pueden mover o cancelar desde Google */
const EDITABLE = ["PENDING", "CONFIRMED"] as const;

export type SyncStats = {
  imported: number; // citas nuevas del agente
  updatedFromGoogle: number; // movidas en Google
  cancelledFromGoogle: number;
  pushed: number; // citas creadas o cambiadas en CANIA enviadas a Google
  removedFromGoogle: number; // citas canceladas en CANIA quitadas de Google
  blocksPushed: number;
  skipped: number; // eventos ajenos (puestos a mano en el calendario)
  warnings: string[];
};

const emptyStats = (): SyncStats => ({
  imported: 0, updatedFromGoogle: 0, cancelledFromGoogle: 0, pushed: 0, removedFromGoogle: 0, blocksPushed: 0, skipped: 0, warnings: [],
});

let running: Promise<SyncStats> | null = null;

/** Sincroniza en los dos sentidos. Si ya hay una pasada en curso, espera a esa. */
export function syncGoogleCalendar(): Promise<SyncStats> {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

async function state() {
  return prisma.googleCalendarSync.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
}

export async function getSyncState() {
  const [cfg, s] = await Promise.all([googleConfig(), prisma.googleCalendarSync.findUnique({ where: { id: "default" } })]);
  return { ...cfg, state: s, stats: (s?.lastStats ?? null) as SyncStats | null };
}

async function runSync(): Promise<SyncStats> {
  const cfg = await googleConfig();
  if (!cfg.configured) throw new Error(cfg.error ?? "Google Calendar no está configurado.");
  const st = await state();
  const stats = emptyStats();
  const startedAt = new Date();
  try {
    const from = new Date(Date.now() - PAST_DAYS * 86_400_000);
    const to = new Date(Date.now() + FUTURE_DAYS * 86_400_000);
    const events = await listEvents(from, to);
    await pull(events, stats);
    await push(from, st.enabledAt, stats);
    await pushBlocks(st.enabledAt, stats);
    await prisma.googleCalendarSync.update({
      where: { id: "default" },
      data: { lastRunAt: startedAt, lastOkAt: new Date(), lastError: null, lastStats: stats as unknown as Prisma.InputJsonValue },
    });
    return stats;
  } catch (e) {
    console.error("[google-calendar]", e);
    await prisma.googleCalendarSync.update({
      where: { id: "default" },
      data: { lastRunAt: startedAt, lastError: String((e as Error).message ?? e).slice(0, 500), lastStats: stats as unknown as Prisma.InputJsonValue },
    });
    throw e;
  }
}

// ---------------------------------------------------------------------------
//  Google → CANIA
// ---------------------------------------------------------------------------

function timed(e: GoogleEvent) {
  const s = e.start?.dateTime;
  const en = e.end?.dateTime;
  return s && en ? { startsAt: new Date(s), endsAt: new Date(en) } : null;
}

async function pull(events: GoogleEvent[], stats: SyncStats) {
  const ids = events.map((e) => e.id);
  const linked = new Map(
    (await prisma.appointment.findMany({ where: { googleEventId: { in: ids } } })).map((a) => [a.googleEventId!, a]),
  );
  const ownBlocks = new Set(
    (await prisma.timeBlock.findMany({ where: { googleEventId: { in: ids } }, select: { googleEventId: true } })).map((b) => b.googleEventId!),
  );

  for (const e of events) {
    const p = e.extendedProperties?.private ?? {};
    if (ownBlocks.has(e.id) || p.origen === ORIGIN_CANIA_BLOCK) continue;
    const a = linked.get(e.id);

    if (a) {
      if (e.updated && e.updated === a.googleUpdated) continue; // sin cambios en Google
      // Si la cita también cambió en CANIA y aún no se ha enviado, manda CANIA
      if (a.googleSyncedVersion !== a.version) continue;
      const t = timed(e);
      const editable = (EDITABLE as readonly string[]).includes(a.status);
      if (e.status === "cancelled") {
        if (editable) {
          await prisma.$transaction(async (tx) => {
            await tx.appointment.update({
              where: { id: a.id },
              data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
                cancelReason: a.source === "WHATSAPP" ? "Cancelada por el cliente en WhatsApp" : "Borrada en Google Calendar",
                version: { increment: 1 },
                googleSyncedVersion: a.version + 1,
                googleUpdated: e.updated,
              },
            });
            await audit(tx, { action: "STATUS_CHANGE", entity: "Appointment", entityId: a.id, before: { status: a.status }, after: { status: "CANCELLED", by: "google-calendar" } });
          });
          stats.cancelledFromGoogle++;
        } else {
          await prisma.appointment.update({ where: { id: a.id }, data: { googleUpdated: e.updated } });
        }
        continue;
      }
      if (editable && t && (t.startsAt.getTime() !== a.startsAt.getTime() || t.endsAt.getTime() !== a.endsAt.getTime())) {
        await prisma.$transaction(async (tx) => {
          await tx.appointment.update({
            where: { id: a.id },
            data: { ...t, version: { increment: 1 }, googleSyncedVersion: a.version + 1, googleUpdated: e.updated },
          });
          await audit(tx, { action: "MOVE", entity: "Appointment", entityId: a.id, before: { startsAt: a.startsAt }, after: { startsAt: t.startsAt, by: "google-calendar" } });
        });
        stats.updatedFromGoogle++;
      } else {
        await prisma.appointment.update({ where: { id: a.id }, data: { googleUpdated: e.updated } });
      }
      continue;
    }

    if (e.status === "cancelled") continue;
    if (p.origen === ORIGIN_CANIA) continue; // nuestro, pero ya no enlazado (cita borrada)
    const booking = parseAgentEvent(e);
    const t = timed(e);
    if (!booking || !t) {
      stats.skipped++;
      continue;
    }
    try {
      await importAgentBooking(e, booking, t, stats);
      stats.imported++;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") continue; // otra pasada la importó a la vez
      stats.warnings.push(`No se pudo importar "${e.summary}": ${(err as Error).message}`);
    }
  }
}

async function findOrCreateOwner(b: AgentBooking) {
  const candidates = await prisma.ownerProfile.findMany({
    where: { OR: [{ whatsapp: { not: null } }, { user: { phone: { not: null } } }], user: { deletedAt: null } },
    select: { id: true, whatsapp: true, user: { select: { phone: true } } },
  });
  const found = candidates.find((o) => samePhone(o.whatsapp, b.phone) || samePhone(o.user.phone, b.phone));
  if (found) return { id: found.id, created: false };

  const [firstName, ...rest] = (b.clientName ?? "Cliente WhatsApp").split(/\s+/);
  const user = await prisma.user.create({
    data: {
      email: `whatsapp-${b.phone}@sin-email.cania`,
      role: "CLIENT",
      firstName,
      lastName: rest.join(" "),
      phone: `+${b.phone}`,
      ownerProfile: {
        create: {
          whatsapp: `+${b.phone}`,
          preferredChannel: "WHATSAPP",
          personalNotes: "Cliente creado automáticamente desde el agente de WhatsApp.",
        },
      },
    },
    include: { ownerProfile: true },
  });
  return { id: user.ownerProfile!.id, created: true };
}

async function findOrCreateDog(ownerId: string, b: AgentBooking) {
  const dogs = await prisma.dog.findMany({ where: { ownerId, isActive: true } });
  const found = dogs.find((d) => strip(d.name) === strip(b.dogName));
  if (found) return found;
  const breed = b.breed ? (await prisma.breed.findMany()).find((x) => strip(x.name) === strip(b.breed!)) : undefined;
  return prisma.dog.create({
    data: {
      ownerId,
      name: b.dogName,
      size: breed?.defaultSize ?? mapSize(b.sizeText),
      coatType: breed?.defaultCoatType ?? "SHORT",
      breedId: breed?.id,
      breedText: breed ? null : b.breed,
      handlingNotes: "Ficha creada desde WhatsApp: revisa tamaño, tipo de pelo y temperamento.",
    },
  });
}

async function importAgentBooking(e: GoogleEvent, b: AgentBooking, t: { startsAt: Date; endsAt: Date }, stats: SyncStats) {
  const owner = await findOrCreateOwner(b);
  const dog = await findOrCreateDog(owner.id, b);
  const services = matchServices(
    b.serviceText,
    await prisma.service.findMany({ where: { isActive: true }, include: { pricing: true } }),
  );
  if (b.serviceText && !services.length) stats.warnings.push(`Servicio "${b.serviceText}" sin equivalente en CANIA (cita de ${b.dogName}).`);

  const totalMin = Math.round((t.endsAt.getTime() - t.startsAt.getTime()) / 60_000);
  const lines = services.map((s) => {
    const r = resolveServicePrice(
      { ...s, pricing: s.pricing.map((x) => ({ ...x, minWeightKg: x.minWeightKg?.toNumber(), maxWeightKg: x.maxWeightKg?.toNumber() })) },
      { size: dog.size, coatType: dog.coatType, weightKg: dog.currentWeightKg?.toNumber() },
    );
    return { serviceId: s.id, priceCents: r.priceCents, durationMin: r.durationMin };
  });

  // Peluquero libre a esa hora que sepa hacer los servicios; si no hay, queda "sin asignar"
  const day = localDay(t.startsAt);
  const interval = { start: localMinutes(t.startsAt), end: localDay(t.endsAt) > day ? 24 * 60 : localMinutes(t.endsAt) };
  const staffDays = await loadStaffDays(day);
  const skills = await prisma.staffService.findMany({ where: { serviceId: { in: lines.map((l) => l.serviceId) } } });
  const groomer = staffDays.find((d) => {
    const own = new Set(skills.filter((s) => s.staffId === d.staffId).map((s) => s.serviceId));
    const knows = !skills.length || lines.every((l) => own.has(l.serviceId));
    return knows && !findConflict(interval, d.working, d.appointments, d.blocks);
  });

  const internal = [
    `Reservada por el agente de WhatsApp${b.serviceText ? `: ${b.serviceText}` : ""}${b.sizeText ? ` (${b.sizeText})` : ""}.`,
    owner.created ? "Cliente nuevo creado automáticamente." : null,
  ].filter(Boolean).join(" ");

  await prisma.$transaction(async (tx) => {
    const created = await tx.appointment.create({
      data: {
        dogId: dog.id,
        ownerId: owner.id,
        groomerId: groomer?.staffId ?? null,
        startsAt: t.startsAt,
        endsAt: t.endsAt,
        status: "CONFIRMED",
        source: "WHATSAPP",
        clientNotes: b.notes,
        internalNotes: internal,
        estimatedCents: lines.reduce((s, l) => s + l.priceCents, 0),
        googleEventId: e.id,
        googleUpdated: e.updated,
        googleSyncedVersion: 0,
        services: { create: lines.map((l) => ({ ...l, durationMin: l.durationMin || totalMin })) },
      },
    });
    await audit(tx, { action: "CREATE", entity: "Appointment", entityId: created.id, after: { ...created, by: "agente-whatsapp" } });
  });
}

// ---------------------------------------------------------------------------
//  CANIA → Google
// ---------------------------------------------------------------------------

function eventTimes(startsAt: Date, endsAt: Date) {
  return { start: { dateTime: startsAt.toISOString(), timeZone: TZ }, end: { dateTime: endsAt.toISOString(), timeZone: TZ } };
}

async function push(from: Date, enabledAt: Date, stats: SyncStats) {
  const candidates = await prisma.appointment.findMany({
    where: {
      endsAt: { gte: from },
      // Las citas antiguas (o de demostración) no se envían: solo las creadas desde
      // que se activó la sincronización o las que ya están enlazadas con Google.
      OR: [{ googleEventId: { not: null } }, { createdAt: { gte: enabledAt } }],
    },
    include: {
      dog: { select: { name: true, size: true } },
      owner: { select: { whatsapp: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
      services: { select: { service: { select: { name: true } } } },
    },
  });

  for (const a of candidates) {
    if (a.googleSyncedVersion === a.version) continue;
    try {
      if (a.status === "CANCELLED") {
        if (a.googleEventId) {
          await deleteEvent(a.googleEventId);
          stats.removedFromGoogle++;
        }
        await prisma.appointment.update({ where: { id: a.id, version: a.version }, data: { googleSyncedVersion: a.version } }).catch(() => {});
        continue;
      }
      let ev: GoogleEvent;
      if (a.googleEventId && a.source === "WHATSAPP") {
        // Evento del agente: solo se cambia la hora para no tocar sus datos
        ev = await patchOrRecreate(a.googleEventId, eventTimes(a.startsAt, a.endsAt), () => fullEvent(a));
      } else if (a.googleEventId) {
        ev = await patchOrRecreate(a.googleEventId, fullEvent(a), () => fullEvent(a));
      } else {
        ev = await insertEvent(fullEvent(a));
      }
      await prisma.appointment
        .update({ where: { id: a.id, version: a.version }, data: { googleEventId: ev.id, googleUpdated: ev.updated, googleSyncedVersion: a.version } })
        .catch(() => {}); // si la cita cambió mientras tanto, se enviará en la siguiente pasada
      stats.pushed++;
    } catch (err) {
      stats.warnings.push(`No se pudo enviar la cita de ${a.dog.name}: ${(err as Error).message}`);
    }
  }
}

type PushAppt = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  clientNotes: string | null;
  dog: { name: string; size: Parameters<typeof appointmentSummary>[2] };
  owner: { whatsapp: string | null; user: { firstName: string; lastName: string; phone: string | null } };
  services: { service: { name: string } }[];
};

function fullEvent(a: PushAppt) {
  const phone = normalizePhone(a.owner.whatsapp ?? a.owner.user.phone ?? "");
  return {
    summary: appointmentSummary(a.dog.name, a.services.map((s) => s.service.name), a.dog.size),
    description: [
      phone ? `Teléfono: +${phone}` : null,
      `Cliente: ${`${a.owner.user.firstName} ${a.owner.user.lastName}`.trim()}`,
      a.clientNotes ? `Notas: ${a.clientNotes}` : null,
      a.status === "PENDING" ? "Pendiente de confirmar" : null,
      "Creada en CANIA",
    ].filter(Boolean).join("\n"),
    ...eventTimes(a.startsAt, a.endsAt),
    // Con "telefono" y "perro" el agente reconoce la cita si el cliente quiere cancelarla por WhatsApp
    extendedProperties: { private: { origen: ORIGIN_CANIA, cania_id: a.id, telefono: phone, perro: a.dog.name } },
  };
}

async function patchOrRecreate(id: string, body: Parameters<typeof patchEvent>[1], recreate: () => Parameters<typeof insertEvent>[0]) {
  try {
    const ev = await patchEvent(id, body);
    if (ev.status !== "cancelled") return ev;
  } catch (e) {
    if (!(e instanceof GoogleApiError && (e.status === 404 || e.status === 410))) throw e;
  }
  return insertEvent(recreate());
}

async function pushBlocks(enabledAt: Date, stats: SyncStats) {
  const blocks = await prisma.timeBlock.findMany({
    where: { googleEventId: null, endsAt: { gt: new Date() }, createdAt: { gte: enabledAt } },
    include: { staff: { select: { displayName: true } } },
  });
  for (const b of blocks) {
    try {
      const ev = await insertEvent({
        summary: blockSummary(b.type, b.reason, b.staff?.displayName ?? null),
        description: "Bloqueo creado en CANIA",
        ...eventTimes(b.startsAt, b.endsAt),
        extendedProperties: { private: { origen: ORIGIN_CANIA_BLOCK, cania_block_id: b.id } },
      });
      await prisma.timeBlock.update({ where: { id: b.id }, data: { googleEventId: ev.id } }).catch(async () => {
        await deleteEvent(ev.id); // el bloqueo se borró mientras tanto
      });
      stats.blocksPushed++;
    } catch (err) {
      stats.warnings.push(`No se pudo enviar un bloqueo: ${(err as Error).message}`);
    }
  }
}

/** Quita de Google el evento de un bloqueo que se acaba de borrar en CANIA. */
export async function removeBlockEvent(googleEventId: string | null | undefined) {
  if (!googleEventId || !(await googleConfig()).configured) return;
  await deleteEvent(googleEventId).catch((e) => console.error("[google-calendar] borrar bloqueo", e));
}
