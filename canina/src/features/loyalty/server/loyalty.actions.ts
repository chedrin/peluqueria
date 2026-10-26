"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { toActionResult } from "@/lib/errors";

const schema = z.object({
  mode: z.enum(["POINTS", "STAMPS"]),
  isActive: z.boolean(),
  pointsPerEuro: z.number().int().min(0),
  centsPer100Points: z.number().int().min(0),
  minPointsToRedeem: z.number().int().min(0),
  stampsForReward: z.number().int().min(1),
  rewardServiceId: z.string().nullable(),
  pointsExpireAfterDays: z.number().int().positive().nullable(),
});

export async function saveLoyaltyProgramAction(input: z.input<typeof schema>) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN"]);
    const p = schema.parse(input);
    const before = await prisma.loyaltyProgram.findUnique({ where: { id: "default" } });
    const after = await prisma.loyaltyProgram.upsert({ where: { id: "default" }, create: { id: "default", ...p }, update: p });
    await audit(prisma, { actorId: s.sub, action: "UPDATE", entity: "LoyaltyProgram", entityId: "default", before, after });
    revalidatePath("/admin/fidelidad");
  });
}

/** Canjea la tarjeta de sellos completa (servicio gratis) y la reinicia. */
export async function redeemStampsAction(ownerId: string) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "RECEPTION"]);
    const rules = await prisma.loyaltyProgram.findUniqueOrThrow({ where: { id: "default" } });
    const card = await prisma.loyaltyCard.findUniqueOrThrow({ where: { ownerId } });
    if (card.stampsBalance < rules.stampsForReward) throw new Error("La tarjeta aún no está completa.");
    await prisma.$transaction([
      prisma.loyaltyCard.update({ where: { id: card.id }, data: { stampsBalance: { decrement: rules.stampsForReward } } }),
      prisma.loyaltyTransaction.create({ data: { cardId: card.id, type: "REDEEM", stamps: -rules.stampsForReward, note: "Premio tarjeta de sellos" } }),
    ]);
    await audit(prisma, { actorId: s.sub, action: "UPDATE", entity: "LoyaltyCard", entityId: card.id, after: { redeemedStamps: rules.stampsForReward } });
  });
}
