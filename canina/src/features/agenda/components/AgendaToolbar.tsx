import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { localDay } from "@/lib/time";

export type AgendaView = "day" | "week" | "month";

function shift(day: string, view: AgendaView, dir: 1 | -1) {
  const d = new Date(`${day}T12:00:00Z`);
  if (view === "day") d.setUTCDate(d.getUTCDate() + dir);
  if (view === "week") d.setUTCDate(d.getUTCDate() + 7 * dir);
  if (view === "month") d.setUTCMonth(d.getUTCMonth() + dir);
  return d.toISOString().slice(0, 10);
}

export function AgendaToolbar(props: {
  day: string;
  view: AgendaView;
  staff: { id: string; displayName: string; color: string }[];
  selectedStaff: string[];
  summary?: string;
}) {
  const href = (o: Partial<{ day: string; view: AgendaView; staff: string[] }>) => {
    const q = new URLSearchParams({ day: o.day ?? props.day, view: o.view ?? props.view });
    const st = o.staff ?? props.selectedStaff;
    if (st.length) q.set("staff", st.join(","));
    return `/admin/agenda?${q}`;
  };
  const toggle = (id: string) =>
    props.selectedStaff.includes(id) ? props.selectedStaff.filter((s) => s !== id) : [...props.selectedStaff, id];
  const label = new Date(`${props.day}T12:00:00Z`).toLocaleDateString("es-ES", {
    weekday: props.view === "day" ? "long" : undefined,
    day: props.view === "month" ? undefined : "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <Link href={href({ day: shift(props.day, props.view, -1) })} className="rounded-md border p-2 hover:bg-muted" aria-label="Anterior"><ChevronLeft className="size-4" /></Link>
        <Link href={href({ day: localDay(new Date()) })} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Hoy</Link>
        <Link href={href({ day: shift(props.day, props.view, 1) })} className="rounded-md border p-2 hover:bg-muted" aria-label="Siguiente"><ChevronRight className="size-4" /></Link>
        <div className="ml-2">
          <h1 className="text-xl font-bold tracking-tight first-letter:uppercase">{label}</h1>
          {props.summary && <p className="text-sm text-muted-foreground">{props.summary}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {(["day", "week", "month"] as const).map((v) => (
            <Link key={v} href={href({ view: v })} aria-current={props.view === v ? "page" : undefined}
              className={cn("rounded-md px-3 py-1 text-sm", props.view === v ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {{ day: "Día", week: "Semana", month: "Mes" }[v]}
            </Link>
          ))}
        </div>
        {props.staff.map((s) => {
          const active = props.selectedStaff.length === 0 || props.selectedStaff.includes(s.id);
          return (
            <Link
              key={s.id}
              href={href({ staff: toggle(s.id) })}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", active ? "bg-card" : "opacity-40")}
            >
              <span className="size-2 rounded-full" style={{ background: s.color }} /> {s.displayName}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
