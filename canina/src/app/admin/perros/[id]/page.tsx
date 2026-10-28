import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ClipboardList, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { DogProfileForm } from "@/features/dogs/components/DogProfileForm";
import { HealthAlertsPanel } from "@/features/dogs/components/HealthAlertsPanel";
import { HEALTH_ALERT_LABEL } from "@/features/dogs/domain/labels";
import { GroomingRecordForm } from "@/features/dogs/components/GroomingRecordForm";
import { BeforeAfterGallery } from "@/features/dogs/components/BeforeAfterGallery";
import { COAT_LABEL } from "@/features/catalog/domain/pricing";

const TEMPERAMENT: Record<string, string> = { NERVOUS: "Nervioso", FEARFUL: "Miedoso", REACTIVE: "Reactivo", AGGRESSIVE: "Agresivo" };
const TOLERANCE: Record<string, string> = { PARTIAL: "con dificultad", NO: "no" };

function age(birth: Date | null) {
  if (!birth) return null;
  const months = Math.floor((Date.now() - birth.getTime()) / (30.44 * 86_400_000));
  return months < 24 ? `${months} meses` : `${Math.floor(months / 12)} años`;
}

const fmtDay = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" });

/** Mini gráfica de peso (más antiguo a la izquierda). */
function WeightSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [4 + (i * 232) / (points.length - 1), 52 - ((p - min) / span) * 44] as const);
  const last = xy[xy.length - 1];
  return (
    <svg viewBox="0 0 240 60" className="h-14 w-full" role="img" aria-label={`Peso entre ${min} y ${max} kg en las últimas ${points.length} mediciones`}>
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--primary)" />
    </svg>
  );
}

export default async function DogDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dog, next] = await Promise.all([
    prisma.dog.findUnique({
      where: { id },
      include: {
        breed: true,
        owner: { include: { user: true } },
        healthAlerts: { orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] },
        weightHistory: { orderBy: { measuredAt: "desc" }, take: 6 },
        groomingRecords: { orderBy: { performedAt: "desc" }, include: { groomer: true, photos: true } },
        appointments: { where: { status: "IN_PROGRESS" }, select: { id: true, services: { select: { service: { select: { name: true } } } } }, take: 1 },
      },
    }),
    prisma.appointment.findFirst({
      where: { dogId: id, startsAt: { gt: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, groomer: { select: { displayName: true } }, services: { select: { service: { select: { name: true } } } } },
    }),
  ]);
  if (!dog) notFound();
  const active = dog.healthAlerts.filter((h) => h.isActive);
  const current = dog.appointments[0];
  const lastRecord = dog.groomingRecords[0];
  const breed = dog.breed?.name ?? dog.breedText ?? "Mestizo";

  // Manías y avisos de manejo que el peluquero debe ver nada más abrir la ficha
  const handling = [
    TEMPERAMENT[dog.temperament],
    TOLERANCE[dog.toleratesDryer] && `Secador: ${TOLERANCE[dog.toleratesDryer]}`,
    TOLERANCE[dog.toleratesBlower] && `Expulsador: ${TOLERANCE[dog.toleratesBlower]}`,
    TOLERANCE[dog.allowsNailTrim] && `Uñas: ${TOLERANCE[dog.allowsNailTrim]}`,
  ].filter(Boolean) as string[];

  const weight = (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between pb-2">
        <CardTitle>Peso</CardTitle>
        {dog.weightHistory.length > 1 && <span className="text-xs text-muted-foreground">últimas {dog.weightHistory.length} mediciones</span>}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {dog.weightHistory.length === 0 ? (
          <p className="text-muted-foreground">Aún no hay pesos registrados. Se guardan al registrar una sesión.</p>
        ) : (
          <>
            <p className="text-2xl font-bold">{dog.weightHistory[0].weightKg.toString().replace(".", ",")} kg</p>
            <WeightSparkline points={[...dog.weightHistory].reverse().map((w) => Number(w.weightKg))} />
            <p className="text-xs text-muted-foreground">Última medición: {fmtDay(dog.weightHistory[0].measuredAt)}</p>
          </>
        )}
      </CardContent>
    </Card>
  );

  const history =
    dog.groomingRecords.length === 0 ? (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <ClipboardList className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Todavía no hay sesiones registradas</p>
          <p className="max-w-sm text-sm text-muted-foreground">Cuando registres una sesión aparecerán aquí los servicios, el champú, la cuchilla y las fotos de antes y después.</p>
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardContent className="pt-5">
          <div className="overflow-x-auto">
            <Table>
              <THead><TR><TH>Fecha</TH><TH>Peluquero</TH><TH>Servicios</TH><TH>Champú / cosmética</TH><TH>Cuchilla / recalce</TH><TH>Notas</TH></TR></THead>
              <TBody>
                {dog.groomingRecords.map((r) => (
                  <TR key={r.id}>
                    <TD className="whitespace-nowrap">{fmtDay(r.performedAt)}</TD>
                    <TD>{r.groomer.displayName}</TD>
                    <TD>{r.servicesDone.join(", ")}</TD>
                    <TD>{[r.shampoo, r.conditioner].filter(Boolean).join(" + ")}</TD>
                    <TD>{[r.bladeNumber && `#${r.bladeNumber}`, r.combGuide].filter(Boolean).join(" · ")}</TD>
                    <TD className="max-w-xs text-muted-foreground">{[r.cutDescription, r.behaviorNotes].filter(Boolean).join(" — ")}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          {dog.groomingRecords.map((r) => r.photos.length > 0 && (
            <div key={r.id} className="mt-4">
              <p className="text-sm font-medium">{fmtDay(r.performedAt)}</p>
              <BeforeAfterGallery photos={r.photos} />
            </div>
          ))}
        </CardContent>
      </Card>
    );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <nav aria-label="Ruta" className="text-sm text-muted-foreground">
        <Link href="/admin/clientes" className="hover:underline">Clientes</Link> /{" "}
        <Link href={`/admin/clientes/${dog.ownerId}`} className="hover:underline">{dog.owner.user.firstName} {dog.owner.user.lastName}</Link> /{" "}
        <span className="text-foreground">{dog.name}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5 shadow-sm">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-secondary text-2xl font-bold text-secondary-foreground" aria-hidden>
          {dog.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{dog.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[breed, age(dog.birthDate), dog.currentWeightKg && `${dog.currentWeightKg.toString().replace(".", ",")} kg`, COAT_LABEL[dog.coatType]].filter(Boolean).join(" · ")}
            </p>
          </div>
          {(active.length > 0 || handling.length > 0 || dog.needsMuzzle || dog.favoriteTreats) && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Alertas y manejo">
              {active.map((h) => (
                <li key={h.id} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", h.severity === "INFO" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800")}>
                  <AlertTriangle className="size-3" aria-hidden /> {HEALTH_ALERT_LABEL[h.type]}: {h.description}{h.bodyArea ? ` (zona: ${h.bodyArea})` : ""}
                </li>
              ))}
              {dog.needsMuzzle && (
                <li className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-900"><ShieldAlert className="size-3" aria-hidden /> Necesita bozal</li>
              )}
              {handling.map((h) => <li key={h} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-200">{h}</li>)}
              {dog.favoriteTreats && <li className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Premio: {dog.favoriteTreats}</li>}
            </ul>
          )}
        </div>
      </header>

      <Tabs
        label="Secciones de la ficha"
        initial={current ? "session" : "profile"}
        items={[
          {
            id: "profile",
            label: "Ficha",
            content: (
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <Card>
                  <CardHeader><CardTitle>Datos, temperamento y preferencias</CardTitle></CardHeader>
                  <CardContent><DogProfileForm dog={{ ...dog, breedText: dog.breedText ?? dog.breed?.name ?? null, birthDate: dog.birthDate?.toISOString().slice(0, 10) ?? "" }} /></CardContent>
                </Card>
                <div className="space-y-5">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle>Próxima cita</CardTitle></CardHeader>
                    <CardContent className="text-sm">
                      {next ? (
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-[11px] font-semibold uppercase text-secondary-foreground">
                            {next.startsAt.toLocaleDateString("es-ES", { month: "short", timeZone: "Europe/Madrid" }).replace(".", "")}
                            <strong className="text-lg leading-none">{next.startsAt.toLocaleDateString("es-ES", { day: "numeric", timeZone: "Europe/Madrid" })}</strong>
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate font-semibold">{next.services.map((s) => s.service.name).join(" + ")}</strong>
                            <span className="text-muted-foreground first-letter:uppercase">
                              {next.startsAt.toLocaleString("es-ES", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
                              {next.groomer ? ` · con ${next.groomer.displayName}` : ""}
                            </span>
                          </span>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Sin citas pendientes.</p>
                      )}
                    </CardContent>
                  </Card>
                  {weight}
                  {lastRecord && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle>Última sesión</CardTitle></CardHeader>
                      <CardContent className="text-sm leading-relaxed text-muted-foreground">
                        {fmtDay(lastRecord.performedAt)} · {lastRecord.groomer.displayName} · {[lastRecord.servicesDone.join(", "), lastRecord.shampoo, lastRecord.bladeNumber && `cuchilla ${lastRecord.bladeNumber}`, lastRecord.combGuide].filter(Boolean).join(", ")}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ),
          },
          {
            id: "health",
            label: "Salud",
            badge: active.length > 0 ? <Badge variant="destructive" className="rounded-full px-1.5 py-0">{active.length}</Badge> : undefined,
            content: (
              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                <HealthAlertsPanel dogId={dog.id} alerts={dog.healthAlerts.map((h) => ({ id: h.id, type: h.type, severity: h.severity, description: h.description, isActive: h.isActive }))} />
                {weight}
              </div>
            ),
          },
          {
            id: "session",
            label: "Sesión de hoy",
            badge: current ? <Badge variant="warning" className="rounded-full">en curso</Badge> : undefined,
            content: (
              <Card>
                <CardHeader><CardTitle>Registrar sesión</CardTitle></CardHeader>
                <CardContent>
                  <GroomingRecordForm dogId={dog.id} appointmentId={current?.id} defaultServices={current?.services.map((s) => s.service.name) ?? []} />
                </CardContent>
              </Card>
            ),
          },
          {
            id: "history",
            label: "Historial",
            badge: dog.groomingRecords.length > 0 ? <span className="text-xs text-muted-foreground">{dog.groomingRecords.length}</span> : undefined,
            content: history,
          },
        ]}
      />
    </div>
  );
}
