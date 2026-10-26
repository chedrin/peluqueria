import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoucherProductForm, SellVoucherForm } from "@/features/vouchers/components/VoucherForms";

export const metadata = { title: "Bonos" };

export default async function VouchersPage() {
  const [products, services, owners, sold] = await Promise.all([
    prisma.voucherProduct.findMany({ include: { services: { include: { service: true } }, _count: { select: { vouchers: true } } }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.ownerProfile.findMany({ select: { id: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { user: { lastName: "asc" } } }),
    prisma.voucher.findMany({ include: { product: true, owner: { include: { user: true } } }, orderBy: { purchasedAt: "desc" }, take: 50 }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bonos de servicios</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tipos de bono</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {products.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 text-sm">
                <p className="flex justify-between font-medium"><span>{p.name}</span><span>{formatCents(p.priceCents)}</span></p>
                <p className="text-muted-foreground">
                  {p.totalSessions} sesiones · {p.validityDays} días · {p.services.map((s) => s.service.name).join(", ")} · {p._count.vouchers} vendidos
                </p>
                {!p.isActive && <Badge variant="outline">Inactivo</Badge>}
              </div>
            ))}
            <VoucherProductForm services={services} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Vender bono</CardTitle></CardHeader>
          <CardContent>
            <SellVoucherForm
              products={products.filter((p) => p.isActive).map((p) => ({ id: p.id, name: `${p.name} · ${formatCents(p.priceCents)}` }))}
              owners={owners.map((o) => ({ id: o.id, name: `${o.user.lastName}, ${o.user.firstName}` }))}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Bonos vendidos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <THead><TR><TH>Código</TH><TH>Cliente</TH><TH>Bono</TH><TH>Sesiones</TH><TH>Caduca</TH><TH>Estado</TH><TH>Venta</TH></TR></THead>
            <TBody>
              {sold.map((v) => (
                <TR key={v.id}>
                  <TD className="font-mono">{v.code}</TD>
                  <TD>{v.owner.user.firstName} {v.owner.user.lastName}</TD>
                  <TD>{v.product.name}</TD>
                  <TD>{v.usedSessions}/{v.totalSessions}</TD>
                  <TD>{v.expiresAt.toLocaleDateString("es-ES")}</TD>
                  <TD><Badge variant={v.status === "ACTIVE" ? "success" : "outline"}>{v.status}</Badge></TD>
                  <TD>{v.saleInvoiceId && <Link className="text-primary underline" href={`/admin/facturas/${v.saleInvoiceId}`}>Factura</Link>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
