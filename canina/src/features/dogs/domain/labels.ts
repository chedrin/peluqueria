import type { HealthAlertType } from "@prisma/client";

export const HEALTH_ALERT_LABEL: Record<HealthAlertType, string> = {
  SKIN_ALLERGY: "Alergia cutánea",
  FOOD_ALLERGY: "Alergia alimentaria",
  DERMATITIS: "Dermatitis",
  RECENT_SURGERY: "Cirugía reciente",
  SENSITIVE_AREA: "Zona sensible",
  MEDICATION: "Medicación",
  PARASITES: "Parásitos",
  HEART_CONDITION: "Cardiopatía",
  EPILEPSY: "Epilepsia",
  OTHER: "Otro",
};
