import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { googleConfig } from "./google-client";
import { syncGoogleCalendar } from "./sync.service";

/**
 * Lanza una sincronización cuando termina la respuesta (no hace esperar al usuario).
 * Úsalo tras crear/mover/cancelar citas o bloqueos. Con `ifOlderThanMs` solo se
 * lanza si la última pasada es más antigua (p. ej. al abrir la agenda).
 */
export function scheduleGoogleSync(opts: { ifOlderThanMs?: number } = {}) {
  after(async () => {
    try {
      if (!(await googleConfig()).configured) return;
      if (opts.ifOlderThanMs) {
        const s = await prisma.googleCalendarSync.findUnique({ where: { id: "default" }, select: { lastRunAt: true } });
        if (s?.lastRunAt && Date.now() - s.lastRunAt.getTime() < opts.ifOlderThanMs) return;
      }
      await syncGoogleCalendar();
    } catch (e) {
      console.error("[google-calendar] sincronización en segundo plano", e);
    }
  });
}
