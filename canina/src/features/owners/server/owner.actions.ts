"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { DomainError, toActionResult } from "@/lib/errors";
import { isValidSpanishTaxId, normalizeTaxId } from "@/features/billing/domain/nif";

const ownerSchema = z.object({
  ownerId: z.string(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  preferredChannel: z.enum(["WHATSAPP", "SMS", "EMAIL", "PHONE"]),
  preferredCutStyle: z.string().optional(),
  personalNotes: z.string().optional(),
  favoriteGroomerId: z.string().optional(),
});

export async function updateOwnerAction(input: z.input<typeof ownerSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "RECEPTION"]);
    const p = ownerSchema.parse(input);
    const taxId = p.taxId ? normalizeTaxId(p.taxId) : null;
    if (taxId && !isValidSpanishTaxId(taxId)) throw new DomainError("VALIDATION", "El NIF/DNI/NIE no es válido.");
    const before = await prisma.ownerProfile.findUniqueOrThrow({ where: { id: p.ownerId }, include: { user: true } });
    const after = await prisma.ownerProfile.update({
      where: { id: p.ownerId },
      data: {
        taxId,
        whatsapp: p.whatsapp || null,
        address: p.address || null,
        postalCode: p.postalCode || null,
        city: p.city || null,
        province: p.province || null,
        preferredChannel: p.preferredChannel,
        preferredCutStyle: p.preferredCutStyle || null,
        personalNotes: p.personalNotes || null,
        favoriteGroomer: p.favoriteGroomerId ? { connect: { id: p.favoriteGroomerId } } : { disconnect: true },
        user: { update: { phone: p.phone || null } },
      },
    });
    await audit(prisma, { actorId: s.sub, action: "UPDATE", entity: "OwnerProfile", entityId: p.ownerId, before, after });
    revalidatePath(`/admin/clientes/${p.ownerId}`);
  });
}
