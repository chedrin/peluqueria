import "server-only";
import type { Tx } from "@/lib/prisma";
import { computeEarn } from "../domain/rules";

async function getOrCreateCard(tx: Tx, ownerId: string) {
  const existing = await tx.loyaltyCard.findUnique({ where: { ownerId } });
  if (existing) return existing;
  return tx.loyaltyCard.create({
    data: { ownerId, cardNumber: `CAN-${Date.now().toString(36).toUpperCase()}-${ownerId.slice(-4).toUpperCase()}` },
  });
}

export async function earnLoyaltyForInvoice(
  tx: Tx,
  p: { ownerId: string; invoiceId: string; amountCents: number; hasVisit: boolean },
) {
  const rules = await tx.loyaltyProgram.findUnique({ where: { id: "default" } });
  if (!rules) return;
  const { points, stamps } = computeEarn(rules, p.amountCents, p.hasVisit);
  if (!points && !stamps) return;
  const card = await getOrCreateCard(tx, p.ownerId);
  await tx.loyaltyCard.update({
    where: { id: card.id },
    data: {
      pointsBalance: { increment: points },
      lifetimePoints: { increment: points },
      stampsBalance: { increment: stamps },
    },
  });
  await tx.loyaltyTransaction.create({
    data: { cardId: card.id, type: "EARN", points, stamps, invoiceId: p.invoiceId },
  });
}
