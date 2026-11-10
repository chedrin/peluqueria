/**
 * Al arrancar el servidor (Node, p. ej. `npm run local`) sincroniza con Google
 * Calendar cada 2 minutos para traer las reservas del agente de WhatsApp aunque
 * nadie tenga la agenda abierta. En Cloudflare Workers no hay temporizadores
 * persistentes: allí se sincroniza al abrir la agenda y tras cada cambio.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startGoogleCalendarSync } = await import("./instrumentation-node");
    await startGoogleCalendarSync();
  }
}
