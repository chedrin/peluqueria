import "server-only";
import { importPKCS8, SignJWT } from "jose";

/**
 * Cliente mínimo de Google Calendar con cuenta de servicio (la misma que usa el
 * agente de WhatsApp en Kapso). Solo usa fetch + jose, así que funciona en Node y
 * en Cloudflare Workers.
 *
 * Configuración (.env):
 *   GOOGLE_CALENDAR_ID   id del calendario (…@group.calendar.google.com)
 *   GOOGLE_SA_KEY        JSON de la cuenta de servicio en una línea, o bien
 *   GOOGLE_SA_KEY_FILE   ruta al fichero .json (por defecto google-service-account.json)
 */

type ServiceAccount = { client_email: string; private_key: string };

export type GoogleEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  updated?: string;
  created?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string> };
};

export type GoogleEventInput = Omit<Partial<GoogleEvent>, "id" | "updated" | "created">;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

let cachedAccount: ServiceAccount | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

async function loadAccount(): Promise<ServiceAccount | null> {
  if (cachedAccount !== undefined) return cachedAccount;
  let raw = process.env.GOOGLE_SA_KEY?.trim();
  if (!raw) {
    const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
    if (!isWorkers) {
      try {
        const { readFile } = await import("node:fs/promises");
        raw = await readFile(process.env.GOOGLE_SA_KEY_FILE?.trim() || "google-service-account.json", "utf8");
      } catch {
        raw = undefined;
      }
    }
  }
  if (!raw) return (cachedAccount = null);
  const parsed = JSON.parse(raw) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) throw new Error("El JSON de la cuenta de servicio no tiene client_email/private_key.");
  return (cachedAccount = parsed);
}

export async function googleConfig() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  let account: ServiceAccount | null = null;
  let error: string | null = null;
  try {
    account = await loadAccount();
  } catch (e) {
    error = `No se pudo leer la cuenta de servicio: ${(e as Error).message}`;
  }
  return {
    configured: !!calendarId && !!account,
    calendarId: calendarId ?? null,
    serviceAccountEmail: account?.client_email ?? null,
    error,
  };
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const account = await loadAccount();
  if (!account) throw new Error("Falta la cuenta de servicio de Google.");
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(key);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google rechazó la cuenta de servicio (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

function eventsUrl(suffix = "") {
  const id = process.env.GOOGLE_CALENDAR_ID?.trim();
  if (!id) throw new Error("Falta GOOGLE_CALENDAR_ID.");
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events${suffix}`;
}

export class GoogleApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new GoogleApiError(res.status, `Google Calendar ${init.method ?? "GET"} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

/** Eventos (incluidos los borrados) entre dos instantes, ya expandidos si son periódicos. */
export async function listEvents(from: Date, to: Date): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "2500",
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      ...(pageToken ? { pageToken } : {}),
    });
    const page = await call<{ items?: GoogleEvent[]; nextPageToken?: string }>(eventsUrl(`?${q}`));
    out.push(...(page?.items ?? []));
    pageToken = page?.nextPageToken;
  } while (pageToken);
  return out;
}

export async function insertEvent(body: GoogleEventInput) {
  return (await call<GoogleEvent>(eventsUrl(), { method: "POST", body: JSON.stringify(body) }))!;
}

export async function patchEvent(id: string, body: GoogleEventInput) {
  return (await call<GoogleEvent>(eventsUrl(`/${encodeURIComponent(id)}`), { method: "PATCH", body: JSON.stringify(body) }))!;
}

/** Borra un evento; si ya no existía no es un error. */
export async function deleteEvent(id: string) {
  try {
    await call(eventsUrl(`/${encodeURIComponent(id)}`), { method: "DELETE" });
  } catch (e) {
    if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}
