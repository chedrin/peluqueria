import { CalendarCheck, CalendarX, MessageCircle } from "lucide-react";
import { requirePageRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncNowButton } from "@/features/gcal/components/SyncNowButton";
import { getSyncState } from "@/features/gcal/server/sync.service";

export const metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" });

function ago(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  return fmt.format(d);
}

export default async function SettingsPage() {
  await requirePageRole(["ADMIN", "RECEPTION"]);
  const [g, fromWhatsapp, upcomingWhatsapp] = await Promise.all([
    getSyncState(),
    prisma.appointment.count({ where: { source: "WHATSAPP" } }),
    prisma.appointment.count({ where: { source: "WHATSAPP", startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } } }),
  ]);
  const s = g.stats;
  const failing = !!g.state?.lastError;

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Ajustes</h1>
      <p className="mb-6 text-sm text-muted-foreground">Conexiones de CANIA con otros servicios.</p>

      <Card className="max-w-3xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              {g.configured && !failing ? <CalendarCheck className="size-5 text-emerald-600" /> : <CalendarX className="size-5 text-muted-foreground" />}
              Google Calendar
            </CardTitle>
            <CardDescription className="mt-1">
              Las citas que reserva el agente de WhatsApp aparecen solas en la agenda, y las que creas o cambias aquí se
              copian al calendario para que el agente no reserve encima.
            </CardDescription>
          </div>
          {!g.configured ? (
            <Badge variant="outline">Sin configurar</Badge>
          ) : failing ? (
            <Badge variant="destructive">Con errores</Badge>
          ) : g.state?.lastOkAt ? (
            <Badge variant="success">Conectado</Badge>
          ) : (
            <Badge variant="warning">Pendiente de la primera sincronización</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          {!g.configured ? (
            <div className="rounded-lg border border-dashed p-4">
              <p className="mb-2 font-medium">Para conectarlo:</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Copia el fichero JSON de la cuenta de servicio que usa tu agente en Kapso dentro de la carpeta <code>canina</code> con el nombre <code>google-service-account.json</code>.</li>
                <li>En el fichero <code>.env</code> añade <code>GOOGLE_CALENDAR_ID=&quot;…@group.calendar.google.com&quot;</code> (el mismo calendario del agente).</li>
                <li>Reinicia CANIA (<code>npm run local</code>) y vuelve a esta página.</li>
              </ol>
              {g.error && <p className="mt-3 text-red-700">{g.error}</p>}
            </div>
          ) : (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
              <dt className="text-muted-foreground">Calendario</dt>
              <dd className="truncate font-mono text-xs leading-5">{g.calendarId}</dd>
              <dt className="text-muted-foreground">Cuenta de servicio</dt>
              <dd className="truncate font-mono text-xs leading-5">{g.serviceAccountEmail}</dd>
              <dt className="text-muted-foreground">Última sincronización</dt>
              <dd>{g.state?.lastRunAt ? ago(g.state.lastRunAt) : "Todavía ninguna"} · se repite cada 2 minutos y al abrir la agenda</dd>
              <dt className="text-muted-foreground">Envía a Google</dt>
              <dd>Citas y bloqueos creados desde el {g.state ? fmt.format(g.state.enabledAt) : "primer uso"}</dd>
            </dl>
          )}

          {failing && (
            <p className="rounded-lg bg-red-50 p-3 text-red-800">
              <strong>Último error:</strong> {g.state!.lastError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<MessageCircle className="size-4 text-emerald-600" />} label="Reservas de WhatsApp" value={fromWhatsapp} hint={`${upcomingWhatsapp} próximas`} />
            <Stat label="Nuevas en la última pasada" value={s?.imported ?? 0} />
            <Stat label="Enviadas a Google" value={(s?.pushed ?? 0) + (s?.blocksPushed ?? 0)} />
            <Stat label="Canceladas o movidas desde Google" value={(s?.cancelledFromGoogle ?? 0) + (s?.updatedFromGoogle ?? 0)} />
          </div>

          {s && s.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
              <p className="mb-1 font-medium">Avisos de la última pasada</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {s.warnings.slice(0, 8).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <SyncNowButton disabled={!g.configured} />
        </CardContent>
      </Card>
    </>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: number; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
