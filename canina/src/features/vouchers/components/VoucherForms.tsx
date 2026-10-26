"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { DogSize } from "@prisma/client";
import { eurosToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { SIZE_LABEL } from "@/features/catalog/domain/pricing";
import { createVoucherProductAction, sellVoucherAction } from "../server/voucher.actions";

export function VoucherProductForm({ services }: { services: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">+ Nuevo tipo de bono</summary>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-2"
        action={(fd) =>
          start(async () => {
            const r = await createVoucherProductAction({
              name: String(fd.get("name")),
              description: String(fd.get("description") || "") || undefined,
              priceCents: eurosToCents(String(fd.get("price"))),
              totalSessions: Number(fd.get("sessions")),
              validityDays: Number(fd.get("validity")),
              size: (String(fd.get("size")) || null) as DogSize | null,
              serviceIds: fd.getAll("serviceIds").map(String),
            });
            if (r.ok) toast.success("Bono creado");
            else toast.error(r.message);
          })
        }
      >
        <div className="space-y-1 sm:col-span-2"><Label>Nombre</Label><Input name="name" placeholder="Bono 5 Baños + 1 Gratis" required /></div>
        <div className="space-y-1"><Label>Precio (€ IVA incl.)</Label><Input name="price" inputMode="decimal" required /></div>
        <div className="space-y-1"><Label>Sesiones totales</Label><Input name="sessions" type="number" defaultValue={6} /></div>
        <div className="space-y-1"><Label>Validez (días)</Label><Input name="validity" type="number" defaultValue={365} /></div>
        <div className="space-y-1"><Label>Tamaño</Label>
          <NativeSelect name="size"><option value="">Cualquiera</option>{Object.entries(SIZE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
        </div>
        <fieldset className="space-y-1 sm:col-span-2">
          <Label>Servicios incluidos</Label>
          <div className="grid grid-cols-2 gap-1 text-sm">
            {services.map((s) => <label key={s.id} className="flex items-center gap-1"><input type="checkbox" name="serviceIds" value={s.id} /> {s.name}</label>)}
          </div>
        </fieldset>
        <Input name="description" placeholder="Descripción (opcional)" className="sm:col-span-2" />
        <Button disabled={pending} className="sm:col-span-2">Crear bono</Button>
      </form>
    </details>
  );
}

export function SellVoucherForm({ products, owners }: { products: { id: string; name: string }[]; owners: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      action={(fd) =>
        start(async () => {
          const r = await sellVoucherAction({ productId: String(fd.get("productId")), ownerId: String(fd.get("ownerId")) });
          if (!r.ok) return void toast.error(r.message);
          toast.success("Bono vendido. Emite y cobra la factura.");
          router.push(`/admin/facturas/${r.data.invoiceId}`);
        })
      }
    >
      <div className="space-y-1"><Label>Cliente</Label><NativeSelect name="ownerId" required>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</NativeSelect></div>
      <div className="space-y-1"><Label>Bono</Label><NativeSelect name="productId" required>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></div>
      <Button disabled={pending}>Vender y facturar</Button>
    </form>
  );
}
