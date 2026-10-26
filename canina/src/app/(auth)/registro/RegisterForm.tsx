"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/features/auth/server/auth.actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function Field({ name, label, type = "text", errors, autoComplete }: { name: string; label: string; type?: string; errors?: string[]; autoComplete?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} autoComplete={autoComplete} required />
      {errors?.[0] && <p className="text-xs text-destructive">{errors[0]}</p>}
    </div>
  );
}

function Check({ name, children, errors }: { name: string; children: React.ReactNode; errors?: string[] }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      {/* RGPD: casilla sin pre-marcar */}
      <input type="checkbox" name={name} className="mt-1" />
      <span>
        {children}
        {errors?.[0] && <span className="block text-xs text-destructive">{errors[0]}</span>}
      </span>
    </label>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(registerAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="firstName" label="Nombre" errors={fe.firstName} autoComplete="given-name" />
        <Field name="lastName" label="Apellidos" errors={fe.lastName} autoComplete="family-name" />
      </div>
      <Field name="email" label="Email" type="email" errors={fe.email} autoComplete="email" />
      <Field name="phone" label="Teléfono / WhatsApp" type="tel" errors={fe.phone} autoComplete="tel" />
      <Field name="password" label="Contraseña" type="password" errors={fe.password} autoComplete="new-password" />

      <div className="space-y-2 rounded-lg bg-muted/60 p-3">
        <Check name="acceptPrivacy" errors={fe.acceptPrivacy}>
          He leído y acepto la <Link href="/legal/privacidad" target="_blank" className="underline">política de privacidad</Link>. *
        </Check>
        <Check name="acceptCancellation" errors={fe.acceptCancellation}>
          Acepto la <Link href="/legal/cancelacion" target="_blank" className="underline">política de cancelación</Link>. *
        </Check>
        <Check name="marketingWhatsapp">Quiero recibir ofertas por WhatsApp (opcional).</Check>
        <Check name="marketingEmail">Quiero recibir novedades por email (opcional).</Check>
        <Check name="imageRights">Autorizo publicar fotos «antes y después» de mi perro en redes sociales (opcional).</Check>
        <p className="text-xs text-muted-foreground">
          Responsable: [RAZÓN SOCIAL]. Finalidad: gestión de citas y facturación. Derechos: acceso, rectificación, supresión y otros, ver política de privacidad.
        </p>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button className="w-full" disabled={pending}>{pending ? "Creando…" : "Crear cuenta"}</Button>
    </form>
  );
}
