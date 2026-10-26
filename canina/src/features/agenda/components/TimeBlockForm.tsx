"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { createTimeBlock } from "../server/agenda.actions";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Bloqueo de franjas (descanso, baja, incidencia). Avisa de las citas afectadas para reubicarlas. */
export function TimeBlockForm({ staff, day }: { staff: { id: string; displayName: string }[]; day: string }) {
  const [pending, start] = useTransition();
  return (
    <details className="mt-4 rounded-xl border bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium">Bloquear franja (descanso, baja, incidencia)</summary>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-6"
        action={(fd) =>
          start(async () => {
            const r = await createTimeBlock({
              staffId: String(fd.get("staffId")) || null,
              type: fd.get("type") as "BREAK",
              day: String(fd.get("day")),
              untilDay: String(fd.get("untilDay")) || undefined,
              startMin: toMin(String(fd.get("from"))),
              endMin: toMin(String(fd.get("to"))),
              reason: String(fd.get("reason") || "") || undefined,
            });
            if (!r.ok) return void toast.error(r.message);
            if (r.data.affected.length)
              toast.warning(`Bloqueo creado. ${r.data.affected.length} cita(s) afectada(s): ${r.data.affected.map((a) => a.dog.name).join(", ")}. Arrástralas a otro peluquero.`, { duration: 10000 });
            else toast.success("Franja bloqueada");
          })
        }
      >
        <div className="space-y-1"><Label>Peluquero</Label>
          <NativeSelect name="staffId"><option value="">Todo el salón</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}</NativeSelect>
        </div>
        <div className="space-y-1"><Label>Tipo</Label>
          <NativeSelect name="type">
            <option value="BREAK">Descanso</option><option value="SICK_LEAVE">Baja</option><option value="HOLIDAY">Vacaciones</option><option value="INCIDENT">Incidencia</option><option value="TRAINING">Formación</option>
          </NativeSelect>
        </div>
        <div className="space-y-1"><Label>Desde</Label><Input type="date" name="day" defaultValue={day} /><Input type="time" name="from" defaultValue="14:00" step={900} /></div>
        <div className="space-y-1"><Label>Hasta</Label><Input type="date" name="untilDay" defaultValue={day} /><Input type="time" name="to" defaultValue="15:00" step={900} /></div>
        <div className="space-y-1"><Label>Motivo</Label><Input name="reason" /></div>
        <div className="flex items-end"><Button disabled={pending} className="w-full">Bloquear</Button></div>
      </form>
    </details>
  );
}
