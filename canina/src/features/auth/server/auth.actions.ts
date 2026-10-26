"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { endSession, startSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/session";
import { PRIVACY_POLICY_VERSION, CANCELLATION_POLICY_VERSION } from "@/features/legal/domain/policies";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | undefined;

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Introduce email y contraseña." };
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { ownerProfile: true, staffProfile: true },
  });
  if (!user?.passwordHash || !user.isActive || !(await bcrypt.compare(parsed.data.password, user.passwordHash)))
    return { error: "Credenciales incorrectas." };

  await startSession({
    sub: user.id,
    role: user.role,
    name: user.firstName,
    ownerId: user.ownerProfile?.id,
    staffId: user.staffProfile?.id,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(prisma, { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id });
  redirect(STAFF_ROLES.includes(user.role) ? "/admin/agenda" : String(form.get("next") || "/mi-cuenta"));
}

const registerSchema = z.object({
  firstName: z.string().min(2, "Nombre demasiado corto"),
  lastName: z.string().min(2, "Apellidos demasiado cortos"),
  email: z.string().email("Email no válido"),
  phone: z.string().regex(/^\+?\d[\d\s]{8,14}$/, "Teléfono no válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  // RGPD: la aceptación debe ser una acción afirmativa (casilla NO pre-marcada)
  acceptPrivacy: z.literal("on", { message: "Debes aceptar la política de privacidad" }),
  acceptCancellation: z.literal("on", { message: "Debes aceptar la política de cancelación" }),
  marketingWhatsapp: z.literal("on").optional(),
  marketingEmail: z.literal("on").optional(),
  imageRights: z.literal("on").optional(),
});

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  const email = d.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) return { error: "Ya existe una cuenta con ese email." };

  const h = await headers();
  const meta = { ipAddress: h.get("x-forwarded-for")?.split(",")[0] ?? null, userAgent: h.get("user-agent") };

  const user = await prisma.user.create({
    data: {
      email,
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      role: "CLIENT",
      passwordHash: await bcrypt.hash(d.password, 12),
      ownerProfile: { create: { whatsapp: d.phone } },
      consents: {
        create: [
          { purpose: "PRIVACY_POLICY", granted: true, policyVersion: PRIVACY_POLICY_VERSION, ...meta },
          { purpose: "CANCELLATION_POLICY", granted: true, policyVersion: CANCELLATION_POLICY_VERSION, ...meta },
          { purpose: "MARKETING_WHATSAPP", granted: !!d.marketingWhatsapp, policyVersion: PRIVACY_POLICY_VERSION, ...meta },
          { purpose: "MARKETING_EMAIL", granted: !!d.marketingEmail, policyVersion: PRIVACY_POLICY_VERSION, ...meta },
          { purpose: "IMAGE_RIGHTS", granted: !!d.imageRights, policyVersion: PRIVACY_POLICY_VERSION, ...meta },
        ],
      },
    },
    include: { ownerProfile: true },
  });
  await prisma.loyaltyCard.create({
    data: { ownerId: user.ownerProfile!.id, cardNumber: `CAN-${Date.now().toString(36).toUpperCase()}` },
  });
  await audit(prisma, { actorId: user.id, action: "CREATE", entity: "User", entityId: user.id });
  await startSession({ sub: user.id, role: "CLIENT", name: user.firstName, ownerId: user.ownerProfile!.id });
  redirect(String(form.get("next") || "/mi-cuenta/mascotas"));
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}
