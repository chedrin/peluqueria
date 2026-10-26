import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkRedemption } from "@/features/vouchers/domain/voucher-rules";
import { CheckoutLines } from "@/features/billing/components/CheckoutLines";

export const metadata = { title: "Caja" };

/** Paso de caja: aplicar bonos por servicio y generar factura/ticket. */
export default async function CheckoutPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      dog: true,
      owner: { include: { user: true, vouchers: { where: { status: "ACTIVE" }, include: { product: { include: { services: true } } } } } },
      services: { include: { service: true, redemptions: { where: { reversedAt: null }, include: { voucher: true } } } },
      invoices: { select: { id: true, status: true, fullNumber: true } },
    },
  });
  if (!appt) notFound();

  const lines = appt.services.map((l) => ({
    id: l.id,
    name: l.service.name,
    priceCents: l.priceCents,
    redeemedWith: l.redemptions[0] ? { code: l.redemptions[0].voucher.code, session: l.redemptions[0].sessionNumber } : null,
    // Bonos aplicables a esta línea según las reglas de dominio
    vouchers: appt.owner.vouchers
      .map((v) => ({
        v,
        check: checkRedemption(
          { id: v.id, ownerId: v.ownerId, dogId: v.dogId, status: v.status, totalSessions: v.totalSessions, usedSessions: v.usedSessions, expiresAt: v.expiresAt, productSize: v.product.size, allowedServiceIds: v.product.services.map((s) => s.serviceId) },
          { ownerId: appt.ownerId, dogId: appt.dogId, dogSize: appt.dog.size, serviceId: l.serviceId, serviceDate: appt.startsAt },
        ),
      }))
      .filter((x) => x.check.ok)
      .map(({ v }) => ({ id: v.id, label: `${v.product.name} · ${v.code} (${v.totalSessions - v.usedSessions} restantes)` })),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Caja · {appt.dog.name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{appt.owner.user.firstName} {appt.owner.user.lastName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {appt.startsAt.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" })} · NIF: {appt.owner.taxId ?? "—"}
          </p>
        </CardHeader>
        <CardContent>
          <CheckoutLines
            appointmentId={appt.id}
            lines={lines}
            hasTaxId={!!appt.owner.taxId}
            existingInvoices={appt.invoices}
          />
          <p className="mt-4 text-right text-lg font-semibold">Total: {formatCents(lines.reduce((s, l) => s + l.priceCents, 0))}</p>
        </CardContent>
      </Card>
    </div>
  );
}
