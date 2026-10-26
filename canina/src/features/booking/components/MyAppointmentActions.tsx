"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { availabilityAction, cancelMyAppointmentAction, rescheduleMyAppointmentAction } from "../server/booking.actions";

/** Cancelar / reprogramar según la política de antelación configurada. */
export function MyAppointmentActions(p: { appointmentId: string; canModify: boolean; dogId: string; serviceIds: string[]; currentDay: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(p.currentDay);
  const [slots, setSlots] = useState<{ staffId: string; start: number; label: string }[]>([]);

  if (!p.canModify) return <span className="text-xs text-muted-foreground">Para cambios, llámanos</span>;

  const load = (d: string) =>
    start(async () => {
      setDay(d);
      const r = await availabilityAction({ day: d, dogId: p.dogId, serviceIds: p.serviceIds });
      if (r.ok) setSlots(r.data.slots);
      else toast.error(r.message);
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setOpen((o) => !o); if (!open) load(day); }}>Reprogramar</Button>
        <Button size="sm" variant="ghost" disabled={pending}
          onClick={() => confirm("¿Cancelar esta cita?") && start(async () => {
            const r = await cancelMyAppointmentAction(p.appointmentId);
            if (r.ok) toast.success("Cita cancelada");
            else toast.error(r.message);
          })}>
          Cancelar
        </Button>
      </div>
      {open && (
        <div className="w-full max-w-xs space-y-2 rounded-lg border p-3">
          <Input type="date" value={day} onChange={(e) => load(e.target.value)} />
          <div className="grid grid-cols-4 gap-1">
            {slots.map((s) => (
              <Button key={`${s.staffId}${s.start}`} size="sm" variant="outline" disabled={pending}
                onClick={() => start(async () => {
                  const r = await rescheduleMyAppointmentAction({ appointmentId: p.appointmentId, day, startMin: s.start, staffId: s.staffId });
                  if (r.ok) { toast.success(`Cita movida a las ${s.label}`); setOpen(false); } else toast.error(r.message);
                })}>
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
