import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
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
      </section>

      <section id="servicios" className="scroll-mt-20 space-y-10">
        {categories.map((c) => (
          <div key={c.id}>
            <h2 className="mb-4 text-xl font-semibold">{c.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.services.map((s) => {
                const from = Math.min(s.basePriceCents, ...s.pricing.map((p) => p.priceCents));
                return (
                  <Card key={s.id}>
                    <CardHeader>
                      <CardTitle>{s.name}</CardTitle>
                      {s.description && <CardDescription>{s.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
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
