import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { localDay } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_META } from "@/features/agenda/domain/status";
import { MyAppointmentActions } from "@/features/booking/components/MyAppointmentActions";

export default async function MyAppointments() {
  const s = await requirePageRole(["CLIENT"]);
  const [appts, settings] = await Promise.all([
    prisma.appointment.findMany({
      where: { ownerId: s.ownerId },
      orderBy: { startsAt: "desc" },
      take: 50,
      include: { dog: true, groomer: true, services: { include: { service: true } } },
    }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
  ]);
  const windowMs = (settings?.cancellationWindowHours ?? 24) * 3_600_000;
  const now = Date.now();
  const upcoming = appts.filter((a) => a.startsAt.getTime() >= now && ["PENDING", "CONFIRMED"].includes(a.status)).reverse();
  const past = appts.filter((a) => !upcoming.includes(a));

  const row = (a: (typeof appts)[number], actions: boolean) => (
    <Card key={a.id}>
      <CardContent className="flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">
            {a.dog.name} · {a.startsAt.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" })}
          </p>
          <p className="text-sm text-muted-foreground">
            {a.services.map((x) => x.service.name).join(", ")} · {a.groomer?.displayName ?? "Por asignar"} · {formatCents(a.estimatedCents)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{STATUS_META[a.status].label}</Badge>
          {actions && (
            <MyAppointmentActions
              appointmentId={a.id}
              canModify={a.startsAt.getTime() - now >= windowMs}
              dogId={a.dogId}
              serviceIds={a.services.map((x) => x.serviceId)}
              currentDay={localDay(a.startsAt)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Mis citas</h1>
      <section className="space-y-3">
        <h2 className="font-semibold">Próximas</h2>
        {upcoming.length ? upcoming.map((a) => row(a, true)) : <p className="text-sm text-muted-foreground">No tienes citas próximas.</p>}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Historial</h2>
        {past.map((a) => row(a, false))}
      </section>
    </div>
  );
}
