"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { formatHM, localDay, localMinutes } from "@/lib/time";
import { HEALTH_ALERT_LABEL } from "@/features/dogs/domain/labels";
import { DEFAULT_GRID, dragToStart, hourMarks, minutesToPx, type GridConfig } from "../domain/grid";
import { DRAGGABLE, STAGE_LABEL, STATUS_META } from "../domain/status";
import { TONE_META } from "../domain/tone";
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
  const nowMin = useNowMinutes(data.day);
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
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span><strong className="font-semibold">Sin peluquero:</strong> arrastra {unassigned.length === 1 ? "la cita" : `las ${unassigned.length} citas`} a una columna</span>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((a) => (
              <div key={a.id} className="w-64">
                <AppointmentCard appt={a} grid={grid} floating onOpen={() => setSelected(a)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <ToneLegend />
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
              nowMin={nowMin}
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
  nowMin: number | null;
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
    <div className="min-w-56 flex-1 border-r last:border-r-0">
      <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-card px-3">
        <span className="size-3 rounded-full" style={{ background: props.staff.color }} />
        <span className="truncate text-sm font-semibold">{props.staff.displayName}</span>
        <span className="ml-auto text-xs text-muted-foreground">{(() => {
          const n = props.appointments.filter((a) => a.status !== "CANCELLED").length;
          return n === 1 ? "1 cita" : `${n} citas`;
        })()}</span>
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
        {props.nowMin !== null && props.nowMin >= grid.dayStartMin && props.nowMin <= grid.dayEndMin && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-red-500" style={{ top: minutesToPx(props.nowMin, grid) }} />
        )}
      </div>
    </div>
  );
}

function AppointmentCard({ appt, grid, floating, onOpen }: { appt: AgendaAppointment; grid: GridConfig; floating?: boolean; onOpen: () => void }) {
  const draggable = DRAGGABLE.includes(appt.status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: appt.id, disabled: !draggable });
  const meta = STATUS_META[appt.status];
  const tone = TONE_META[appt.tone];
  const caution = appt.dog.needsMuzzle || appt.dog.temperament === "REACTIVE" || appt.dog.temperament === "AGGRESSIVE";
  const cancelled = appt.status === "CANCELLED" || appt.status === "NO_SHOW";

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      // Las citas no arrastrables siguen siendo botones normales (dnd-kit marcaría aria-disabled)
      {...(draggable ? { ...attributes, ...listeners } : {})}
      className={cn(
        "group absolute inset-x-1 flex flex-col gap-0.5 overflow-hidden rounded-lg px-2 py-1.5 text-left text-xs transition-shadow hover:shadow-md",
        cancelled ? STATUS_META[appt.status].className : tone.card,
        appt.status === "IN_PROGRESS" && "ring-2 ring-inset ring-primary",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "z-40 opacity-80 shadow-lg",
        floating && "relative inset-auto w-full border border-amber-200 bg-card",
      )}
      style={{
        ...(floating ? {} : { top: minutesToPx(appt.startMin, grid), height: Math.max((appt.endMin - appt.startMin) * grid.pxPerMin - 2, 22) }),
        transform: CSS.Translate.toString(transform),
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <span className="font-semibold">{formatHM(appt.startMin)}</span>
        <span className="truncate font-semibold">{appt.dog.name}</span>
        {appt.dog.alerts.map((h) => (
          <span key={h.id} title={h.description}
            className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 text-[10.5px] font-semibold", h.severity === "INFO" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-800")}>
            <AlertTriangle className="size-2.5" aria-hidden /> {HEALTH_ALERT_LABEL[h.type]}
            <span className="sr-only">: {h.description}</span>
          </span>
        ))}
        {caution && (
          <span title={appt.dog.needsMuzzle ? "Necesita bozal" : "Precaución en el manejo"} className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 text-[10.5px] font-semibold text-orange-900">
            <ShieldAlert className="size-2.5" aria-hidden /> {appt.dog.needsMuzzle ? "Bozal" : "Cuidado"}
          </span>
        )}
      </div>
      <div className="truncate opacity-80">{appt.dog.breed} · {appt.services.join(", ")}</div>
      <div className="mt-auto flex items-center gap-1.5 truncate opacity-80">
        <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} aria-hidden />
        {meta.label}
        {appt.stage ? ` · ${STAGE_LABEL[appt.stage]}` : ""}
      </div>
    </button>
  );
}

function ToneLegend() {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Colores por servicio">
      {Object.values(TONE_META).filter((t) => t.label !== "Otros").map((t) => (
        <span key={t.label} className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-sm", t.swatch)} aria-hidden />{t.label}</span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-red-500" aria-hidden />Ahora</span>
    </div>
  );
}

/** Minuto actual en hora del salón si `day` es hoy (se actualiza cada minuto), o null. */
function useNowMinutes(day: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!now || localDay(now) !== day) return null;
  return localMinutes(now);
}
