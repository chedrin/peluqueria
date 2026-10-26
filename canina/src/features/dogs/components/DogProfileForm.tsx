"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { CoatCondition, CoatType, DogSize, Temperament, ToleranceLevel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { COAT_LABEL, SIZE_LABEL } from "@/features/catalog/domain/pricing";
import { updateDogAction } from "../server/dog.actions";

type DogFormData = {
  id: string; name: string; breedText: string | null; sex: string | null; birthDate: string; size: DogSize; coatType: CoatType;
  coatCondition: CoatCondition; coatColor: string | null; temperament: Temperament; handlingNotes: string | null;
  toleratesDryer: ToleranceLevel; toleratesBlower: ToleranceLevel; allowsNailTrim: ToleranceLevel; needsMuzzle: boolean;
  favoriteTreats: string | null; allowedTreats: string | null; favoriteToys: string | null;
};

const TOL = { YES: "Sí", PARTIAL: "Con dificultad", NO: "No", UNKNOWN: "Sin probar" };

export function DogProfileForm({ dog }: { dog: DogFormData }) {
  const [pending, start] = useTransition();
  const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
  const Sel = ({ name, value, options }: { name: string; value: string; options: Record<string, string> }) => (
    <NativeSelect name={name} defaultValue={value}>{Object.entries(options).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
  );
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      action={(fd) =>
        start(async () => {
          const r = await updateDogAction({
            dogId: dog.id, name: s(fd, "name"), breedText: s(fd, "breedText"), sex: s(fd, "sex"), birthDate: s(fd, "birthDate"),
            size: s(fd, "size") as DogSize, coatType: s(fd, "coatType") as CoatType, coatCondition: s(fd, "coatCondition") as CoatCondition,
            coatColor: s(fd, "coatColor"), temperament: s(fd, "temperament") as Temperament, handlingNotes: s(fd, "handlingNotes"),
            toleratesDryer: s(fd, "toleratesDryer") as ToleranceLevel, toleratesBlower: s(fd, "toleratesBlower") as ToleranceLevel,
            allowsNailTrim: s(fd, "allowsNailTrim") as ToleranceLevel, needsMuzzle: fd.get("needsMuzzle") === "on",
            favoriteTreats: s(fd, "favoriteTreats"), allowedTreats: s(fd, "allowedTreats"), favoriteToys: s(fd, "favoriteToys"),
          });
          if (r.ok) toast.success("Ficha guardada");
          else toast.error(r.message);
        })
      }
    >
      <fieldset className="contents">
        <div className="space-y-1"><Label>Nombre</Label><Input name="name" defaultValue={dog.name} /></div>
        <div className="space-y-1"><Label>Raza</Label><Input name="breedText" defaultValue={dog.breedText ?? ""} /></div>
        <div className="space-y-1"><Label>Sexo</Label><Sel name="sex" value={dog.sex ?? ""} options={{ "": "—", M: "Macho", F: "Hembra" }} /></div>
        <div className="space-y-1"><Label>Nacimiento</Label><Input type="date" name="birthDate" defaultValue={dog.birthDate} /></div>
        <div className="space-y-1"><Label>Tamaño</Label><Sel name="size" value={dog.size} options={SIZE_LABEL} /></div>
        <div className="space-y-1"><Label>Tipo de pelo</Label><Sel name="coatType" value={dog.coatType} options={COAT_LABEL} /></div>
        <div className="space-y-1"><Label>Estado del pelaje</Label><Sel name="coatCondition" value={dog.coatCondition} options={{ GOOD: "Bueno", KNOTS: "Nudos", MATTED: "Enredos severos", SHEDDING: "En muda" }} /></div>
        <div className="space-y-1"><Label>Color</Label><Input name="coatColor" defaultValue={dog.coatColor ?? ""} /></div>
      </fieldset>

      <h4 className="pt-2 font-semibold sm:col-span-3">Temperamento y manejo</h4>
      <div className="space-y-1"><Label>Carácter</Label><Sel name="temperament" value={dog.temperament} options={{ DOCILE: "Dócil", NERVOUS: "Nervioso", FEARFUL: "Miedoso", REACTIVE: "Reactivo", AGGRESSIVE: "Agresivo" }} /></div>
      <div className="space-y-1"><Label>Tolera secador</Label><Sel name="toleratesDryer" value={dog.toleratesDryer} options={TOL} /></div>
      <div className="space-y-1"><Label>Tolera expulsador</Label><Sel name="toleratesBlower" value={dog.toleratesBlower} options={TOL} /></div>
      <div className="space-y-1"><Label>Admite corte de uñas</Label><Sel name="allowsNailTrim" value={dog.allowsNailTrim} options={TOL} /></div>
      <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" name="needsMuzzle" defaultChecked={dog.needsMuzzle} /> Necesita bozal</label>
      <div className="space-y-1 sm:col-span-3"><Label>Cómo manipularlo</Label><Textarea name="handlingNotes" defaultValue={dog.handlingNotes ?? ""} placeholder="Ej.: sujetar por el pecho, no tocar patas traseras…" /></div>

      <h4 className="pt-2 font-semibold sm:col-span-3">Preferencias</h4>
      <div className="space-y-1"><Label>Premios favoritos</Label><Input name="favoriteTreats" defaultValue={dog.favoriteTreats ?? ""} /></div>
      <div className="space-y-1"><Label>Chuches permitidas</Label><Input name="allowedTreats" defaultValue={dog.allowedTreats ?? ""} /></div>
      <div className="space-y-1"><Label>Juguetes favoritos</Label><Input name="favoriteToys" defaultValue={dog.favoriteToys ?? ""} /></div>
      <div className="sm:col-span-3"><Button disabled={pending}>Guardar ficha</Button></div>
    </form>
  );
}
