import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerForm } from "@/features/owners/components/OwnerForm";
import { STATUS_META } from "@/features/agenda/domain/status";

export default async function OwnerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await prisma.ownerProfile.findUnique({
    where: { id },
    include: {
      user: { include: { consents: { orderBy: { createdAt: "desc" } } } },
      dogs: { include: { breed: true, healthAlerts: { where: { isActive: true } } } },
      appointments: { orderBy: { startsAt: "desc" }, take: 20, include: { dog: true, services: { include: { service: true } } } },
      invoices: { where: { status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" }, take: 20 },
      vouchers: { include: { product: true } },
      loyaltyCard: true,
    },
  });
  if (!o) notFound();
  const staff = await prisma.staffProfile.findMany({ select: { id: true, displayName: true } });
  const spent = o.invoices.filter((i) => i.status === "ISSUED").reduce((s, i) => s + i.totalCents, 0);
  // Último estado de cada consentimiento
  const consents = new Map<string, boolean>();
  for (const c of o.user.consents) if (!consents.has(c.purpose)) consents.set(c.purpose, c.granted);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{o.user.firstName} {o.user.lastName}</h1>
          <p className="text-muted-foreground">{o.user.email} · cliente desde {o.user.createdAt.toLocaleDateString("es-ES")}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">Gastado {formatCents(spent)}</Badge>
          <Badge variant="secondary">{o.loyaltyCard?.pointsBalance ?? 0} pts · {o.loyaltyCard?.stampsBalance ?? 0} sellos</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Datos y preferencias</CardTitle></CardHeader>
          <CardContent><OwnerForm owner={{ ...o, phone: o.user.phone }} staff={staff} /></CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Perros</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {o.dogs.map((d) => (
                <Link key={d.id} href={`/admin/perros/${d.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                  <span><strong>{d.name}</strong> <span className="text-sm text-muted-foreground">{d.breed?.name ?? d.breedText}</span></span>
                  {d.healthAlerts.length > 0 && <Badge variant="destructive">{d.healthAlerts.length} alerta(s)</Badge>}
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Consentimientos RGPD</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[...consents].map(([k, v]) => <Badge key={k} variant={v ? "success" : "outline"}>{k}: {v ? "sí" : "no"}</Badge>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Bonos</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {o.vouchers.map((v) => <p key={v.id}>{v.product.name} · {v.code} · {v.totalSessions - v.usedSessions}/{v.totalSessions} · {v.status}</p>)}
              {o.vouchers.length === 0 && <p className="text-muted-foreground">Sin bonos.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Historial de citas</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {o.appointments.map((a) => (
              <p key={a.id} className="flex justify-between gap-2">
                <span>{a.startsAt.toLocaleDateString("es-ES")} · {a.dog.name} · {a.services.map((s) => s.service.name).join(", ")}</span>
                <Badge variant="outline">{STATUS_META[a.status].label}</Badge>
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Compras / facturas</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {o.invoices.map((i) => (
              <Link key={i.id} href={`/admin/facturas/${i.id}`} className="flex justify-between hover:underline">
                <span>{i.fullNumber} · {i.issueDate?.toLocaleDateString("es-ES")}</span><span>{formatCents(i.totalCents)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
