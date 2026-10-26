import type { LoyaltyMode } from "@prisma/client";

export type LoyaltyRules = {
  mode: LoyaltyMode;
  isActive: boolean;
  pointsPerEuro: number;
  centsPer100Points: number;
  minPointsToRedeem: number;
  stampsForReward: number;
};

/** Puntos/sellos que genera un pago completo. */
export function computeEarn(rules: LoyaltyRules, amountCents: number, hasVisit: boolean) {
  if (!rules.isActive || amountCents <= 0) return { points: 0, stamps: 0 };
  if (rules.mode === "POINTS") return { points: Math.floor(amountCents / 100) * rules.pointsPerEuro, stamps: 0 };
  return { points: 0, stamps: hasVisit ? 1 : 0 };
}

/** Descuento (céntimos) que se obtiene canjeando `points`. Valida mínimos y saldo. */
export function computeRedeem(rules: LoyaltyRules, balance: number, points: number) {
  if (rules.mode !== "POINTS") throw new Error("El programa activo es por sellos.");
  if (points < rules.minPointsToRedeem) throw new Error(`Mínimo ${rules.minPointsToRedeem} puntos para canjear.`);
  if (points > balance) throw new Error("Saldo de puntos insuficiente.");
  return Math.floor((points * rules.centsPer100Points) / 100);
}

/** ¿La tarjeta de sellos está completa? */
export function stampsRewardReady(rules: LoyaltyRules, stamps: number) {
  return rules.mode === "STAMPS" && stamps >= rules.stampsForReward;
}
