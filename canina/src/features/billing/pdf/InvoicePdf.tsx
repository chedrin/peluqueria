import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Invoice, InvoiceItem, Payment } from "@prisma/client";
import { formatCents } from "@/lib/money";
import { TAX_RATE_LABEL } from "../domain/tax";
import type { TaxBreakdownRow } from "../domain/calculator";

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 90, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937" },
  row: { flexDirection: "row" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: "#6b7280" },
  box: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8 },
  th: { fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderColor: "#d1d5db", paddingVertical: 4 },
  td: { paddingVertical: 3, borderBottomWidth: 0.5, borderColor: "#f3f4f6" },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
});

const TITLE = { STANDARD: "FACTURA", SIMPLIFIED: "FACTURA SIMPLIFICADA", RECTIFYING: "FACTURA RECTIFICATIVA" } as const;
const METHOD = { CASH: "Efectivo", CARD: "Tarjeta", BIZUM: "Bizum", VOUCHER: "Bono", TRANSFER: "Transferencia" } as const;
const cols = [0.46, 0.08, 0.13, 0.1, 0.11, 0.12];

/**
 * PDF con el contenido mínimo obligatorio (arts. 6 y 7 RD 1619/2012):
 * nº y serie, fecha, emisor y destinatario con NIF, descripción, base por tipo,
 * tipo y cuota de IVA, total; QR y leyenda Veri*Factu.
 */
export function InvoicePdf({ invoice: inv, items, payments, qrDataUrl, registryInfo, rectifiedNumber }: {
  invoice: Invoice; items: InvoiceItem[]; payments: Payment[]; qrDataUrl?: string; registryInfo?: string | null; rectifiedNumber?: string | null;
}) {
  const breakdown = (inv.taxBreakdown ?? []) as TaxBreakdownRow[];
  return (
    <Document title={inv.fullNumber ?? "Borrador"} author={inv.issuerName}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 16 }]}>
          <View>
            <Text style={s.h1}>{inv.issuerName}</Text>
            <Text>NIF: {inv.issuerTaxId}</Text>
            <Text>{inv.issuerAddress}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.h1, { color: "#0f766e" }]}>{TITLE[inv.type]}</Text>
            <Text>Nº <Text style={s.bold}>{inv.fullNumber}</Text></Text>
            <Text>Fecha de expedición: {inv.issueDate?.toLocaleDateString("es-ES")}</Text>
            {inv.operationDate && <Text>Fecha de operación: {inv.operationDate.toLocaleDateString("es-ES")}</Text>}
          </View>
        </View>

        {(inv.customerName || inv.type !== "SIMPLIFIED") && (
          <View style={[s.box, { marginBottom: 12 }]}>
            <Text style={[s.muted, { marginBottom: 2 }]}>DESTINATARIO</Text>
            <Text style={s.bold}>{inv.customerName ?? "—"}</Text>
            {inv.customerTaxId && <Text>NIF: {inv.customerTaxId}</Text>}
            {inv.customerAddress && <Text>{inv.customerAddress}</Text>}
          </View>
        )}

        {inv.type === "RECTIFYING" && (
          <View style={[s.box, { marginBottom: 12, borderColor: "#f59e0b" }]}>
            <Text style={s.bold}>Rectifica a la factura {rectifiedNumber}</Text>
            <Text>Motivo: {inv.rectifyReason}</Text>
          </View>
        )}

        <View style={s.row}>
          {["Concepto", "Cant.", "Precio s/IVA", "IVA", "Base", "Total"].map((h, i) => (
            <Text key={h} style={[s.th, { width: `${cols[i] * 100}%` }, i > 0 ? s.right : {}]}>{h}</Text>
          ))}
        </View>
        {items.map((it) => (
          <View key={it.id} style={s.row} wrap={false}>
            <Text style={[s.td, { width: `${cols[0] * 100}%` }]}>{it.description}{it.exemptionCause ? `\n${it.exemptionCause}` : ""}</Text>
            <Text style={[s.td, s.right, { width: `${cols[1] * 100}%` }]}>{Number(it.quantity)}</Text>
            <Text style={[s.td, s.right, { width: `${cols[2] * 100}%` }]}>{formatCents(it.netUnitPriceCents)}</Text>
            <Text style={[s.td, s.right, { width: `${cols[3] * 100}%` }]}>{it.taxRateBp / 100}%</Text>
            <Text style={[s.td, s.right, { width: `${cols[4] * 100}%` }]}>{formatCents(it.baseCents)}</Text>
            <Text style={[s.td, s.right, { width: `${cols[5] * 100}%` }]}>{formatCents(it.totalCents)}</Text>
          </View>
        ))}

        <View style={[s.row, { marginTop: 14, justifyContent: "space-between" }]}>
          <View style={{ width: "45%" }}>
            {qrDataUrl && (
              <View style={s.row}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={qrDataUrl} style={{ width: 80, height: 80 }} />
                <View style={{ marginLeft: 6, justifyContent: "center", width: 140 }}>
                  <Text style={s.bold}>QR tributario</Text>
                  <Text style={s.muted}>Factura verificable en la sede electrónica de la AEAT</Text>
                </View>
              </View>
            )}
            {payments.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={s.bold}>Forma de pago</Text>
                {payments.map((p) => <Text key={p.id}>{METHOD[p.method]}: {formatCents(p.amountCents)}</Text>)}
              </View>
            )}
          </View>
          <View style={{ width: "45%" }}>
            {breakdown.map((b) => (
              <View key={b.taxRate} style={[s.row, { justifyContent: "space-between" }]}>
                <Text>Base {TAX_RATE_LABEL[b.taxRate]}</Text>
                <Text>{formatCents(b.baseCents)}  ·  Cuota {formatCents(b.taxCents)}</Text>
              </View>
            ))}
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}><Text>Base imponible</Text><Text>{formatCents(inv.subtotalCents)}</Text></View>
            <View style={[s.row, { justifyContent: "space-between" }]}><Text>Total IVA</Text><Text>{formatCents(inv.taxCents)}</Text></View>
            {inv.withholdingCents > 0 && (
              <View style={[s.row, { justifyContent: "space-between" }]}><Text>Retención IRPF ({inv.withholdingRate / 100}%)</Text><Text>-{formatCents(inv.withholdingCents)}</Text></View>
            )}
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4, borderTopWidth: 1, paddingTop: 4 }]}>
              <Text style={[s.bold, { fontSize: 12 }]}>TOTAL</Text><Text style={[s.bold, { fontSize: 12 }]}>{formatCents(inv.totalCents)}</Text>
            </View>
            {inv.type === "SIMPLIFIED" && <Text style={[s.muted, { marginTop: 4 }]}>IVA incluido</Text>}
          </View>
        </View>

        <View style={{ position: "absolute", bottom: 28, left: 36, right: 36 }} fixed>
          <Text style={[s.muted, { fontSize: 7 }]}>Huella: {inv.hash}</Text>
          {registryInfo && <Text style={[s.muted, { fontSize: 7 }]}>{registryInfo}</Text>}
          <Text style={[s.muted, { fontSize: 7 }]}>
            Sus datos se tratan para la gestión de la relación comercial y obligaciones fiscales. Puede ejercer sus derechos RGPD en el email del emisor.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
