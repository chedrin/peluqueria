"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CoatType, DogSize, Service, ServiceCategory, ServicePricing, TaxRate } from "@prisma/client";
import { formatCents, eurosToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { TAX_RATE_LABEL } from "@/features/billing/domain/tax";
import { COAT_LABEL, SIZE_LABEL } from "../domain/pricing";
import { deletePricingAction, upsertPricingAction, upsertServiceAction } from "../server/service.actions";

type Props = { service?: Service & { pricing: ServicePricing[] }; categories: ServiceCategory[] };

export function ServiceEditor({ service, categories }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const isNew = !service;

  if (!open)
    return isNew ? (
      <Button onClick={() => setOpen(true)}>+ Nuevo servicio</Button>
    ) : (
      <Card className="cursor-pointer hover:shadow-md" onClick={() => setOpen(true)}>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>{service.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatCents(service.basePriceCents)} · {service.baseDurationMin} min · {service.pricing.length} tarifas
            </p>
          </div>
          <div className="flex gap-2">
            {!service.isActive && <Badge variant="outline">Inactivo</Badge>}
            {service.bookableOnline && <Badge variant="secondary">Online</Badge>}
          </div>
        </CardHeader>
      </Card>
    );

  return (
    <Card>
      <CardContent className="space-y-6 pt-5">
        <form
          className="grid gap-3 sm:grid-cols-4"
          action={(fd) =>
            start(async () => {
              const r = await upsertServiceAction({
                id: service?.id,
                name: String(fd.get("name")),
                description: String(fd.get("description") || ""),
                categoryId: String(fd.get("categoryId") || ""),
                basePriceCents: eurosToCents(String(fd.get("price"))),
                baseDurationMin: Number(fd.get("duration")),
                bufferAfterMin: Number(fd.get("buffer")),
                taxRate: fd.get("taxRate") as TaxRate,
                bookableOnline: fd.get("online") === "on",
                isActive: fd.get("active") === "on",
              });
              if (r.ok) { toast.success("Servicio guardado"); if (isNew) setOpen(false); } else toast.error(r.message);
            })
          }
        >
          <div className="space-y-1 sm:col-span-2"><Label>Nombre</Label><Input name="name" defaultValue={service?.name} required /></div>
          <div className="space-y-1"><Label>Categoría</Label>
            <NativeSelect name="categoryId" defaultValue={service?.categoryId ?? ""}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
          </div>
          <div className="space-y-1"><Label>IVA</Label>
            <NativeSelect name="taxRate" defaultValue={service?.taxRate ?? "GENERAL_21"}>{Object.entries(TAX_RATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
          </div>
          <div className="space-y-1 sm:col-span-4"><Label>Descripción</Label><Input name="description" defaultValue={service?.description ?? ""} /></div>
          <div className="space-y-1"><Label>Precio base (€ IVA incl.)</Label><Input name="price" inputMode="decimal" defaultValue={service ? (service.basePriceCents / 100).toFixed(2) : ""} required /></div>
          <div className="space-y-1"><Label>Duración base (min)</Label><Input name="duration" type="number" defaultValue={service?.baseDurationMin ?? 60} /></div>
          <div className="space-y-1"><Label>Limpieza tras servicio (min)</Label><Input name="buffer" type="number" defaultValue={service?.bufferAfterMin ?? 0} /></div>
          <div className="flex items-end gap-4 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" name="online" defaultChecked={service?.bookableOnline ?? true} /> Reservable online</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={service?.isActive ?? true} /> Activo</label>
          </div>
          <div className="flex gap-2 sm:col-span-4">
            <Button disabled={pending}>Guardar</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cerrar</Button>
          </div>
        </form>

        {service && <PricingMatrix serviceId={service.id} rows={service.pricing} />}
      </CardContent>
    </Card>
  );
}

/** Matriz de tarifas: precio y duración por tamaño (y opcionalmente tipo de pelo). */
function PricingMatrix({ serviceId, rows }: { serviceId: string; rows: ServicePricing[] }) {
  const [pending, start] = useTransition();
  return (
    <div>
      <h4 className="mb-2 font-semibold">Tarifas por tamaño / pelo</h4>
      <div className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded border px-3 py-1.5">
            <span className="w-40">{r.size ? SIZE_LABEL[r.size] : "Cualquier tamaño"}</span>
            <span className="w-32">{r.coatType ? COAT_LABEL[r.coatType] : "Cualquier pelo"}</span>
            <span className="w-24 font-medium">{formatCents(r.priceCents)}</span>
            <span className="w-20">{r.durationMin} min</span>
            <Button size="icon" variant="ghost" disabled={pending} onClick={() => start(async () => { await deletePricingAction(r.id); })} aria-label="Eliminar">
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <form
        className="mt-3 grid gap-2 sm:grid-cols-5"
        action={(fd) =>
          start(async () => {
            const r = await upsertPricingAction({
              serviceId,
              size: (String(fd.get("size")) || null) as DogSize | null,
              coatType: (String(fd.get("coat")) || null) as CoatType | null,
              priceCents: eurosToCents(String(fd.get("price"))),
              durationMin: Number(fd.get("duration")),
            });
            if (!r.ok) toast.error(r.message);
          })
        }
      >
        <NativeSelect name="size"><option value="">Cualquier tamaño</option>{Object.entries(SIZE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
        <NativeSelect name="coat"><option value="">Cualquier pelo</option>{Object.entries(COAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
        <Input name="price" placeholder="Precio €" inputMode="decimal" required />
        <Input name="duration" type="number" placeholder="Minutos" required />
        <Button variant="secondary" disabled={pending}>Añadir / actualizar</Button>
      </form>
    </div>
  );
}
