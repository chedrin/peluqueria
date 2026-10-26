"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { InvoiceStatus, InvoiceType, PaymentMethod } from "@prisma/client";
import { eurosToCents, formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { WITHHOLDING_BP } from "../domain/tax";
import { issueInvoiceAction, rectifyInvoiceAction, redeemPointsOnDraftAction, registerPaymentAction, updateDraftAction } from "../server/billing.actions";

type Props = {
  invoice: { id: string; status: InvoiceStatus; type: InvoiceType; pendingCents: number; withholdingRate: number };
  canIssue: boolean;
  loyaltyPoints: number;
};

export function InvoiceActions({ invoice: inv, canIssue, loyaltyPoints }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<PaymentMethod>("CARD");
  const [amount, setAmount] = useState((inv.pendingCents / 100).toFixed(2));

  const act = <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; message: string; details?: unknown }>, msg: (d: T) => string, after?: (d: T) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        const details = Array.isArray(r.details) ? `: ${(r.details as { message: string }[]).map((d) => d.message).join(" ")}` : "";
        return void toast.error(r.message + details);
      }
      toast.success(msg(r.data));
      after?.(r.data);
      router.refresh();
    });

  if (inv.status === "DRAFT")
    return (
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          {inv.type !== "RECTIFYING" && (
            <div className="space-y-1">
              <Label>Tipo de documento</Label>
              <NativeSelect value={inv.type} disabled={pending}
                onChange={(e) => act(() => updateDraftAction(inv.id, { type: e.target.value as "STANDARD" }), () => "Tipo actualizado")}>
                <option value="SIMPLIFIED">Factura simplificada (ticket)</option>
                <option value="STANDARD">Factura completa</option>
              </NativeSelect>
            </div>
          )}
          {inv.type === "STANDARD" && (
            <div className="space-y-1">
              <Label>Retención IRPF</Label>
              <NativeSelect value={inv.withholdingRate} disabled={pending}
                onChange={(e) => act(() => updateDraftAction(inv.id, { withholdingBp: Number(e.target.value) }), () => "Retención actualizada")}>
                <option value={WITHHOLDING_BP.NONE}>Sin retención</option>
                <option value={WITHHOLDING_BP.PROFESSIONAL_15}>15 %</option>
                <option value={WITHHOLDING_BP.PROFESSIONAL_NEW_7}>7 %</option>
              </NativeSelect>
            </div>
          )}
          {loyaltyPoints > 0 && (
            <Button variant="outline" disabled={pending}
              onClick={() => act(() => redeemPointsOnDraftAction(inv.id, loyaltyPoints), (d) => `Descuento aplicado: ${formatCents(d.discountCents)}`)}>
              Canjear {loyaltyPoints} puntos
            </Button>
          )}
          <Button className="ml-auto" disabled={pending || !canIssue}
            onClick={() => confirm("Una vez emitida la factura no se puede modificar. ¿Emitir?") && act(() => issueInvoiceAction(inv.id), (d) => `Emitida ${d.fullNumber}`)}>
            Emitir (asignar número)
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 pt-5">
        {inv.pendingCents !== 0 && (
          <>
            <div className="space-y-1">
              <Label>Forma de pago</Label>
              <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <option value="CARD">Tarjeta</option><option value="CASH">Efectivo</option><option value="BIZUM">Bizum</option><option value="TRANSFER">Transferencia</option>
              </NativeSelect>
            </div>
            <div className="space-y-1"><Label>Importe €</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" inputMode="decimal" /></div>
            <Button disabled={pending}
              onClick={() => act(() => registerPaymentAction({ invoiceId: inv.id, method: method as "CARD", amountCents: eurosToCents(amount) }), () => "Cobro registrado")}>
              Registrar cobro
            </Button>
          </>
        )}
        {inv.status === "ISSUED" && inv.type !== "RECTIFYING" && (
          <Button variant="outline" className="ml-auto" disabled={pending}
            onClick={() => {
              const reason = prompt("Motivo de la rectificación (art. 15 RD 1619/2012):");
              if (reason) act(() => rectifyInvoiceAction(inv.id, reason), () => "Borrador de rectificativa creado", (d) => router.push(`/admin/facturas/${d.id}`));
            }}>
            Rectificar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
