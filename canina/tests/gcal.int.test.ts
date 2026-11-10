/**
 * Sincronización con Google Calendar contra PostgreSQL real y un Google Calendar
 * simulado en memoria (se intercepta fetch).   INTEGRATION=1 npm test
 */
import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { atLocalMinutes } from "@/lib/time";

const run = process.env.INTEGRATION === "1";

type Ev = Record<string, any> & { id: string };
const calendar = new Map<string, Ev>();
let seq = 0;
const stamp = () => new Date(Date.now() + ++seq).toISOString();

function fakeGoogle(input: RequestInfo | URL, init: RequestInit = {}) {
  const url = new URL(String(input));
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
  if (url.host === "oauth2.googleapis.com") return json({ access_token: "tok", expires_in: 3600 });
  const m = /\/events(?:\/([^/?]+))?$/.exec(url.pathname)!;
  const id = m[1] && decodeURIComponent(m[1]);
  const method = init.method ?? "GET";
  if (method === "GET") return json({ items: [...calendar.values()] });
  if (method === "POST") {
    const ev = { ...JSON.parse(String(init.body)), id: `ev${++seq}`, status: "confirmed", updated: stamp() };
    calendar.set(ev.id, ev);
    return json(ev);
  }
  const ev = id ? calendar.get(id) : undefined;
  if (!ev || ev.status === "cancelled") return json({ error: "gone" }, 410);
  if (method === "PATCH") {
    Object.assign(ev, JSON.parse(String(init.body)), { updated: stamp() });
    return json(ev);
  }
  Object.assign(ev, { status: "cancelled", updated: stamp() }); // DELETE
  return new Response(null, { status: 204 });
}

function agentEvent(day: string, hhmm: string, perro: string, telefono: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const start = atLocalMinutes(day, h * 60 + m);
  const ev: Ev = {
    id: `agent-${++seq}`,
    status: "confirmed",
    updated: stamp(),
    summary: `${perro} · Baño Básico e Higiene (Pequeño)`,
    description: `Teléfono: +${telefono}\nCliente: Marta Ruiz\nRaza: sin indicar\nNotas: ninguna\nReservado por el agente de WhatsApp`,
    start: { dateTime: start.toISOString() },
    end: { dateTime: new Date(start.getTime() + 90 * 60_000).toISOString() },
    extendedProperties: { private: { telefono, perro, origen: "agente-whatsapp" } },
  };
  calendar.set(ev.id, ev);
  return ev;
}

function nextWeekday(): string {
  const d = new Date(Date.now() + 3 * 86_400_000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe.skipIf(!run)("sincronización con Google Calendar", () => {
  let sync: typeof import("@/features/gcal/server/sync.service").syncGoogleCalendar;
  const day = nextWeekday();
  const phone = "34611223344";

  beforeAll(async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.GOOGLE_CALENDAR_ID = "test@group.calendar.google.com";
    process.env.GOOGLE_SA_KEY = JSON.stringify({ client_email: "sa@test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) });
    vi.stubGlobal("fetch", vi.fn(fakeGoogle));
    await prisma.googleCalendarSync.deleteMany();
    await prisma.googleCalendarSync.create({ data: { id: "default", enabledAt: new Date(Date.now() - 1000) } });
    ({ syncGoogleCalendar: sync } = await import("@/features/gcal/server/sync.service"));
  });
  afterAll(() => prisma.$disconnect());

  it("importa una reserva del agente creando cliente, perro y cita", async () => {
    const ev = agentEvent(day, "09:30", "Lola", phone);
    const s = await sync();
    expect(s.imported).toBe(1);
    const a = await prisma.appointment.findUniqueOrThrow({ where: { googleEventId: ev.id }, include: { dog: true, owner: { include: { user: true } }, services: { include: { service: true } } } });
    expect(a.source).toBe("WHATSAPP");
    expect(a.status).toBe("CONFIRMED");
    expect(a.dog.name).toBe("Lola");
    expect(a.owner.whatsapp).toBe(`+${phone}`);
    expect(a.owner.user.firstName).toBe("Marta");
    expect(a.services.map((x) => x.service.slug)).toEqual(["bano-basico"]);
    expect(a.groomerId).not.toBeNull();
    // Una segunda pasada no duplica nada ni reenvía la cita a Google
    const again = await sync();
    expect(again.imported).toBe(0);
    expect(again.pushed).toBe(0);
  });

  it("si el cliente vuelve a reservar, reutiliza su ficha y su perro", async () => {
    agentEvent(day, "16:30", "Lola", phone);
    await sync();
    expect(await prisma.user.count({ where: { phone: `+${phone}` } })).toBe(1);
    expect(await prisma.dog.count({ where: { name: "Lola" } })).toBe(1);
  });

  it("cuando el agente cancela, la cita queda cancelada en CANIA", async () => {
    const ev = agentEvent(day, "18:00", "Lola", phone);
    await sync();
    calendar.set(ev.id, { ...ev, status: "cancelled", updated: stamp() });
    const s = await sync();
    expect(s.cancelledFromGoogle).toBe(1);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { googleEventId: ev.id } })).status).toBe("CANCELLED");
  });

  it("mover una cita del agente en CANIA cambia la hora en Google sin tocar sus datos", async () => {
    const ev = agentEvent(day, "11:00", "Lola", phone);
    await sync();
    const a = await prisma.appointment.findUniqueOrThrow({ where: { googleEventId: ev.id } });
    const startsAt = atLocalMinutes(day, 12 * 60);
    await prisma.appointment.update({ where: { id: a.id }, data: { startsAt, endsAt: new Date(startsAt.getTime() + 90 * 60_000), version: { increment: 1 } } });
    const s = await sync();
    expect(s.pushed).toBe(1);
    const g = calendar.get(ev.id)!;
    expect(new Date(g.start.dateTime).getTime()).toBe(startsAt.getTime());
    expect(g.extendedProperties.private.origen).toBe("agente-whatsapp");
    expect((await sync()).pushed).toBe(0); // sin eco
  });

  it("las citas nuevas de CANIA se copian a Google con el teléfono del cliente, y al cancelarlas se borran", async () => {
    const dog = await prisma.dog.findFirstOrThrow({ where: { name: "Toby" }, include: { owner: { include: { user: true } } } });
    const startsAt = atLocalMinutes(day, 17 * 60);
    const a = await prisma.appointment.create({
      data: { dogId: dog.id, ownerId: dog.ownerId, startsAt, endsAt: new Date(startsAt.getTime() + 60 * 60_000), status: "CONFIRMED", source: "BACKOFFICE" },
    });
    await sync();
    const linked = await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } });
    const g = calendar.get(linked.googleEventId!)!;
    expect(g.summary).toMatch(/^Toby · /);
    expect(g.extendedProperties.private).toMatchObject({ origen: "cania", cania_id: a.id, perro: "Toby" });

    await prisma.appointment.update({ where: { id: a.id }, data: { status: "CANCELLED", version: { increment: 1 } } });
    const s = await sync();
    expect(s.removedFromGoogle).toBe(1);
    expect(calendar.get(linked.googleEventId!)!.status).toBe("cancelled");
  });

  it("los bloqueos del salón se publican como «Bloqueo» y las citas de demostración antiguas no se envían", async () => {
    const startsAt = atLocalMinutes(day, 9 * 60);
    const b = await prisma.timeBlock.create({ data: { type: "HOLIDAY", reason: "Puente", staffId: null, startsAt, endsAt: atLocalMinutes(day, 14 * 60) } });
    await sync();
    const g = calendar.get((await prisma.timeBlock.findUniqueOrThrow({ where: { id: b.id } })).googleEventId!)!;
    expect(g.summary).toBe("Bloqueo · Vacaciones: Puente");
    const caniaEvents = [...calendar.values()].filter((e) => e.extendedProperties?.private?.origen === "cania");
    expect(caniaEvents).toHaveLength(1); // solo la cita creada en el test anterior, no las del seed
  });
});
