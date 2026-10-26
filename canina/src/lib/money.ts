/** Todos los importes viajan en céntimos (enteros). */

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function formatCents(cents: number): string {
  return eur.format(cents / 100);
}

/** Aplica un porcentaje en basis points (2100 = 21 %) con redondeo half-up al céntimo. */
export function applyBp(cents: number, bp: number): number {
  return roundHalfUp((cents * bp) / 10_000);
}

/** Redondeo comercial: 0,5 → 1, -0,5 → -1 (simétrico respecto a cero). */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON);
}

export function eurosToCents(euros: number | string): number {
  const n = typeof euros === "string" ? Number(euros.replace(",", ".")) : euros;
  return roundHalfUp(n * 100);
}
