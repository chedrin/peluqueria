import Link from "next/link";
import { CalendarCheck, Clock, HeartHandshake, NotebookPen, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SIZE_LABEL } from "@/features/catalog/domain/pricing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await prisma.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      services: {
        where: { isActive: true, bookableOnline: true },
        orderBy: { sortOrder: "asc" },
        include: { pricing: { orderBy: { priceCents: "asc" } } },
      },
    },
  });

  return (
    <>
      <section className="py-14 text-center sm:py-20">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Sparkles className="size-3" /> Peluquería y estética canina
        </p>
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Tu perro, limpio, feliz y sin estrés</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Reserva en 1 minuto. Elegimos el tiempo según su tamaño y tipo de pelo, y apuntamos sus manías para la próxima vez.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/reservar" className={buttonVariants({ size: "lg" })}>Reservar cita</Link>
          <Link href="#servicios" className={buttonVariants({ size: "lg", variant: "outline" })}>Ver servicios</Link>
        </div>
        <ul className="mx-auto mt-12 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
          {[
            { icon: CalendarCheck, title: "Reserva online", text: "Eliges servicio, día y peluquero. Te confirmamos al momento." },
            { icon: NotebookPen, title: "Recordamos sus manías", text: "Alergias, champú, cuchilla y cómo le gusta que le traten." },
            { icon: HeartHandshake, title: "Sin prisas", text: "Calculamos el tiempo según su tamaño y tipo de pelo." },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><Icon className="size-4" aria-hidden /></span>
              <span><strong className="block text-sm font-semibold">{title}</strong><span className="text-sm text-muted-foreground">{text}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section id="servicios" className="scroll-mt-20 space-y-10">
        {categories.map((c) => (
          <div key={c.id} className="gap-6 border-t pt-8 lg:grid lg:grid-cols-[220px_1fr]">
            <h2 className="mb-4 text-xl font-semibold lg:sticky lg:top-24 lg:self-start">{c.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {c.services.map((s) => {
                const from = Math.min(s.basePriceCents, ...s.pricing.map((p) => p.priceCents));
                return (
                  <Card key={s.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle>{s.name}</CardTitle>
                      {s.description && <CardDescription>{s.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-2 text-sm">
                      <p className="flex items-center justify-between">
                        <span className="text-2xl font-bold">desde {formatCents(from)}</span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Clock className="size-3" /> {s.baseDurationMin} min
                        </span>
                      </p>
                      {s.pricing.some((p) => p.size) && (
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {s.pricing.filter((p) => p.size && !p.coatType).map((p) => (
                            <li key={p.id} className="flex justify-between">
                              <span>{SIZE_LABEL[p.size!]}</span>
                              <span>{formatCents(p.priceCents)} · {p.durationMin} min</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link href="/reservar" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-auto self-start" })}>Reservar</Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Precios con IVA incluido. El precio final puede variar según el estado del manto.</p>
      </section>
    </>
  );
}
