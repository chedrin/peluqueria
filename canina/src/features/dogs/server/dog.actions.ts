"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { DomainError, toActionResult } from "@/lib/errors";
import { sizeFromWeight } from "@/features/catalog/domain/pricing";

const quickDogSchema = z.object({
  name: z.string().min(1).max(40),
  breedText: z.string().max(60).optional(),
  weightKg: z.number().positive().max(120),
  coatType: z.enum(["SHORT", "LONG", "CURLY", "DOUBLE", "WIRE"]),
  temperament: z.enum(["DOCILE", "NERVOUS", "FEARFUL", "REACTIVE", "AGGRESSIVE"]).default("DOCILE"),
  birthDate: z.string().optional(),
  healthNotes: z.string().max(300).optional(),
  ownerId: z.string().optional(), // solo staff
});

/** Alta rápida de mascota (cliente en la reserva o recepción en mostrador). */
export async function createDogAction(input: z.input<typeof quickDogSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["CLIENT", "ADMIN", "RECEPTION"]);
    const p = quickDogSchema.parse(input);
    const ownerId = s.role === "CLIENT" ? s.ownerId : p.ownerId;
    if (!ownerId) throw new DomainError("VALIDATION", "Falta el propietario.");

    const dog = await prisma.dog.create({
      data: {
        ownerId,
        name: p.name,
        breedText: p.breedText,
        size: sizeFromWeight(p.weightKg),
        currentWeightKg: p.weightKg,
        coatType: p.coatType,
        temperament: p.temperament,
        birthDate: p.birthDate ? new Date(p.birthDate) : undefined,
        weightHistory: { create: { weightKg: p.weightKg } },
        // Lo que el dueño declara se guarda como alerta a revisar por el peluquero
        healthAlerts: p.healthNotes ? { create: { type: "OTHER", severity: "WARNING", description: p.healthNotes } } : undefined,
      },
    });
    await audit(prisma, { actorId: s.sub, action: "CREATE", entity: "Dog", entityId: dog.id, after: dog });
    revalidatePath("/mi-cuenta/mascotas");
    return { id: dog.id, name: dog.name, size: dog.size };
  });
}

const alertSchema = z.object({
  dogId: z.string(),
  type: z.enum(["SKIN_ALLERGY", "FOOD_ALLERGY", "DERMATITIS", "RECENT_SURGERY", "SENSITIVE_AREA", "MEDICATION", "PARASITES", "HEART_CONDITION", "EPILEPSY", "OTHER"]),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  description: z.string().min(3),
  bodyArea: z.string().optional(),
  validUntil: z.string().optional(),
});

export async function addHealthAlertAction(input: z.input<typeof alertSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "RECEPTION", "GROOMER"]);
    const p = alertSchema.parse(input);
    const alert = await prisma.healthAlert.create({ data: { ...p, validUntil: p.validUntil ? new Date(p.validUntil) : undefined } });
    await audit(prisma, { actorId: s.sub, action: "CREATE", entity: "HealthAlert", entityId: alert.id, after: alert });
    revalidatePath(`/admin/perros/${p.dogId}`);
  });
}

const recordSchema = z.object({
  dogId: z.string(),
  appointmentId: z.string().optional(),
  servicesDone: z.array(z.string()),
  shampoo: z.string().optional(),
  conditioner: z.string().optional(),
  bladeNumber: z.string().optional(),
  combGuide: z.string().optional(),
  cutDescription: z.string().optional(),
  coatCondition: z.enum(["GOOD", "KNOTS", "MATTED", "SHEDDING"]).optional(),
  weightKg: z.number().positive().optional(),
  behaviorNotes: z.string().optional(),
  photos: z.array(z.object({ kind: z.enum(["BEFORE", "AFTER", "DETAIL"]), url: z.string().url() })).default([]),
});

/** Registro técnico al terminar la sesión: cuchilla, champú, comportamiento, fotos antes/después. */
export async function saveGroomingRecordAction(input: z.input<typeof recordSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "GROOMER"]);
    if (!s.staffId) throw new DomainError("FORBIDDEN", "Tu usuario no tiene perfil de peluquero.");
    const p = recordSchema.parse(input);
    const record = await prisma.$transaction(async (tx) => {
      const r = await tx.groomingRecord.create({
        data: {
          dogId: p.dogId,
          appointmentId: p.appointmentId,
          groomerId: s.staffId!,
          servicesDone: p.servicesDone,
          shampoo: p.shampoo,
          conditioner: p.conditioner,
          bladeNumber: p.bladeNumber,
          combGuide: p.combGuide,
          cutDescription: p.cutDescription,
          coatCondition: p.coatCondition,
          weightKg: p.weightKg,
          behaviorNotes: p.behaviorNotes,
          photos: { create: p.photos.map((ph) => ({ ...ph, dogId: p.dogId })) },
        },
      });
      if (p.weightKg) {
        await tx.dogWeight.create({ data: { dogId: p.dogId, weightKg: p.weightKg } });
        await tx.dog.update({ where: { id: p.dogId }, data: { currentWeightKg: p.weightKg, size: sizeFromWeight(p.weightKg) } });
      }
      if (p.coatCondition) await tx.dog.update({ where: { id: p.dogId }, data: { coatCondition: p.coatCondition } });
      await audit(tx, { actorId: s.sub, action: "CREATE", entity: "GroomingRecord", entityId: r.id, after: r });
      return r;
    });
    revalidatePath(`/admin/perros/${p.dogId}`);
    return { id: record.id };
  });
}

const tol = z.enum(["YES", "PARTIAL", "NO", "UNKNOWN"]);
const dogUpdateSchema = z.object({
  dogId: z.string(),
  name: z.string().min(1),
  breedText: z.string().optional(),
  sex: z.string().optional(),
  birthDate: z.string().optional(),
  size: z.enum(["SMALL", "MEDIUM", "LARGE", "GIANT"]),
  coatType: z.enum(["SHORT", "LONG", "CURLY", "DOUBLE", "WIRE"]),
  coatCondition: z.enum(["GOOD", "KNOTS", "MATTED", "SHEDDING"]),
  coatColor: z.string().optional(),
  temperament: z.enum(["DOCILE", "NERVOUS", "FEARFUL", "REACTIVE", "AGGRESSIVE"]),
  handlingNotes: z.string().optional(),
  toleratesDryer: tol,
  toleratesBlower: tol,
  allowsNailTrim: tol,
  needsMuzzle: z.boolean(),
  favoriteTreats: z.string().optional(),
  allowedTreats: z.string().optional(),
  favoriteToys: z.string().optional(),
});

export async function updateDogAction(input: z.input<typeof dogUpdateSchema>) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "RECEPTION", "GROOMER"]);
    const { dogId, birthDate, ...p } = dogUpdateSchema.parse(input);
    const before = await prisma.dog.findUniqueOrThrow({ where: { id: dogId } });
    const after = await prisma.dog.update({
      where: { id: dogId },
      data: { ...p, birthDate: birthDate ? new Date(birthDate) : null },
    });
    await audit(prisma, { actorId: s.sub, action: "UPDATE", entity: "Dog", entityId: dogId, before, after });
    revalidatePath(`/admin/perros/${dogId}`);
  });
}

export async function deactivateHealthAlertAction(alertId: string) {
  return toActionResult(async () => {
    const s = await requireRole(["ADMIN", "RECEPTION", "GROOMER"]);
    const a = await prisma.healthAlert.update({ where: { id: alertId }, data: { isActive: false } });
    await audit(prisma, { actorId: s.sub, action: "UPDATE", entity: "HealthAlert", entityId: alertId, after: { isActive: false } });
    revalidatePath(`/admin/perros/${a.dogId}`);
  });
}
