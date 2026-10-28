"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ticket, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { redeemVoucherAction, reverseVoucherAction } from "@/features/vouchers/server/voucher.actions";
import { createInvoiceFromAppointmentAction } from "../server/billing.actions";

type Line = {
  id: string;
  name: string;
  priceCents: number;
  redeemedWith: { code: string; session: number } | null;
  vouchers: { id: string; label: string }[];
};

export function CheckoutLines(p: { appointmentId: string; lines: Line[]; hasTaxId: boolean; existingInvoices: { id: string; status: string; fullNumber: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { toast.success(ok); router.refresh(); } else toast.error(r.message);
    });

  // Al consumir un bono la línea ya queda a 0 €, así que el total es directamente lo que se cobra
  const total = p.lines.reduce((sum, l) => sum + l.priceCents, 0);
  const withVoucher = p.lines.filter((l) => l.redeemedWith).length;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        {p.lines.map((l) => (
          <div key={l.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{l.name}</p>
              {l.redeemedWith ? (
                <p className="text-right"><span className="block text-xs text-muted-foreground">Incluido en bono</span><strong className="text-primary">{formatCents(l.priceCents)}</strong></p>
              ) : (
                <strong>{formatCents(l.priceCents)}</strong>
              )}
            </div>
            {l.redeemedWith ? (
              <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                <Ticket className="size-4" aria-hidden />
                <span className="flex-1">Bono {l.redeemedWith.code} · sesión {l.redeemedWith.session}</span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => reverseVoucherAction(l.id), "Sesión devuelta al bono")}>
                  <Undo2 /> Revertir
                </Button>
              </div>
            ) : l.vouchers.length === 1 ? (
              <button type="button" disabled={pending}
                onClick={() => run(() => redeemVoucherAction(l.vouchers[0].id, l.id), "Sesión de bono consumida")}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary disabled:opacity-50">
                <Ticket className="size-4 text-primary" aria-hidden />
                <span className="flex-1">{l.vouchers[0].label}</span>
                <span className="font-semibold text-primary">Aplicar</span>
              </button>
            ) : l.vouchers.length > 1 ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <NativeSelect aria-label={`Bono para ${l.name}`} value={chosen[l.id] ?? l.vouchers[0].id} onChange={(e) => setChosen((c) => ({ ...c, [l.id]: e.target.value }))}>
                  {l.vouchers.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </NativeSelect>
                <Button variant="secondary" disabled={pending}
                  onClick={() => run(() => redeemVoucherAction(chosen[l.id] ?? l.vouchers[0].id, l.id), "Sesión de bono consumida")}>
                  <Ticket /> Aplicar bono
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin bonos aplicables</p>
            )}
          </div>
        ))}
      </div>

      <aside className="space-y-4 rounded-xl border bg-card p-5 shadow-sm lg:sticky lg:top-6">
        <h2 className="font-semibold">Resumen</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Servicios</dt><dd>{p.lines.length}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Pagados con bono</dt><dd>{withVoucher}</dd></div>
        </dl>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="font-semibold">A cobrar</span>
          <strong className="text-3xl font-bold tracking-tight">{formatCents(total)}</strong>
        </div>
        <p className="text-xs text-muted-foreground">Impuestos incluidos. La forma de pago se elige al emitir el documento.</p>

        <div className="flex flex-col gap-2">
          {(["SIMPLIFIED", "STANDARD"] as const).map((t) => (
            <Button key={t} size={t === "SIMPLIFIED" ? "lg" : "default"} variant={t === "SIMPLIFIED" ? "default" : "outline"} className="w-full"
              disabled={pending || (t === "STANDARD" && !p.hasTaxId)}
              title={t === "STANDARD" && !p.hasTaxId ? "El cliente no tiene NIF: complétalo en su ficha" : undefined}
              onClick={() => start(async () => {
                const r = await createInvoiceFromAppointmentAction(p.appointmentId, t);
                if (!r.ok) return void toast.error(r.message);
                router.push(`/admin/facturas/${r.data.id}`);
              })}>
              {t === "SIMPLIFIED" ? "Generar ticket (factura simplificada)" : "Generar factura completa"}
            </Button>
          ))}
          {!p.hasTaxId && <p className="text-xs text-muted-foreground">Para la factura completa falta el NIF del cliente.</p>}
        </div>

        {p.existingInvoices.length > 0 && (
          <p className="border-t pt-3 text-sm">
            Documentos: {p.existingInvoices.map((i) => (
              <Link key={i.id} href={`/admin/facturas/${i.id}`} className="mr-2 text-primary underline">{i.fullNumber ?? "Borrador"}</Link>
            ))}
          </p>
        )}
      </aside>
    </div>
  );
}
