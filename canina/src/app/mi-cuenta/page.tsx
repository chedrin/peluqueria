import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientHome() {
  const s = await requirePageRole(["CLIENT"]);
  const [next, card, vouchers] = await Promise.all([
    prisma.appointment.findFirst({
      where: { ownerId: s.ownerId, startsAt: { gte: new Date() }, status: { in: ["PENDING", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      include: { dog: true, groomer: true },
    }),
    prisma.loyaltyCard.findUnique({ where: { ownerId: s.ownerId } }),
    prisma.voucher.count({ where: { ownerId: s.ownerId, status: "ACTIVE" } }),
  ]);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="sm:col-span-3">
        <CardHeader><CardTitle>Próxima cita</CardTitle></CardHeader>
        <CardContent>
          {next ? (
            <p>
              <strong>{next.dog.name}</strong> · {next.startsAt.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Madrid" })}
              {next.groomer && <> con {next.groomer.displayName}</>} · estimado {formatCents(next.estimatedCents)}
            </p>
          ) : (
            <Link href="/reservar" className={buttonVariants()}>Reservar ahora</Link>
          )}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>{card?.pointsBalance ?? 0}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">puntos</CardContent></Card>
      <Card><CardHeader><CardTitle>{card?.stampsBalance ?? 0}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">sellos</CardContent></Card>
      <Card><CardHeader><CardTitle>{vouchers}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">bonos activos</CardContent></Card>
    </div>
  );
}
