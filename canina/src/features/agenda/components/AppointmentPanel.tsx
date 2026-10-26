"use client";

import Link from "next/link";
import { useTransition } from "react";
import { AlertTriangle, Phone, X } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentStatus, GroomingStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatHM } from "@/lib/time";
import { ALLOWED_TRANSITIONS, STAGE_LABEL, STATUS_META } from "../domain/status";
import { changeAppointmentStatus } from "../server/agenda.actions";
import type { AgendaAppointment } from "../server/agenda.queries";

const TEMPERAMENT: Record<string, string> = {
  DOCILE: "Dócil",
  NERVOUS: "Nervioso",
  FEARFUL: "Miedoso",
  REACTIVE: "Reactivo",
  AGGRESSIVE: "Agresivo",
};

/** Panel lateral con el detalle de la cita y los cambios de estado. */
export function AppointmentPanel({ appointment: a, onClose }: { appointment: AgendaAppointment; onClose: () => void }) {
  const [pending, start] = useTransition();

  function setStatus(status: AppointmentStatus, stage?: GroomingStage) {
    start(async () => {
      const res = await changeAppointmentStatus({ appointmentId: a.id, status, stage });
      if (res.ok) {
        toast.success(`Estado: ${STATUS_META[status].label}${stage ? ` · ${STAGE_LABEL[stage]}` : ""}`);
        onClose();
      } else toast.error(res.message);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{a.dog.name}</h2>
            <p className="text-sm text-muted-foreground">
              {a.dog.breed} · {formatHM(a.startMin)}–{formatHM(a.endMin)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>

        {a.dog.alerts.length > 0 && (
          <div className="mb-4 space-y-1 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {a.dog.alerts.map((h) => (
              <p key={h.id} className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4" /> {h.description}
              </p>
            ))}
          </div>
        )}

        <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Estado</dt>
          <dd><Badge variant="outline">{STATUS_META[a.status].label}{a.stage ? ` · ${STAGE_LABEL[a.stage]}` : ""}</Badge></dd>
          <dt className="text-muted-foreground">Temperamento</dt>
          <dd>{TEMPERAMENT[a.dog.temperament]}{a.dog.needsMuzzle ? " · usa bozal" : ""}</dd>
          <dt className="text-muted-foreground">Servicios</dt>
          <dd>{a.services.join(", ")}</dd>
          <dt className="text-muted-foreground">Propietario</dt>
          <dd>
            {a.ownerName}
            {a.ownerPhone && (
              <a className="ml-2 inline-flex items-center gap-1 text-primary" href={`tel:${a.ownerPhone}`}>
                <Phone className="size-3" /> {a.ownerPhone}
              </a>
            )}
          </dd>
        </dl>

        {a.status === "IN_PROGRESS" && (
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium">Fase actual</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STAGE_LABEL) as GroomingStage[]).map((st) => (
                <Button key={st} size="sm" variant={a.stage === st ? "default" : "outline"} disabled={pending} onClick={() => setStatus("IN_PROGRESS", st)}>
                  {STAGE_LABEL[st]}
                </Button>
              ))}
            </div>
          </div>
        )}

        <p className="mb-2 text-sm font-medium">Cambiar estado</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {ALLOWED_TRANSITIONS[a.status].map((to) => (
            <Button key={to} size="sm" variant={to === "CANCELLED" || to === "NO_SHOW" ? "outline" : "secondary"} disabled={pending} onClick={() => setStatus(to)}>
              {STATUS_META[to].label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link className="text-sm text-primary underline" href={`/admin/perros/${a.dog.id}`}>Ficha del perro</Link>
          {(a.status === "IN_PROGRESS" || a.status === "COMPLETED") && (
            <Link className="text-sm text-primary underline" href={`/admin/caja/${a.id}`}>Cobrar / facturar</Link>
          )}
        </div>
      </aside>
    </div>
  );
}
