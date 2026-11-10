import type { DogSize, TimeBlockType } from "@prisma/client";

/**
 * Traducción entre los eventos que escribe el agente de WhatsApp en Google Calendar
 * y las citas de CANIA. Sin dependencias de servidor para poder probarlo.
 *
 * El agente crea eventos así:
 *   summary:     "Toby · Baño y Corte Completo (Mediano)"
 *   description: "Teléfono: +34600…\nCliente: Ana\nRaza: Caniche\nNotas: …\nReservado por el agente de WhatsApp"
 *   extendedProperties.private: { telefono, perro, origen: "agente-whatsapp" }
 */

export const ORIGIN_AGENT = "agente-whatsapp";
export const ORIGIN_CANIA = "cania";
export const ORIGIN_CANIA_BLOCK = "cania-bloqueo";

export type AgentBooking = {
  phone: string; // solo dígitos, con prefijo de país
  dogName: string;
  serviceText: string | null;
  sizeText: string | null;
  clientName: string | null;
  breed: string | null;
  notes: string | null;
};

const NONE = /^(sin indicar|ninguna|ninguno|-)$/i;

function field(description: string, label: string): string | null {
  const m = new RegExp(`^\\s*${label}:\\s*(.+)$`, "im").exec(description);
  const v = m?.[1].trim();
  return v && !NONE.test(v) ? v : null;
}

/** Lee los datos de una reserva del agente. Devuelve null si no es del agente o le faltan datos. */
export function parseAgentEvent(e: {
  summary?: string;
  description?: string;
  extendedProperties?: { private?: Record<string, string> };
}): AgentBooking | null {
  const p = e.extendedProperties?.private ?? {};
  if (p.origen !== ORIGIN_AGENT) return null;
  const phone = normalizePhone(p.telefono ?? "");
  const summary = e.summary ?? "";
  const [, rest = ""] = summary.split(" · ");
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(rest);
  const dogName = (p.perro ?? summary.split(" · ")[0] ?? "").trim();
  if (!phone || !dogName) return null;
  const description = e.description ?? "";
  return {
    phone,
    dogName,
    serviceText: (m ? m[1] : rest).trim() || null,
    sizeText: m?.[2].trim() || null,
    clientName: field(description, "Cliente"),
    breed: field(description, "Raza"),
    notes: field(description, "Notas"),
  };
}

/** Dígitos con prefijo de país (por defecto España): "+34 600 11 22 33" → "34600112233". */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && /^[6789]/.test(d)) d = `34${d}`;
  return d.length >= 8 ? d : "";
}

/** Dos teléfonos son el mismo si coinciden los últimos 9 dígitos. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizePhone(a ?? "");
  const y = normalizePhone(b ?? "");
  return !!x && !!y && x.slice(-9) === y.slice(-9);
}

export function strip(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Tamaño que usa el agente → tamaño de CANIA. */
export function mapSize(sizeText: string | null): DogSize {
  const s = strip(sizeText ?? "");
  if (/gigante|> ?35|muy grande/.test(s)) return "GIANT";
  if (/grande|20 ?- ?35/.test(s)) return "LARGE";
  if (/mediano|10 ?- ?20/.test(s)) return "MEDIUM";
  return "SMALL"; // toy, muy pequeño, pequeño o desconocido
}

const SERVICE_RULES: { test: RegExp; slugs: string[] }[] = [
  { test: /stripping|manto duro/, slugs: ["stripping"] },
  { test: /bano.*corte|corte.*bano|corte completo/, slugs: ["bano-basico", "corte-tijera"] },
  { test: /deslanad/, slugs: ["deslanado"] },
  { test: /bano|higiene/, slugs: ["bano-basico"] },
  { test: /corte.*tijera|tijera|maquina/, slugs: ["corte-tijera"] },
  { test: /unas/, slugs: ["corte-unas"] },
  { test: /glandul/, slugs: ["vaciado-glandulas"] },
];

/** Elige los servicios de CANIA que corresponden al texto del agente (por nombre exacto o por reglas). */
export function matchServices<T extends { id: string; name: string; slug: string }>(serviceText: string | null, services: T[]): T[] {
  if (!serviceText) return [];
  const text = strip(serviceText);
  const exact = services.find((s) => strip(s.name) === text);
  if (exact) return [exact];
  const rule = SERVICE_RULES.find((r) => r.test.test(text));
  if (!rule) return [];
  return rule.slugs.map((slug) => services.find((s) => s.slug === slug)).filter((s): s is T => !!s);
}

const SIZE_LABEL: Record<DogSize, string> = { SMALL: "Pequeño", MEDIUM: "Mediano", LARGE: "Grande", GIANT: "Gigante" };

/** Título del evento en Google para una cita creada en CANIA (mismo formato que el agente). */
export function appointmentSummary(dogName: string, services: string[], size: DogSize): string {
  return `${dogName} · ${services.length ? services.join(" + ") : "Cita"} (${SIZE_LABEL[size]})`;
}

const BLOCK_LABEL: Record<TimeBlockType, string> = {
  BREAK: "Descanso",
  SICK_LEAVE: "Baja",
  HOLIDAY: "Vacaciones",
  INCIDENT: "Incidencia",
  TRAINING: "Formación",
};

/**
 * Título del evento para un bloqueo. El agente trata como cerrado todo evento que
 * empieza por "Bloqueo"; un bloqueo de un solo peluquero ("Ausencia") solo ocupa
 * una de las plazas del turno.
 */
export function blockSummary(type: TimeBlockType, reason: string | null, staffName: string | null): string {
  const what = [BLOCK_LABEL[type], reason].filter(Boolean).join(": ");
  return staffName ? `Ausencia · ${staffName} · ${what}` : `Bloqueo · ${what}`;
}
