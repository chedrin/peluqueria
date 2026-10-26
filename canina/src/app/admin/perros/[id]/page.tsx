import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DogProfileForm } from "@/features/dogs/components/DogProfileForm";
import { HealthAlertsPanel } from "@/features/dogs/components/HealthAlertsPanel";
import { HEALTH_ALERT_LABEL } from "@/features/dogs/domain/labels";
import { GroomingRecordForm } from "@/features/dogs/components/GroomingRecordForm";
import { BeforeAfterGallery } from "@/features/dogs/components/BeforeAfterGallery";

function age(birth: Date | null) {
  if (!birth) return null;
  const months = Math.floor((Date.now() - birth.getTime()) / (30.44 * 86_400_000));
  return months < 24 ? `${months} meses` : `${Math.floor(months / 12)} años`;
}

export default async function DogDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dog = await prisma.dog.findUnique({
    where: { id },
    include: {
      breed: true,
      owner: { include: { user: true } },
      healthAlerts: { orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] },
      weightHistory: { orderBy: { measuredAt: "desc" }, take: 6 },
      groomingRecords: { orderBy: { performedAt: "desc" }, include: { groomer: true, photos: true } },
      appointments: { where: { status: "IN_PROGRESS" }, select: { id: true, services: { select: { service: { select: { name: true } } } } }, take: 1 },
    },
  });
  if (!dog) notFound();
  const active = dog.healthAlerts.filter((h) => h.isActive);
  const current = dog.appointments[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/admin/clientes/${dog.ownerId}`} className="hover:underline">{dog.owner.user.firstName} {dog.owner.user.lastName}</Link> ›
        </p>
        <h1 className="text-2xl font-bold">{dog.name}</h1>
        <p className="text-muted-foreground">
          {dog.breed?.name ?? dog.breedText ?? "Mestizo"} · {age(dog.birthDate) ?? "edad desconocida"} · {dog.currentWeightKg?.toString() ?? "?"} kg
        </p>
      </div>

      {active.length > 0 && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-900">
          <p className="mb-2 flex items-center gap-2 font-bold uppercase"><AlertTriangle className="size-5" /> Alertas de salud</p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {active.map((h) => <li key={h.id}><strong>{HEALTH_ALERT_LABEL[h.type]}</strong>: {h.description}{h.bodyArea ? ` (zona: ${h.bodyArea})` : ""}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader><CardTitle>Ficha: datos, temperamento y preferencias</CardTitle></CardHeader>
          <CardContent><DogProfileForm dog={{ ...dog, breedText: dog.breedText ?? dog.breed?.name ?? null, birthDate: dog.birthDate?.toISOString().slice(0, 10) ?? "" }} /></CardContent>
        </Card>
        <div className="space-y-6">
          <HealthAlertsPanel dogId={dog.id} alerts={dog.healthAlerts.map((h) => ({ id: h.id, type: h.type, severity: h.severity, description: h.description, isActive: h.isActive }))} />
          <Card>
            <CardHeader><CardTitle>Peso</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {dog.weightHistory.map((w) => <p key={w.id} className="flex justify-between"><span>{w.measuredAt.toLocaleDateString("es-ES")}</span><span>{w.weightKg.toString()} kg</span></p>)}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Registrar sesión {current && <Badge variant="warning" className="ml-2">cita en curso</Badge>}</CardTitle></CardHeader>
        <CardContent>
          <GroomingRecordForm dogId={dog.id} appointmentId={current?.id} defaultServices={current?.services.map((s) => s.service.name) ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historial de actuaciones</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Fecha</TH><TH>Peluquero</TH><TH>Servicios</TH><TH>Champú / cosmética</TH><TH>Cuchilla / recalce</TH><TH>Notas</TH></TR></THead>
            <TBody>
              {dog.groomingRecords.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{r.performedAt.toLocaleDateString("es-ES")}</TD>
                  <TD>{r.groomer.displayName}</TD>
                  <TD>{r.servicesDone.join(", ")}</TD>
                  <TD>{[r.shampoo, r.conditioner].filter(Boolean).join(" + ")}</TD>
                  <TD>{[r.bladeNumber && `#${r.bladeNumber}`, r.combGuide].filter(Boolean).join(" · ")}</TD>
                  <TD className="max-w-xs text-muted-foreground">{[r.cutDescription, r.behaviorNotes].filter(Boolean).join(" — ")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {dog.groomingRecords.map((r) => r.photos.length > 0 && (
            <div key={r.id} className="mt-4">
              <p className="text-sm font-medium">{r.performedAt.toLocaleDateString("es-ES")}</p>
              <BeforeAfterGallery photos={r.photos} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
