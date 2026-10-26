import type { TaxRate } from "@prisma/client";

/** Tipos de IVA vigentes en España (Ley 37/1992), en basis points. */
export const TAX_RATE_BP: Record<TaxRate, number> = {
  GENERAL_21: 2100, // servicios de peluquería canina, cosmética, accesorios
  REDUCED_10: 1000, // p.ej. alimento para animales de compañía
  SUPER_REDUCED_4: 400,
  EXEMPT: 0, // requiere causa de exención
};

export const TAX_RATE_LABEL: Record<TaxRate, string> = {
  GENERAL_21: "IVA 21 %",
  REDUCED_10: "IVA 10 %",
  SUPER_REDUCED_4: "IVA 4 %",
  EXEMPT: "Exento",
};

/** Retenciones IRPF habituales (bp). Solo aplican cuando el destinatario es empresario/profesional. */
export const WITHHOLDING_BP = { NONE: 0, PROFESSIONAL_15: 1500, PROFESSIONAL_NEW_7: 700 } as const;
