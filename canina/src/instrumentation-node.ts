/**
 * (Solo Node.)
 * Al arrancar el servidor (Node, p. ej. `npm run local`) sincroniza con Google
 * Calendar cada 2 minutos para traer las reservas del agente de WhatsApp aunque
 * nadie tenga la agenda abierta. En Cloudflare Workers no hay temporizadores
 * persistentes: allí se sincroniza al abrir la agenda y tras cada cambio.
 */
export async function startGoogleCalendarSync() {
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { googleConfig } = await import("./features/gcal/server/google-client");
  const cfg = await googleConfig();
  if (!cfg.configured) {
    if (cfg.error) console.warn(`[google-calendar] ${cfg.error}`);
    return;
  }
  const { syncGoogleCalendar } = await import("./features/gcal/server/sync.service");
  const tick = () =>
    syncGoogleCalendar()
      .then((s) => {
        if (s.imported || s.pushed || s.cancelledFromGoogle || s.updatedFromGoogle)
          console.info(`[google-calendar] ${s.imported} nuevas, ${s.pushed} enviadas, ${s.cancelledFromGoogle} canceladas, ${s.updatedFromGoogle} movidas`);
      })
      .catch((e) => console.error("[google-calendar]", (e as Error).message));
  console.info(`[google-calendar] Sincronizando con ${cfg.calendarId} cada 2 minutos`);
  setTimeout(tick, 5_000);
  setInterval(tick, 120_000);
}
