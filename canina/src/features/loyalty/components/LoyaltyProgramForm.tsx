"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { LoyaltyMode, LoyaltyProgram } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { saveLoyaltyProgramAction } from "../server/loyalty.actions";

export function LoyaltyProgramForm({ program, services }: { program: LoyaltyProgram | null; services: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const n = (fd: FormData, k: string) => Number(fd.get(k));
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      action={(fd) =>
        start(async () => {
          const r = await saveLoyaltyProgramAction({
            mode: fd.get("mode") as LoyaltyMode,
            isActive: fd.get("isActive") === "on",
            pointsPerEuro: n(fd, "pointsPerEuro"),
            centsPer100Points: n(fd, "centsPer100Points"),
            minPointsToRedeem: n(fd, "minPointsToRedeem"),
            stampsForReward: n(fd, "stampsForReward"),
            rewardServiceId: String(fd.get("rewardServiceId")) || null,
            pointsExpireAfterDays: fd.get("expire") ? n(fd, "expire") : null,
          });
          if (r.ok) toast.success("Reglas guardadas");
          else toast.error(r.message);
        })
      }
    >
      <div className="space-y-1"><Label>Modalidad</Label>
        <NativeSelect name="mode" defaultValue={program?.mode ?? "POINTS"}><option value="POINTS">Puntos por € gastado</option><option value="STAMPS">Sellos por visita</option></NativeSelect>
      </div>
      <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" name="isActive" defaultChecked={program?.isActive ?? true} /> Programa activo</label>
      <div className="space-y-1"><Label>Puntos por cada €</Label><Input name="pointsPerEuro" type="number" defaultValue={program?.pointsPerEuro ?? 1} /></div>
      <div className="space-y-1"><Label>Valor de 100 puntos (céntimos)</Label><Input name="centsPer100Points" type="number" defaultValue={program?.centsPer100Points ?? 500} /></div>
      <div className="space-y-1"><Label>Mínimo para canjear</Label><Input name="minPointsToRedeem" type="number" defaultValue={program?.minPointsToRedeem ?? 100} /></div>
      <div className="space-y-1"><Label>Caducidad de puntos (días)</Label><Input name="expire" type="number" defaultValue={program?.pointsExpireAfterDays ?? ""} placeholder="Sin caducidad" /></div>
      <div className="space-y-1"><Label>Sellos para premio</Label><Input name="stampsForReward" type="number" defaultValue={program?.stampsForReward ?? 10} /></div>
      <div className="space-y-1"><Label>Premio (servicio gratis)</Label>
        <NativeSelect name="rewardServiceId" defaultValue={program?.rewardServiceId ?? ""}><option value="">—</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect>
      </div>
      <div className="sm:col-span-2"><Button disabled={pending}>Guardar reglas</Button></div>
    </form>
  );
}
