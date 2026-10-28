import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { localDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AgendaBoard } from "@/features/agenda/components/AgendaBoard";
import { AgendaToolbar, type AgendaView } from "@/features/agenda/components/AgendaToolbar";
import { TimeBlockForm } from "@/features/agenda/components/TimeBlockForm";
import { getAgendaDay, getAgendaRange } from "@/features/agenda/server/agenda.queries";
import { STATUS_META } from "@/features/agenda/domain/status";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ day?: string; view?: AgendaView; staff?: string }> }) {
  const sp = await searchParams;
  const day = sp.day ?? localDay(new Date());
  const view = sp.view ?? "day";
  const staffFilter = sp.staff?.split(",").filter(Boolean) ?? [];
  const allStaff = await prisma.staffProfile.findMany({ where: { user: { isActive: true } }, orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true, color: true } });

  let body: React.ReactNode;
  let summary: string | undefined;
  if (view === "day") {
    const data = await getAgendaDay(day, staffFilter);
    const live = data.appointments.filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW");
    const free = live.filter((a) => !a.groomerId).length;
    summary = [live.length === 1 ? "1 cita" : `${live.length} citas`, free > 0 && `${free} sin asignar`].filter(Boolean).join(" · ");
    body = (
      <>
        <AgendaBoard data={data} />
        <TimeBlockForm staff={allStaff} day={day} />
      </>
    );
  } else {
    // Semana: lunes→domingo. Mes: rejilla del mes completo.
    const base = new Date(`${day}T12:00:00Z`);
    const from = view === "week" ? addDays(day, -((base.getUTCDay() + 6) % 7)) : `${day.slice(0, 7)}-01`;
    const days = view === "week" ? 7 : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
    const to = addDays(from, days);
    const byDay = await getAgendaRange(from, to, staffFilter);
    const color = new Map(allStaff.map((s) => [s.id, s.color]));
    const lead = view === "month" ? (new Date(`${from}T12:00:00Z`).getUTCDay() + 6) % 7 : 0;
    body = (
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-7">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="hidden bg-muted p-2 text-center text-xs font-medium sm:block">{d}</div>
        ))}
        {Array.from({ length: lead }, (_, i) => <div key={`lead-${i}`} className="hidden bg-card sm:block" />)}
        {Array.from({ length: days }, (_, i) => {
          const d = addDays(from, i);
          const list = byDay.get(d) ?? [];
          return (
            <Link key={d} href={`/admin/agenda?day=${d}&view=day${staffFilter.length ? `&staff=${staffFilter.join(",")}` : ""}`}
              className={cn("min-h-28 bg-card p-2 text-xs hover:bg-muted/50", view === "week" && "sm:min-h-80")}>
              <p className={cn("mb-1 font-semibold", d === localDay(new Date()) && "text-primary")}>{Number(d.slice(8))}</p>
              {list.slice(0, view === "week" ? 20 : 4).map((a) => (
                <p key={a.id} className={cn("mb-0.5 truncate rounded border-l-2 px-1", STATUS_META[a.status].className)}
                  style={{ borderLeftColor: a.groomerId ? color.get(a.groomerId) : undefined }}>
                  {a.startsAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })} {a.dog.name}
                </p>
              ))}
              {list.length > (view === "week" ? 20 : 4) && <p className="text-muted-foreground">+{list.length - 4} más</p>}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <AgendaToolbar day={day} view={view} staff={allStaff} selectedStaff={staffFilter} summary={summary} />
      {body}
    </>
  );
}
