import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, Gift } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/session";
import { formatCents } from "@/lib/money";
import { atLocalMinutes, formatHM, localDay, localMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_META } from "@/features/agenda/domain/status";
import { HEALTH_ALERT_LABEL } from "@/features/dogs/domain/labels";

export const metadata = { title: "Inicio" };
export const dynamic = "force-dynamic";

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Panel de inicio: lo que hay hoy, cómo va la semana y qué bonos están por caducar. */
export default async function AdminHome() {
  const s = await requirePageRole(STAFF_ROLES);
  const canSeeMoney = s.role === "ADMIN" || s.role === "RECEPTION";
  const today = localDay(new Date());
  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const in30 = new Date(Date.now() + 30 * 86_400_000);

  const [appts, invoices, expiring] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: atLocalMinutes(today, 0), lt: atLocalMinutes(addDays(today, 1), 0) }, status: { notIn: ["CANCELLED"] } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true, startsAt: true, status: true,
        groomer: { select: { displayName: true, color: true } },
        dog: { select: { id: true, name: true, healthAlerts: { where: { isActive: true }, select: { id: true, type: true, description: true } } } },
        services: { select: { service: { select: { name: true } } } },
      },
    }),
    canSeeMoney
      ? prisma.invoice.findMany({
          where: { status: "ISSUED", issueDate: { gte: atLocalMinutes(monday, 0), lt: atLocalMinutes(addDays(monday, 7), 0) } },
          select: { issueDate: true, totalCents: true },
        })
      : Promise.resolve([]),
    prisma.voucher.findMany({
      where: { status: "ACTIVE", expiresAt: { lte: in30 } },
      orderBy: { expiresAt: "asc" },
      take: 6,
      select: { id: true, code: true, expiresAt: true, totalSessions: true, usedSessions: true, product: { select: { name: true } }, owner: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } },
    }),
  ]);

  const byDay = WEEKDAYS.map((label, i) => {
    const day = addDays(monday, i);
    return { label, day, cents: invoices.filter((inv) => inv.issueDate && localDay(inv.issueDate) === day).reduce((sum, inv) => sum + inv.totalCents, 0) };
  });
  const weekTotal = byDay.reduce((sum, d) => sum + d.cents, 0);
  const maxDay = Math.max(...byDay.map((d) => d.cents), 1);
  const nowMin = localMinutes(new Date());
  const pending = appts.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED").length;
  const withAlerts = appts.filter((a) => a.dog.healthAlerts.length > 0).length;
  const greeting = nowMin < 14 * 60 ? "Buenos días" : nowMin < 21 * 60 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}, {s.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {new Date(`${today}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
          </p>
        </div>
        <Link href="/admin/agenda" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Abrir agenda <ArrowRight className="size-4" />
        </Link>
      </header>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Citas hoy" value={String(appts.length)} hint={`${pending} por empezar`} />
        <Stat label="Con alertas de salud" value={String(withAlerts)} hint={withAlerts ? "revisa antes de empezar" : "ninguna hoy"} />
        <Stat label="Bonos por caducar" value={String(expiring.length)} hint="en los próximos 30 días" />
        {canSeeMoney && <Stat label="Facturado esta semana" value={formatCents(weekTotal)} hint="documentos emitidos" />}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Citas de hoy</CardTitle>
            <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            {appts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No hay citas para hoy.</p>
            ) : (
              <ul className="divide-y">
                {appts.map((a) => {
                  const start = localMinutes(a.startsAt);
                  return (
                    <li key={a.id} className={cn("flex items-center gap-3 py-2.5", start < nowMin && a.status !== "IN_PROGRESS" && "opacity-60")}>
                      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatHM(start)}</span>
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: a.groomer?.color ?? "var(--border)" }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <Link href={`/admin/perros/${a.dog.id}`} className="font-medium hover:underline">{a.dog.name}</Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a.services.map((x) => x.service.name).join(", ")} · {a.groomer?.displayName ?? "sin asignar"}
                        </span>
                      </span>
                      {a.dog.healthAlerts.slice(0, 1).map((h) => (
                        <span key={h.id} title={h.description} className="hidden items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 sm:inline-flex">
                          <AlertTriangle className="size-3" aria-hidden /> {HEALTH_ALERT_LABEL[h.type]}
                        </span>
                      ))}
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("size-1.5 rounded-full", STATUS_META[a.status].dot)} aria-hidden /> {STATUS_META[a.status].label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {canSeeMoney && (
            <Card>
              <CardHeader className="pb-2"><CardTitle>Facturación de la semana</CardTitle></CardHeader>
              <CardContent>
                {weekTotal === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay tickets ni facturas emitidos esta semana.</p>
                ) : (<>
                <div className="flex h-36 items-end gap-2 border-b" role="img" aria-label={`Facturación diaria de esta semana, total ${formatCents(weekTotal)}`}>
                  {byDay.map((d) => (
                    <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${formatCents(d.cents)}`}>
                      <div
                        className={cn("rounded-t bg-primary transition-opacity group-hover:opacity-80", d.day > today && "bg-muted")}
                        style={{ height: d.cents ? `${Math.max((d.cents / maxDay) * 100, 3)}%` : "2px" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-2">
                  {byDay.map((d) => (
                    <span key={d.day} className={cn("flex-1 text-center text-[11px] text-muted-foreground", d.day === today && "font-semibold text-foreground")}>{d.label}</span>
                  ))}
                </div>
                <table className="sr-only">
                  <caption>Facturación por día</caption>
                  <tbody>{byDay.map((d) => <tr key={d.day}><th>{d.label}</th><td>{formatCents(d.cents)}</td></tr>)}</tbody>
                </table>
                </>)}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle>Bonos por caducar</CardTitle>
              <Gift className="size-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              {expiring.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún bono caduca en los próximos 30 días.</p>
              ) : (
                <ul className="space-y-2.5 text-sm">
                  {expiring.map((v) => (
                    <li key={v.id} className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <Link href={`/admin/clientes/${v.owner.id}`} className="font-medium hover:underline">{v.owner.user.firstName} {v.owner.user.lastName}</Link>
                        <span className="block truncate text-xs text-muted-foreground">{v.product.name} · quedan {v.totalSessions - v.usedSessions}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-amber-800">
                        {v.expiresAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
