import "server-only";
import type { ContactChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Capa de notificaciones con "adaptadores". En desarrollo (sin credenciales)
 * solo registra en NotificationLog y consola. Para producción:
 *  - EMAIL: SMTP (nodemailer) o Resend.
 *  - WHATSAPP: WhatsApp Cloud API (plantillas aprobadas por Meta).
 */
type Message = { channel: ContactChannel; to: string; template: string; body: string; appointmentId?: string };

async function deliver(m: Message): Promise<void> {
  if (m.channel === "WHATSAPP" && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: m.to.replace(/\D/g, ""), type: "text", text: { body: m.body } }),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}`);
    return;
  }
  console.info(`[notificación:${m.channel}] → ${m.to}: ${m.body}`);
}

export async function sendNotification(m: Message) {
  try {
    await deliver(m);
    await prisma.notificationLog.create({ data: { channel: m.channel, to: m.to, template: m.template, appointmentId: m.appointmentId, status: "SENT" } });
  } catch (e) {
    await prisma.notificationLog.create({
      data: { channel: m.channel, to: m.to, template: m.template, appointmentId: m.appointmentId, status: "FAILED", error: String(e) },
    });
  }
}

/** Notifica al dueño por su canal preferido. */
export async function notifyAppointmentChange(appointmentId: string, body: string, template = "appointment_changed") {
  const a = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { owner: { include: { user: true } } },
  });
  if (!a) return;
  const o = a.owner;
  const channel = o.preferredChannel;
  const to = channel === "EMAIL" ? o.user.email : (o.whatsapp ?? o.user.phone ?? o.user.email);
  await sendNotification({ channel: to.includes("@") ? "EMAIL" : channel, to, template, body, appointmentId });
}
