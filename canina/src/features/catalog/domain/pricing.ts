import type { CoatType, DogSize } from "@prisma/client";

export type PricingRow = {
  size: DogSize | null;
  coatType: CoatType | null;
  minWeightKg?: number | null;
  maxWeightKg?: number | null;
  priceCents: number;
  durationMin: number;
};

export type ServiceForPricing = {
  basePriceCents: number;
  baseDurationMin: number;
  bufferAfterMin: number;
  pricing: PricingRow[];
};

export type DogForPricing = { size: DogSize; coatType: CoatType; weightKg?: number | null };

/**
 * Resuelve precio (PVP, IVA incl.) y duración de un servicio para un perro concreto.
 * Prioridad: tamaño+pelo > tamaño > pelo > base. Si la tarifa define rango de peso,
 * debe contenerlo.
 */
export function resolveServicePrice(service: ServiceForPricing, dog: DogForPricing, staffAdjustMin = 0) {
  const fitsWeight = (r: PricingRow) =>
    dog.weightKg == null ||
    ((r.minWeightKg == null || dog.weightKg >= r.minWeightKg) && (r.maxWeightKg == null || dog.weightKg <= r.maxWeightKg));

  const score = (r: PricingRow) => {
    if (r.size && r.size !== dog.size) return -1;
    if (r.coatType && r.coatType !== dog.coatType) return -1;
    if (!fitsWeight(r)) return -1;
    return (r.size ? 2 : 0) + (r.coatType ? 1 : 0);
  };

  const best = service.pricing
    .map((r) => ({ r, s: score(r) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)[0]?.r;

  const durationMin = (best?.durationMin ?? service.baseDurationMin) + staffAdjustMin;
  return {
    priceCents: best?.priceCents ?? service.basePriceCents,
    durationMin,
    /** Tiempo que bloquea en agenda (incluye limpieza del puesto) */
    blockMin: durationMin + service.bufferAfterMin,
    matched: best ? "pricing" : "base",
  } as const;
}

export const SIZE_LABEL: Record<DogSize, string> = {
  SMALL: "Pequeño (<10 kg)",
  MEDIUM: "Mediano (10-25 kg)",
  LARGE: "Grande (25-45 kg)",
  GIANT: "Gigante (>45 kg)",
};

export const COAT_LABEL: Record<CoatType, string> = {
  SHORT: "Corto",
  LONG: "Largo",
  CURLY: "Rizado",
  DOUBLE: "Doble capa",
  WIRE: "Duro (stripping)",
};

export function sizeFromWeight(kg: number): DogSize {
  if (kg < 10) return "SMALL";
  if (kg < 25) return "MEDIUM";
  if (kg < 45) return "LARGE";
  return "GIANT";
}
