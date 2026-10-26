"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ticket, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="space-y-3">
      {p.lines.map((l) => (
        <div key={l.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{l.name}</p>
            {l.redeemedWith ? (
              <Badge variant="success"><Ticket className="size-3" /> Bono {l.redeemedWith.code} · sesión {l.redeemedWith.session}</Badge>
            ) : (
              <p className="text-sm text-muted-foreground">{formatCents(l.priceCents)}</p>
            )}
          </div>
          {l.redeemedWith ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => reverseVoucherAction(l.id), "Sesión devuelta al bono")}>
              <Undo2 /> Revertir
            </Button>
          ) : l.vouchers.length > 0 ? (
            <div className="flex gap-2">
              <NativeSelect className="w-64" value={chosen[l.id] ?? l.vouchers[0].id} onChange={(e) => setChosen((c) => ({ ...c, [l.id]: e.target.value }))}>
                {l.vouchers.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </NativeSelect>
              <Button size="sm" variant="secondary" disabled={pending}
                onClick={() => run(() => redeemVoucherAction(chosen[l.id] ?? l.vouchers[0].id, l.id), "Sesión de bono consumida")}>
                Usar bono
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sin bonos aplicables</span>
          )}
        </div>
      ))}

      {p.existingInvoices.length > 0 && (
        <p className="text-sm">
          Documentos: {p.existingInvoices.map((i) => (
            <Link key={i.id} href={`/admin/facturas/${i.id}`} className="mr-2 text-primary underline">{i.fullNumber ?? "Borrador"}</Link>
          ))}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {(["SIMPLIFIED", "STANDARD"] as const).map((t) => (
          <Button key={t} variant={t === "SIMPLIFIED" ? "default" : "outline"} disabled={pending || (t === "STANDARD" && !p.hasTaxId)}
            title={t === "STANDARD" && !p.hasTaxId ? "El cliente no tiene NIF: complétalo en su ficha" : undefined}
            onClick={() => start(async () => {
              const r = await createInvoiceFromAppointmentAction(p.appointmentId, t);
              if (!r.ok) return void toast.error(r.message);
              router.push(`/admin/facturas/${r.data.id}`);
            })}>
            {t === "SIMPLIFIED" ? "Generar ticket (factura simplificada)" : "Generar factura completa"}
          </Button>
        ))}
      </div>
    </div>
  );
}
