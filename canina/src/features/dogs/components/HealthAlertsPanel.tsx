"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { AlertSeverity, HealthAlertType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { HEALTH_ALERT_LABEL } from "../domain/labels";
import { addHealthAlertAction, deactivateHealthAlertAction } from "../server/dog.actions";

const TYPES = HEALTH_ALERT_LABEL;

export function HealthAlertsPanel({ dogId, alerts }: { dogId: string; alerts: { id: string; type: HealthAlertType; severity: AlertSeverity; description: string; isActive: boolean }[] }) {
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader><CardTitle>Salud y alertas</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((a) => (
          <div key={a.id} className={cn("flex items-start justify-between gap-2 rounded-md border p-2 text-sm", a.isActive ? "border-red-300 bg-red-50" : "opacity-50")}>
            <span><strong>{TYPES[a.type]}</strong> · {a.description}</span>
            {a.isActive && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await deactivateHealthAlertAction(a.id); if (!r.ok) toast.error(r.message); })}>
                Resolver
              </Button>
            )}
          </div>
        ))}
        <form
          className="grid gap-2"
          action={(fd) =>
            start(async () => {
              const r = await addHealthAlertAction({
                dogId, type: fd.get("type") as HealthAlertType, severity: fd.get("severity") as AlertSeverity,
                description: String(fd.get("description")), bodyArea: String(fd.get("bodyArea") || "") || undefined, validUntil: String(fd.get("validUntil") || "") || undefined,
              });
              if (r.ok) toast.success("Alerta añadida");
              else toast.error(r.message);
            })
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <NativeSelect name="type">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
            <NativeSelect name="severity" defaultValue="WARNING"><option value="INFO">Info</option><option value="WARNING">Aviso</option><option value="CRITICAL">Crítica</option></NativeSelect>
          </div>
          <Input name="description" placeholder="Descripción (p. ej. alérgico a la clorhexidina)" required />
          <div className="grid grid-cols-2 gap-2">
            <Input name="bodyArea" placeholder="Zona (opcional)" />
            <Input name="validUntil" type="date" title="Válida hasta (opcional)" />
          </div>
          <Button size="sm" disabled={pending}>Añadir alerta</Button>
        </form>
      </CardContent>
    </Card>
  );
}
