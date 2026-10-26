import { PawPrint } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function Loyalty() {
  const s = await requirePageRole(["CLIENT"]);
  const [card, program, vouchers] = await Promise.all([
    prisma.loyaltyCard.findUnique({ where: { ownerId: s.ownerId }, include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } } }),
    prisma.loyaltyProgram.findUnique({ where: { id: "default" } }),
    prisma.voucher.findMany({ where: { ownerId: s.ownerId }, include: { product: true }, orderBy: { purchasedAt: "desc" } }),
  ]);
  const stampsGoal = program?.stampsForReward ?? 10;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Saldo y fidelidad</h1>
      <Card className="bg-gradient-to-br from-primary to-teal-700 text-primary-foreground">
        <CardHeader>
          <CardDescription className="text-primary-foreground/80">Tarjeta {card?.cardNumber}</CardDescription>
          <CardTitle className="text-3xl">
            {program?.mode === "STAMPS" ? `${card?.stampsBalance ?? 0} / ${stampsGoal} sellos` : `${card?.pointsBalance ?? 0} puntos`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {program?.mode === "STAMPS" ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: stampsGoal }, (_, i) => (
                <span key={i} className={cn("flex size-9 items-center justify-center rounded-full border-2 border-white/60", i < (card?.stampsBalance ?? 0) && "bg-white text-primary")}>
                  <PawPrint className="size-4" />
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm">
              Equivalen a {formatCents(Math.floor(((card?.pointsBalance ?? 0) * (program?.centsPer100Points ?? 0)) / 100))} de descuento
              (mínimo {program?.minPointsToRedeem} puntos).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mis bonos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {vouchers.length === 0 && <p className="text-sm text-muted-foreground">No tienes bonos. ¡Pregunta en el salón!</p>}
          {vouchers.map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b pb-3 last:border-0">
              <div>
                <p className="font-medium">{v.product.name}</p>
                <p className="text-xs text-muted-foreground">Código {v.code} · caduca {v.expiresAt.toLocaleDateString("es-ES")}</p>
                <div className="mt-1 h-2 w-48 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(v.usedSessions / v.totalSessions) * 100}%` }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{v.totalSessions - v.usedSessions}</p>
                <p className="text-xs text-muted-foreground">sesiones</p>
                <Badge variant={v.status === "ACTIVE" ? "success" : "outline"}>{v.status === "ACTIVE" ? "Activo" : v.status === "EXHAUSTED" ? "Agotado" : "Caducado"}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {card && card.transactions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Movimientos</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {card.transactions.map((t) => (
              <p key={t.id} className="flex justify-between">
                <span>{t.createdAt.toLocaleDateString("es-ES")} · {t.type === "EARN" ? "Acumulado" : t.type === "REDEEM" ? "Canjeado" : t.type}</span>
                <span className={t.points < 0 ? "text-destructive" : "text-emerald-700"}>{t.points ? `${t.points > 0 ? "+" : ""}${t.points} pts` : `+${t.stamps} sello`}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
