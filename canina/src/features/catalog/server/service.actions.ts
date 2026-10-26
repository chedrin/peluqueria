"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { toActionResult } from "@/lib/errors";

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  basePriceCents: z.number().int().min(0),
  baseDurationMin: z.number().int().min(5).max(600),
  bufferAfterMin: z.number().int().min(0).max(120),
  taxRate: z.enum(["GENERAL_21", "REDUCED_10", "SUPER_REDUCED_4", "EXEMPT"]),
  bookableOnline: z.boolean(),
  isActive: z.boolean(),
});

export async function upsertServiceAction(input: z.input<typeof serviceSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN"]);
    const { id, ...p } = serviceSchema.parse(input);
    const data = { ...p, categoryId: p.categoryId || null };
    const svc = id
      ? await prisma.service.update({ where: { id }, data })
      : await prisma.service.create({ data: { ...data, slug: `${slugify(p.name)}-${Date.now().toString(36)}` } });
    await audit(prisma, { actorId: s.sub, action: id ? "UPDATE" : "CREATE", entity: "Service", entityId: svc.id, after: svc });
    revalidatePath("/admin/servicios");
    return { id: svc.id };
  });
}

const pricingSchema = z.object({
  serviceId: z.string(),
  size: z.enum(["SMALL", "MEDIUM", "LARGE", "GIANT"]).nullable(),
  coatType: z.enum(["SHORT", "LONG", "CURLY", "DOUBLE", "WIRE"]).nullable(),
  priceCents: z.number().int().min(0),
  durationMin: z.number().int().min(5),
});

/** Crea o actualiza la celda de la matriz tamaño × pelo. */
export async function upsertPricingAction(input: z.input<typeof pricingSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN"]);
    const p = pricingSchema.parse(input);
    // Prisma no admite upsert por unique compuesto con NULLs: buscamos primero
    const existing = await prisma.servicePricing.findFirst({ where: { serviceId: p.serviceId, size: p.size, coatType: p.coatType } });
    const row = existing
      ? await prisma.servicePricing.update({ where: { id: existing.id }, data: { priceCents: p.priceCents, durationMin: p.durationMin } })
      : await prisma.servicePricing.create({ data: p });
    await audit(prisma, { actorId: s.sub, action: existing ? "UPDATE" : "CREATE", entity: "ServicePricing", entityId: row.id, after: row });
    revalidatePath("/admin/servicios");
  });
}

export async function deletePricingAction(id: string) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN"]);
    const row = await prisma.servicePricing.delete({ where: { id } });
    await audit(prisma, { actorId: s.sub, action: "DELETE", entity: "ServicePricing", entityId: id, before: row });
    revalidatePath("/admin/servicios");
  });
}
