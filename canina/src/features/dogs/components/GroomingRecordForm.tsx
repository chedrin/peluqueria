"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { CoatCondition } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { saveGroomingRecordAction } from "../server/dog.actions";

/**
 * Registro técnico post-servicio. Las fotos se indican por URL: conecta aquí tu
 * almacenamiento (S3/R2/Supabase Storage) con un endpoint de subida firmado.
 */
export function GroomingRecordForm({ dogId, appointmentId, defaultServices }: { dogId: string; appointmentId?: string; defaultServices: string[] }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-4"
      action={(fd) =>
        start(async () => {
          const s = (k: string) => String(fd.get(k) || "") || undefined;
          const photos = (["BEFORE", "AFTER"] as const).flatMap((kind) => (s(kind) ? [{ kind, url: s(kind)! }] : []));
          const r = await saveGroomingRecordAction({
            dogId, appointmentId,
            servicesDone: String(fd.get("services")).split(",").map((x) => x.trim()).filter(Boolean),
            shampoo: s("shampoo"), conditioner: s("conditioner"), bladeNumber: s("blade"), combGuide: s("comb"),
            cutDescription: s("cut"), coatCondition: s("coat") as CoatCondition | undefined,
            weightKg: s("weight") ? Number(s("weight")) : undefined, behaviorNotes: s("behavior"), photos,
          });
          if (r.ok) toast.success("Sesión registrada en el historial");
          else toast.error(r.message);
        })
      }
    >
      <div className="space-y-1 sm:col-span-2"><Label>Servicios realizados</Label><Input name="services" defaultValue={defaultServices.join(", ")} /></div>
      <div className="space-y-1"><Label>Peso hoy (kg)</Label><Input name="weight" type="number" step="0.1" /></div>
      <div className="space-y-1"><Label>Estado del manto</Label>
        <NativeSelect name="coat" defaultValue=""><option value="">—</option><option value="GOOD">Bueno</option><option value="KNOTS">Nudos</option><option value="MATTED">Enredos severos</option><option value="SHEDDING">En muda</option></NativeSelect>
      </div>
      <div className="space-y-1"><Label>Champú</Label><Input name="shampoo" placeholder="Ej.: hipoalergénico avena" /></div>
      <div className="space-y-1"><Label>Acondicionador / otros</Label><Input name="conditioner" /></div>
      <div className="space-y-1"><Label>Nº cuchilla</Label><Input name="blade" placeholder="7F, 10, 30…" /></div>
      <div className="space-y-1"><Label>Recalce / peine guía</Label><Input name="comb" placeholder="13 mm" /></div>
      <div className="space-y-1 sm:col-span-2"><Label>Descripción del corte</Label><Input name="cut" /></div>
      <div className="space-y-1 sm:col-span-2"><Label>Comportamiento hoy</Label><Input name="behavior" /></div>
      <div className="space-y-1 sm:col-span-2"><Label>Foto ANTES (URL)</Label><Input name="BEFORE" type="url" /></div>
      <div className="space-y-1 sm:col-span-2"><Label>Foto DESPUÉS (URL)</Label><Input name="AFTER" type="url" /></div>
      <div className="sm:col-span-4"><Button disabled={pending}>Guardar sesión</Button></div>
    </form>
  );
}
