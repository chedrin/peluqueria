"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ContactChannel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { updateOwnerAction } from "../server/owner.actions";

type Owner = {
  id: string; phone: string | null; whatsapp: string | null; taxId: string | null; address: string | null; postalCode: string | null;
  city: string | null; province: string | null; preferredChannel: ContactChannel; preferredCutStyle: string | null; personalNotes: string | null; favoriteGroomerId: string | null;
};

export function OwnerForm({ owner, staff }: { owner: Owner; staff: { id: string; displayName: string }[] }) {
  const [pending, start] = useTransition();
  const f = (k: string, fd: FormData) => String(fd.get(k) ?? "");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      action={(fd) =>
        start(async () => {
          const r = await updateOwnerAction({
            ownerId: owner.id, phone: f("phone", fd), whatsapp: f("whatsapp", fd), taxId: f("taxId", fd), address: f("address", fd),
            postalCode: f("postalCode", fd), city: f("city", fd), province: f("province", fd), preferredChannel: f("preferredChannel", fd) as ContactChannel,
            preferredCutStyle: f("preferredCutStyle", fd), personalNotes: f("personalNotes", fd), favoriteGroomerId: f("favoriteGroomerId", fd),
          });
          if (r.ok) toast.success("Cliente actualizado");
          else toast.error(r.message);
        })
      }
    >
      <div className="space-y-1"><Label>Teléfono</Label><Input name="phone" defaultValue={owner.phone ?? ""} /></div>
      <div className="space-y-1"><Label>WhatsApp</Label><Input name="whatsapp" defaultValue={owner.whatsapp ?? ""} /></div>
      <div className="space-y-1"><Label>NIF / DNI / NIE</Label><Input name="taxId" defaultValue={owner.taxId ?? ""} /></div>
      <div className="space-y-1"><Label>Canal preferido</Label>
        <NativeSelect name="preferredChannel" defaultValue={owner.preferredChannel}>
          <option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="PHONE">Teléfono</option>
        </NativeSelect>
      </div>
      <div className="space-y-1 sm:col-span-2"><Label>Dirección</Label><Input name="address" defaultValue={owner.address ?? ""} /></div>
      <div className="space-y-1"><Label>C.P.</Label><Input name="postalCode" defaultValue={owner.postalCode ?? ""} /></div>
      <div className="space-y-1"><Label>Ciudad</Label><Input name="city" defaultValue={owner.city ?? ""} /></div>
      <div className="space-y-1"><Label>Provincia</Label><Input name="province" defaultValue={owner.province ?? ""} /></div>
      <div className="space-y-1"><Label>Peluquero favorito</Label>
        <NativeSelect name="favoriteGroomerId" defaultValue={owner.favoriteGroomerId ?? ""}>
          <option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
        </NativeSelect>
      </div>
      <div className="space-y-1 sm:col-span-2"><Label>Estilo de corte preferido</Label><Input name="preferredCutStyle" defaultValue={owner.preferredCutStyle ?? ""} /></div>
      <div className="space-y-1 sm:col-span-2"><Label>Notas de trato personal</Label><Textarea name="personalNotes" defaultValue={owner.personalNotes ?? ""} /></div>
      <div className="sm:col-span-2"><Button disabled={pending}>Guardar</Button></div>
    </form>
  );
}
