import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoyaltyProgramForm } from "@/features/loyalty/components/LoyaltyProgramForm";

export const metadata = { title: "Fidelización" };

export default async function LoyaltyAdmin() {
  const [program, services, top] = await Promise.all([
    prisma.loyaltyProgram.findUnique({ where: { id: "default" } }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.loyaltyCard.findMany({ orderBy: { lifetimePoints: "desc" }, take: 10, include: { owner: { include: { user: true } } } }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Reglas del programa</CardTitle></CardHeader>
        <CardContent><LoyaltyProgramForm program={program} services={services} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Mejores clientes</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {top.map((c) => (
            <p key={c.id} className="flex justify-between">
              <span>{c.owner.user.firstName} {c.owner.user.lastName}</span>
              <span>{c.pointsBalance} pts · {c.stampsBalance} sellos</span>
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
