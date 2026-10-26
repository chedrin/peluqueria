import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/session";
import { InvoicePdf } from "@/features/billing/pdf/InvoicePdf";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("No autorizado", { status: 401 });

  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } }, payments: true, rectifies: { select: { fullNumber: true } } },
  });
  if (!inv || inv.status === "DRAFT") return new Response("No encontrada", { status: 404 });
  // Un cliente solo puede descargar sus propias facturas
  if (!STAFF_ROLES.includes(session.role) && inv.ownerId !== session.ownerId) return new Response("Prohibido", { status: 403 });

  const settings = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  const qrDataUrl = inv.qrPayload ? await QRCode.toDataURL(inv.qrPayload, { margin: 0, width: 240 }) : undefined;
  const buffer = await renderToBuffer(
    InvoicePdf({ invoice: inv, items: inv.items, payments: inv.payments, qrDataUrl, registryInfo: settings?.registryInfo, rectifiedNumber: inv.rectifies?.fullNumber }),
  );
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${inv.fullNumber}.pdf"` },
  });
}
