import { createHash } from "node:crypto";

/**
 * Huella (hash) encadenada de registros de facturación según la especificación
 * Veri*Factu (Orden HAC/1177/2024): cada registro incluye la huella del anterior,
 * por lo que alterar una factura emitida rompe la cadena.
 *
 * NOTA: esto implementa la inalterabilidad local y el QR. El envío a la AEAT
 * (modalidad VERI*FACTU) y la declaración responsable del SIF quedan fuera de alcance.
 */
export type ChainRecord = {
  issuerTaxId: string;
  fullNumber: string;
  issueDate: Date;
  /** F1 completa, F2 simplificada, R1..R5 rectificativa */
  aeatType: "F1" | "F2" | "R1" | "R4" | "R5";
  taxCents: number;
  totalCents: number;
  previousHash: string | null;
  generatedAt: Date;
};

const ddmmyyyy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
const amount = (c: number) => (c / 100).toFixed(2);

export function buildChainString(r: ChainRecord): string {
  return [
    `IDEmisorFactura=${r.issuerTaxId}`,
    `NumSerieFactura=${r.fullNumber}`,
    `FechaExpedicionFactura=${ddmmyyyy(r.issueDate)}`,
    `TipoFactura=${r.aeatType}`,
    `CuotaTotal=${amount(r.taxCents)}`,
    `ImporteTotal=${amount(r.totalCents)}`,
    `Huella=${r.previousHash ?? ""}`,
    `FechaHoraHusoGenRegistro=${r.generatedAt.toISOString().replace(/\.\d{3}Z$/, "+00:00")}`,
  ].join("&");
}

export function computeInvoiceHash(r: ChainRecord): string {
  return createHash("sha256").update(buildChainString(r), "utf8").digest("hex").toUpperCase();
}

/** URL de cotejo para el código QR obligatorio (RD 1007/2023). */
export function buildAeatQrUrl(r: Pick<ChainRecord, "issuerTaxId" | "fullNumber" | "issueDate" | "totalCents">) {
  const p = new URLSearchParams({
    nif: r.issuerTaxId,
    numserie: r.fullNumber,
    fecha: ddmmyyyy(r.issueDate),
    importe: amount(r.totalCents),
  });
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?${p.toString()}`;
}

export function formatInvoiceNumber(code: string, year: number, n: number): string {
  return `${code}${year}-${String(n).padStart(6, "0")}`;
}
