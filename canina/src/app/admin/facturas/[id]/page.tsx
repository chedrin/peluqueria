import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { calculateInvoice } from "@/features/billing/domain/calculator";
import { validateInvoice } from "@/features/billing/domain/validation";
import { TAX_RATE_LABEL } from "@/features/billing/domain/tax";
import type { TaxBreakdownRow } from "@/features/billing/domain/calculator";
import { InvoiceActions } from "@/features/billing/components/InvoiceActions";

const TYPE = { STANDARD: "Factura", SIMPLIFIED: "Factura simplificada", RECTIFYING: "Factura rectificativa" } as const;
const METHOD = { CASH: "Efectivo", CARD: "Tarjeta", BIZUM: "Bizum", VOUCHER: "Bono", TRANSFER: "Transferencia" } as const;

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } }, payments: { orderBy: { receivedAt: "asc" } }, rectifies: true, rectifiedBy: true, owner: { include: { loyaltyCard: true } } },
  });
  if (!inv) notFound();
  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });

  // Validación fiscal en vivo para borradores (misma función que usa la emisión)
  const issues =
    inv.status === "DRAFT"
      ? validateInvoice({
          type: inv.type,
          calc: calculateInvoice(
            inv.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPriceCents: i.unitPriceCents, discountBp: i.discountBp, taxRate: i.taxRate, exemptionCause: i.exemptionCause ?? undefined })),
            { pricesIncludeTax: inv.pricesIncludeTax, withholdingBp: inv.withholdingRate },
          ),
          issuer: { name: inv.issuerName, taxId: inv.issuerTaxId, address: inv.issuerAddress },
          customer: { name: inv.customerName, taxId: inv.customerTaxId, address: inv.customerAddress },
          rectifies: inv.rectifiesId ? { id: inv.rectifiesId, reason: inv.rectifyReason ?? "" } : null,
          simplifiedLimitCents: settings?.simplifiedInvoiceLimit,
        })
      : [];
  const paid = inv.payments.reduce((s, p) => s + p.amountCents, 0);
  const breakdown = (inv.taxBreakdown ?? []) as TaxBreakdownRow[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{TYPE[inv.type]} {inv.fullNumber ?? "(borrador)"}</h1>
          <p className="text-sm text-muted-foreground">
            {inv.issueDate ? `Emitida el ${inv.issueDate.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}` : "Sin número hasta su emisión"}
            {inv.rectifies && <> · Rectifica <Link className="underline" href={`/admin/facturas/${inv.rectifies.id}`}>{inv.rectifies.fullNumber}</Link></>}
            {inv.rectifiedBy.map((r) => <span key={r.id}> · Rectificada por <Link className="underline" href={`/admin/facturas/${r.id}`}>{r.fullNumber ?? "borrador"}</Link></span>)}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={inv.status === "ISSUED" ? "secondary" : "outline"}>{{ DRAFT: "Borrador", ISSUED: "Emitida", VOIDED: "Anulada" }[inv.status]}</Badge>
          {inv.status !== "DRAFT" && <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" className={buttonVariants({ variant: "outline", size: "sm" })}>Descargar PDF</a>}
        </div>
      </div>

      {issues.length > 0 && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">No se puede emitir todavía:</p>
          <ul className="list-inside list-disc">{issues.map((i) => <li key={i.field}>{i.message}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Emisor</CardTitle></CardHeader>
          <CardContent className="text-sm">{inv.issuerName}<br />NIF {inv.issuerTaxId}<br />{inv.issuerAddress}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Destinatario</CardTitle></CardHeader>
          <CardContent className="text-sm">{inv.customerName ?? "Consumidor final"}<br />{inv.customerTaxId && <>NIF {inv.customerTaxId}<br /></>}{inv.customerAddress}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead><TR><TH>Concepto</TH><TH className="text-right">Cant.</TH><TH className="text-right">Precio s/IVA</TH><TH>IVA</TH><TH className="text-right">Base</TH><TH className="text-right">Total</TH></TR></THead>
            <TBody>
              {inv.items.map((i) => (
                <TR key={i.id}>
                  <TD>{i.description}{i.exemptionCause && <span className="block text-xs text-muted-foreground">{i.exemptionCause}</span>}</TD>
                  <TD className="text-right">{Number(i.quantity)}</TD>
                  <TD className="text-right">{formatCents(i.netUnitPriceCents)}</TD>
                  <TD>{TAX_RATE_LABEL[i.taxRate]}</TD>
                  <TD className="text-right">{formatCents(i.baseCents)}</TD>
                  <TD className="text-right">{formatCents(i.totalCents)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
            {breakdown.map((b) => (
              <p key={b.taxRate} className="flex justify-between text-muted-foreground">
                <span>Base {TAX_RATE_LABEL[b.taxRate]}: {formatCents(b.baseCents)}</span><span>Cuota {formatCents(b.taxCents)}</span>
              </p>
            ))}
            <p className="flex justify-between"><span>Base imponible</span><span>{formatCents(inv.subtotalCents)}</span></p>
            <p className="flex justify-between"><span>IVA</span><span>{formatCents(inv.taxCents)}</span></p>
            {inv.withholdingCents > 0 && <p className="flex justify-between"><span>Retención IRPF {inv.withholdingRate / 100}%</span><span>-{formatCents(inv.withholdingCents)}</span></p>}
            <p className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span>{formatCents(inv.totalCents)}</span></p>
          </div>
        </CardContent>
      </Card>

      {inv.status !== "DRAFT" && (
        <Card>
          <CardHeader><CardTitle>Cobros · pendiente {formatCents(inv.totalCents - paid)}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {inv.payments.map((p) => (
              <p key={p.id} className="flex justify-between">
                <span>{p.receivedAt.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} · {METHOD[p.method]}{p.reference ? ` (${p.reference})` : ""}</span>
                <span>{formatCents(p.amountCents)}</span>
              </p>
            ))}
            {inv.hash && <p className="break-all pt-3 font-mono text-[11px] text-muted-foreground">Huella: {inv.hash}<br />Anterior: {inv.previousHash ?? "— (primer registro)"}</p>}
          </CardContent>
        </Card>
      )}

      <InvoiceActions
        invoice={{ id: inv.id, status: inv.status, type: inv.type, pendingCents: inv.totalCents - paid, withholdingRate: inv.withholdingRate }}
        canIssue={issues.length === 0}
        loyaltyPoints={inv.owner?.loyaltyCard?.pointsBalance ?? 0}
      />
    </div>
  );
}
