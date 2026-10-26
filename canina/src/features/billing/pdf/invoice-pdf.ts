import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Invoice, InvoiceItem, Payment } from "@prisma/client";
import { formatCents } from "@/lib/money";
import { TAX_RATE_LABEL } from "../domain/tax";
import type { TaxBreakdownRow } from "../domain/calculator";

/*
 * PDF generado con pdf-lib (JS puro): funciona igual en Node y en Cloudflare Workers,
 * donde no se puede compilar WebAssembly en tiempo de ejecución (yoga/react-pdf).
 */

const TITLE = { STANDARD: "FACTURA", SIMPLIFIED: "FACTURA SIMPLIFICADA", RECTIFYING: "FACTURA RECTIFICATIVA" } as const;
const METHOD = { CASH: "Efectivo", CARD: "Tarjeta", BIZUM: "Bizum", VOUCHER: "Bono", TRANSFER: "Transferencia" } as const;

const A4 = { w: 595.28, h: 841.89 };
const M = 36; // margen
const FOOTER_H = 70;
const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.82, 0.84, 0.86);
const TEAL = rgb(0.06, 0.46, 0.43);
const AMBER = rgb(0.96, 0.62, 0.04);

const COLS = [0.46, 0.08, 0.13, 0.1, 0.11, 0.12];
const HEADERS = ["Concepto", "Cant.", "Precio s/IVA", "IVA", "Base", "Total"];

/** Las fuentes estándar usan WinAnsi: normaliza espacios de Intl y sustituye lo no representable. */
function clean(text: string): string {
  return text
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7E -ÿ€—–‘’“”•…]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export type InvoicePdfInput = {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
  /** PNG del QR tributario (bytes o data URL). */
  qrPng?: Uint8Array | string;
  registryInfo?: string | null;
  rectifiedNumber?: string | null;
};

/**
 * PDF con el contenido mínimo obligatorio (arts. 6 y 7 RD 1619/2012):
 * nº y serie, fecha, emisor y destinatario con NIF, descripción, base por tipo,
 * tipo y cuota de IVA, total; QR y leyenda Veri*Factu.
 */
export async function renderInvoicePdf({ invoice: inv, items, payments, qrPng, registryInfo, rectifiedNumber }: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(inv.fullNumber ?? "Borrador");
  doc.setAuthor(inv.issuerName);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const contentW = A4.w - 2 * M;

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;

  type TextOpts = { font?: PDFFont; size?: number; color?: typeof INK; align?: "left" | "right"; width?: number };
  const text = (t: string, x: number, opts: TextOpts = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 9;
    const s = clean(t);
    const dx = opts.align === "right" ? (opts.width ?? 0) - font.widthOfTextAtSize(s, size) : 0;
    page.drawText(s, { x: x + dx, y: y - size, size, font, color: opts.color ?? INK });
  };
  const box = (lines: { t: string; font?: PDFFont; color?: typeof INK }[], border = LINE) => {
    const h = lines.length * 12 + 12;
    page.drawRectangle({ x: M, y: y - h, width: contentW, height: h, borderColor: border, borderWidth: 1 });
    y -= 6;
    for (const l of lines) {
      text(l.t, M + 8, { font: l.font, color: l.color });
      y -= 12;
    }
    y -= 18;
  };

  // Cabecera: emisor (izquierda) y tipo/número/fechas (derecha)
  const top = y;
  text(inv.issuerName, M, { font: bold, size: 16 });
  y -= 20;
  text(`NIF: ${inv.issuerTaxId}`, M);
  y -= 12;
  for (const l of wrap(inv.issuerAddress ?? "", regular, 9, contentW / 2)) {
    text(l, M);
    y -= 12;
  }
  const leftBottom = y;
  y = top;
  const half = contentW / 2;
  const rx = M + half;
  text(TITLE[inv.type], rx, { font: bold, size: 16, color: TEAL, align: "right", width: half });
  y -= 20;
  text(`Nº ${inv.fullNumber ?? "BORRADOR"}`, rx, { font: bold, align: "right", width: half });
  y -= 12;
  if (inv.issueDate) {
    text(`Fecha de expedición: ${inv.issueDate.toLocaleDateString("es-ES")}`, rx, { align: "right", width: half });
    y -= 12;
  }
  if (inv.operationDate) {
    text(`Fecha de operación: ${inv.operationDate.toLocaleDateString("es-ES")}`, rx, { align: "right", width: half });
    y -= 12;
  }
  y = Math.min(y, leftBottom) - 16;

  if (inv.customerName || inv.type !== "SIMPLIFIED") {
    box([
      { t: "DESTINATARIO", color: MUTED },
      { t: inv.customerName ?? "—", font: bold },
      ...(inv.customerTaxId ? [{ t: `NIF: ${inv.customerTaxId}` }] : []),
      ...(inv.customerAddress ? [{ t: inv.customerAddress }] : []),
    ]);
  }
  if (inv.type === "RECTIFYING") {
    box([{ t: `Rectifica a la factura ${rectifiedNumber ?? ""}`, font: bold }, { t: `Motivo: ${inv.rectifyReason ?? ""}` }], AMBER);
  }

  // Tabla de líneas (la cabecera se repite si la tabla salta de página)
  const colX = COLS.map((_, i) => M + COLS.slice(0, i).reduce((a, c) => a + c, 0) * contentW);
  const tableHeader = () => {
    HEADERS.forEach((h, i) => text(h, colX[i], { font: bold, align: i > 0 ? "right" : "left", width: COLS[i] * contentW }));
    y -= 14;
    page.drawLine({ start: { x: M, y }, end: { x: M + contentW, y }, thickness: 1, color: LINE });
    y -= 4;
  };
  const ensureSpace = (needed: number, repeatHeader: boolean) => {
    if (y - needed >= M + FOOTER_H) return;
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - M;
    if (repeatHeader) tableHeader();
  };
  tableHeader();
  for (const it of items) {
    const desc = wrap(it.description + (it.exemptionCause ? `\n${it.exemptionCause}` : ""), regular, 9, COLS[0] * contentW - 6);
    const h = desc.length * 11 + 4;
    ensureSpace(h, true);
    const rowTop = y;
    desc.forEach((l, i) => {
      y = rowTop - i * 11;
      text(l, colX[0]);
    });
    y = rowTop;
    const cells = [String(Number(it.quantity)), formatCents(it.netUnitPriceCents), `${it.taxRateBp / 100}%`, formatCents(it.baseCents), formatCents(it.totalCents)];
    cells.forEach((c, i) => text(c, colX[i + 1], { align: "right", width: COLS[i + 1] * contentW }));
    y -= h;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: M + contentW, y: y + 2 }, thickness: 0.5, color: rgb(0.95, 0.96, 0.96) });
  }

  // Bloque inferior: QR + pagos (izquierda) y totales (derecha)
  const breakdown = (inv.taxBreakdown ?? []) as TaxBreakdownRow[];
  ensureSpace(140, false);
  y -= 14;
  const blockTop = y;
  const colW = contentW * 0.45;
  const totX = M + contentW - colW;
  const row = (label: string, value: string, font = regular, size = 9) => {
    text(label, totX, { font, size });
    text(value, totX, { font, size, align: "right", width: colW });
    y -= size + 4;
  };
  for (const b of breakdown) row(`Base ${TAX_RATE_LABEL[b.taxRate]}`, `${formatCents(b.baseCents)}  ·  Cuota ${formatCents(b.taxCents)}`);
  y -= 4;
  row("Base imponible", formatCents(inv.subtotalCents));
  row("Total IVA", formatCents(inv.taxCents));
  if (inv.withholdingCents > 0) row(`Retención IRPF (${inv.withholdingRate / 100}%)`, `-${formatCents(inv.withholdingCents)}`);
  page.drawLine({ start: { x: totX, y: y - 1 }, end: { x: M + contentW, y: y - 1 }, thickness: 1, color: INK });
  y -= 6;
  row("TOTAL", formatCents(inv.totalCents), bold, 12);
  if (inv.type === "SIMPLIFIED") text("IVA incluido", totX, { color: MUTED });

  y = blockTop;
  if (qrPng) {
    const img = await doc.embedPng(qrPng);
    page.drawImage(img, { x: M, y: y - 80, width: 80, height: 80 });
    y -= 28;
    text("QR tributario", M + 88, { font: bold });
    y -= 12;
    for (const l of wrap("Factura verificable en la sede electrónica de la AEAT", regular, 9, 140)) {
      text(l, M + 88, { color: MUTED });
      y -= 11;
    }
    y = blockTop - 92;
  }
  if (payments.length > 0) {
    text("Forma de pago", M, { font: bold });
    y -= 12;
    for (const p of payments) {
      text(`${METHOD[p.method]}: ${formatCents(p.amountCents)}`, M);
      y -= 12;
    }
  }

  // Pie en todas las páginas: huella, datos registrales y aviso RGPD
  const footer = [
    `Huella: ${inv.hash ?? ""}`,
    ...(registryInfo ? [registryInfo] : []),
    "Sus datos se tratan para la gestión de la relación comercial y obligaciones fiscales. Puede ejercer sus derechos RGPD en el email del emisor.",
  ].flatMap((l) => wrap(l, regular, 7, contentW));
  for (const pg of doc.getPages()) {
    footer.forEach((l, i) => pg.drawText(l, { x: M, y: 28 + (footer.length - 1 - i) * 9, size: 7, font: regular, color: MUTED }));
  }

  return doc.save();
}
