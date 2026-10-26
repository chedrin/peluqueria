"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Ban, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatHM } from "@/lib/time";
import { DEFAULT_GRID, dragToStart, hourMarks, minutesToPx, type GridConfig } from "../domain/grid";
import { DRAGGABLE, STAGE_LABEL, STATUS_META } from "../domain/status";
import { moveAppointment } from "../server/agenda.actions";
import type { getAgendaDay, AgendaAppointment } from "../server/agenda.queries";
import { AppointmentPanel } from "./AppointmentPanel";

type AgendaData = Awaited<ReturnType<typeof getAgendaDay>>;

/**
 * Agenda multiespecialista: una columna por peluquero, eje vertical horario.
 * Arrastrar en vertical cambia la hora; soltar en otra columna reasigna peluquero.
 *
 * Patrón: actualización optimista → server action → si el servidor rechaza
 * (solape, bloqueo, versión obsoleta) se revierte y se muestra el motivo.
 */
export function AgendaBoard({ data, grid = DEFAULT_GRID }: { data: AgendaData; grid?: GridConfig }) {
  const router = useRouter();
  const [appointments, setAppointments] = useState(data.appointments);
  const [preview, setPreview] = useState<{ id: string; startMin: number; staffId: string } | null>(null);
  const [selected, setSelected] = useState<AgendaAppointment | null>(null);
  const [, startTransition] = useTransition();

  // Re-sincroniza cuando el servidor envía datos nuevos (cambio de día / revalidación)
  const [lastData, setLastData] = useState(data);
  if (lastData !== data) {
    setLastData(data);
    setAppointments(data.appointments);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const unassigned = appointments.filter((a) => !a.groomerId);
  const height = (grid.dayEndMin - grid.dayStartMin) * grid.pxPerMin;

  function computeTarget(e: DragMoveEvent | DragEndEvent) {
    const appt = appointments.find((a) => a.id === e.active.id);
    if (!appt || !e.over) return null;
    const duration = appt.endMin - appt.startMin;
    // Las citas "sin asignar" se sueltan en su hora reservada; el resto se desplaza según el arrastre
    const startMin = appt.groomerId ? dragToStart(appt.startMin, duration, e.delta.y, grid) : appt.startMin;
    return { appt, staffId: String(e.over.id), startMin, duration };
  }

  function onDragMove(e: DragMoveEvent) {
    const t = computeTarget(e);
    setPreview(t ? { id: t.appt.id, startMin: t.startMin, staffId: t.staffId } : null);
  }

  function onDragEnd(e: DragEndEvent) {
    setPreview(null);
    const t = computeTarget(e);
    if (!t) return;
    const { appt, staffId, startMin, duration } = t;
    if (appt.groomerId === staffId && appt.startMin === startMin) return;

    const before = appointments;
    // 1) Optimista
    setAppointments((list) =>
      list.map((a) => (a.id === appt.id ? { ...a, groomerId: staffId, startMin, endMin: startMin + duration } : a)),
    );
    // 2) Servidor
    startTransition(async () => {
      const res = await moveAppointment({ appointmentId: appt.id, groomerId: staffId, day: data.day, startMin, version: appt.version });
      if (!res.ok) {
        setAppointments(before); // 3) Revertir
        toast.error(res.message);
        if (res.code === "STALE") router.refresh();
        return;
      }
      setAppointments((list) => list.map((a) => (a.id === appt.id ? { ...a, version: res.data.version } : a)));
      const staffName = data.staff.find((s) => s.id === staffId)?.displayName;
      toast.success(`${appt.dog.name} → ${formatHM(startMin)}${appt.groomerId !== staffId ? ` con ${staffName}` : ""}`);
    });
  }

  return (
    <DndContext sensors={sensors} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => setPreview(null)}>
      {unassigned.length > 0 && (
        <div className="mb-3 rounded-lg border border-dashed border-amber-400 bg-amber-50 p-3 text-sm">
          <strong>{unassigned.length} cita(s) sin peluquero asignado</strong> (reservadas con «cualquiera»). Arrástralas a una columna:
          <div className="mt-2 flex flex-wrap gap-2">
            {unassigned.map((a) => (
              <div key={a.id} className="relative h-16 w-56">
                <AppointmentCard appt={a} grid={grid} floating onOpen={() => setSelected(a)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="flex min-w-fit">
          {/* Eje horario */}
          <div className="sticky left-0 z-20 w-14 shrink-0 border-r bg-card">
            <div className="h-12 border-b" />
            <div className="relative" style={{ height }}>
              {hourMarks(grid).map((m) => (
                <div key={m} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: minutesToPx(m, grid) }}>
                  {formatHM(m)}
                </div>
              ))}
            </div>
          </div>

          {data.staff.map((s) => (
            <StaffColumn
              key={s.id}
              staff={s}
              grid={grid}
              height={height}
              working={data.workingByStaff[s.id]?.working ?? []}
              blocks={data.workingByStaff[s.id]?.blocks ?? []}
              appointments={appointments.filter((a) => a.groomerId === s.id)}
              preview={preview?.staffId === s.id ? preview : null}
              draggingDuration={(() => {
                const a = preview && appointments.find((x) => x.id === preview.id);
                return a ? a.endMin - a.startMin : 0;
              })()}
              onOpen={setSelected}
            />
          ))}
        </div>
      </div>

      {selected && <AppointmentPanel appointment={selected} onClose={() => setSelected(null)} />}
    </DndContext>
  );
}

function StaffColumn(props: {
  staff: { id: string; displayName: string; color: string };
  grid: GridConfig;
  height: number;
  working: { start: number; end: number }[];
  blocks: { start: number; end: number }[];
  appointments: AgendaAppointment[];
  preview: { startMin: number } | null;
  draggingDuration: number;
  onOpen: (a: AgendaAppointment) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.staff.id });
  const { grid } = props;

  // Zonas fuera de horario = complementario del horario laboral
  const offHours = useMemo(() => {
    const sorted = [...props.working].sort((a, b) => a.start - b.start);
    const out: { start: number; end: number }[] = [];
    let cursor = grid.dayStartMin;
    for (const w of sorted) {
      if (w.start > cursor) out.push({ start: cursor, end: w.start });
      cursor = Math.max(cursor, w.end);
    }
    if (cursor < grid.dayEndMin) out.push({ start: cursor, end: grid.dayEndMin });
    return out;
  }, [props.working, grid]);

  return (
    <div className="w-56 shrink-0 border-r last:border-r-0 sm:w-64">
      <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-card px-3">
        <span className="size-3 rounded-full" style={{ background: props.staff.color }} />
        <span className="truncate text-sm font-semibold">{props.staff.displayName}</span>
        <span className="ml-auto text-xs text-muted-foreground">{props.appointments.filter((a) => a.status !== "CANCELLED").length}</span>
      </div>
      <div ref={setNodeRef} className={cn("relative transition-colors", isOver && "bg-primary/5")} style={{ height: props.height }}>
        {/* Líneas de cuarto de hora */}
        {Array.from({ length: Math.floor((grid.dayEndMin - grid.dayStartMin) / 15) }, (_, i) => (
          <div
            key={i}
            className={cn("absolute inset-x-0 border-t", i % 4 === 0 ? "border-border" : "border-dashed border-border/40")}
            style={{ top: i * 15 * grid.pxPerMin }}
          />
        ))}
        {offHours.map((o, i) => (
          <div key={`off-${i}`} className="absolute inset-x-0 bg-muted/70" style={{ top: minutesToPx(o.start, grid), height: (o.end - o.start) * grid.pxPerMin }} />
        ))}
        {props.blocks.map((b, i) => (
          <div
            key={`blk-${i}`}
            className="absolute inset-x-0 flex items-start gap-1 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,0.06)_6px,rgba(0,0,0,0.06)_12px)] p-1 text-[11px] text-muted-foreground"
            style={{ top: minutesToPx(b.start, grid), height: (b.end - b.start) * grid.pxPerMin }}
          >
            <Ban className="size-3" /> Bloqueado
          </div>
        ))}
        {props.preview && (
          <div
            className="pointer-events-none absolute inset-x-1 z-30 rounded-md border-2 border-dashed border-primary bg-primary/10 text-xs font-semibold text-primary"
            style={{ top: minutesToPx(props.preview.startMin, grid), height: props.draggingDuration * grid.pxPerMin }}
          >
            <span className="m-1 inline-block rounded bg-card px-1">{formatHM(props.preview.startMin)}</span>
          </div>
        )}
        {props.appointments.map((a) => (
          <AppointmentCard key={a.id} appt={a} grid={grid} onOpen={() => props.onOpen(a)} />
        ))}
      </div>
    </div>
  );
}

function AppointmentCard({ appt, grid, floating, onOpen }: { appt: AgendaAppointment; grid: GridConfig; floating?: boolean; onOpen: () => void }) {
  const draggable = DRAGGABLE.includes(appt.status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: appt.id, disabled: !draggable });
  const meta = STATUS_META[appt.status];
  const critical = appt.dog.alerts.length > 0;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      // Las citas no arrastrables siguen siendo botones normales (dnd-kit marcaría aria-disabled)
      {...(draggable ? { ...attributes, ...listeners } : {})}
      className={cn(
        "group absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm",
        meta.className,
        critical && "ring-2 ring-red-500",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "z-40 opacity-80 shadow-lg",
        floating && "relative inset-auto h-full w-full",
      )}
      style={{
        ...(floating ? {} : { top: minutesToPx(appt.startMin, grid), height: Math.max((appt.endMin - appt.startMin) * grid.pxPerMin - 2, 22) }),
        transform: CSS.Translate.toString(transform),
      }}
    >
      {critical && (
        <div className="-mx-2 -mt-1 mb-1 flex items-center gap-1 bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          <AlertTriangle className="size-3" /> {appt.dog.alerts.map((h) => h.description).join(" · ")}
        </div>
      )}
      <div className="flex items-center gap-1 font-semibold">
        <span>{formatHM(appt.startMin)}</span>
        <span className="truncate">{appt.dog.name}</span>
        {(appt.dog.needsMuzzle || appt.dog.temperament === "REACTIVE" || appt.dog.temperament === "AGGRESSIVE") && (
          <ShieldAlert className="size-3 text-red-600" aria-label="Precaución en el manejo" />
        )}
      </div>
      <div className="truncate opacity-80">{appt.dog.breed} · {appt.services.join(", ")}</div>
      <div className="truncate opacity-70">
        {meta.label}
        {appt.stage ? ` · ${STAGE_LABEL[appt.stage]}` : ""}
      </div>
    </button>
  );
}
