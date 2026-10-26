import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Facturación" };
const TYPE = { STANDARD: "Factura", SIMPLIFIED: "Ticket", RECTIFYING: "Rectificativa" } as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const invoices = await prisma.invoice.findMany({
    where: status ? { status: status as "DRAFT" } : undefined,
    orderBy: [{ issueDate: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    take: 200,
    include: { payments: { select: { amountCents: true, method: true } } },
  });
  const issued = invoices.filter((i) => i.status !== "DRAFT");
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Facturación</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/facturas" className="underline">Todas</Link>
          <Link href="/admin/facturas?status=DRAFT" className="underline">Borradores</Link>
          <Link href="/admin/facturas?status=ISSUED" className="underline">Emitidas</Link>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Base imponible: {formatCents(issued.reduce((s, i) => s + i.subtotalCents, 0))} · IVA: {formatCents(issued.reduce((s, i) => s + i.taxCents, 0))} · Total: {formatCents(issued.reduce((s, i) => s + i.totalCents, 0))}
      </p>
      <div className="rounded-xl border bg-card">
        <Table>
          <THead><TR><TH>Número</TH><TH>Tipo</TH><TH>Fecha</TH><TH>Cliente</TH><TH className="text-right">Total</TH><TH>Cobro</TH><TH>Estado</TH></TR></THead>
          <TBody>
            {invoices.map((i) => {
              const paid = i.payments.reduce((s, p) => s + p.amountCents, 0);
              return (
                <TR key={i.id}>
                  <TD><Link href={`/admin/facturas/${i.id}`} className="font-mono text-primary hover:underline">{i.fullNumber ?? "BORRADOR"}</Link></TD>
                  <TD>{TYPE[i.type]}</TD>
                  <TD>{i.issueDate?.toLocaleDateString("es-ES") ?? "—"}</TD>
                  <TD>{i.customerName ?? "Consumidor final"}</TD>
                  <TD className="text-right">{formatCents(i.totalCents)}</TD>
                  <TD>{i.status === "DRAFT" ? "—" : paid === i.totalCents ? <Badge variant="success">Cobrada</Badge> : <Badge variant="warning">Pendiente {formatCents(i.totalCents - paid)}</Badge>}</TD>
                  <TD><Badge variant={i.status === "ISSUED" ? "secondary" : "outline"}>{i.status === "DRAFT" ? "Borrador" : i.status === "ISSUED" ? "Emitida" : "Anulada"}</Badge></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
  );
}
