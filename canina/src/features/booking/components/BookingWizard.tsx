"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Dog, Plus } from "lucide-react";
import { toast } from "sonner";
import type { DogSize } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { SIZE_LABEL, COAT_LABEL } from "@/features/catalog/domain/pricing";
import { createDogAction } from "@/features/dogs/server/dog.actions";
import { availabilityAction, bookOnlineAction } from "../server/booking.actions";

type DogOpt = { id: string; name: string; size: DogSize; breed: string };
type ServiceOpt = { id: string; name: string; description: string | null; basePriceCents: number; baseDurationMin: number; category: string };
type StaffOpt = { id: string; displayName: string; color: string };
type Availability = Extract<Awaited<ReturnType<typeof availabilityAction>>, { ok: true }>["data"];

const STEPS = ["Mascota", "Servicios", "Peluquero", "Fecha y hora", "Confirmar"];

function nextDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD local
  });
}

export function BookingWizard(props: { dogs: DogOpt[]; services: ServiceOpt[]; staff: StaffOpt[]; favoriteStaffId: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dogs, setDogs] = useState(props.dogs);
  const [dogId, setDogId] = useState<string | null>(props.dogs[0]?.id ?? null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string | null>(props.favoriteStaffId);
  const [day, setDay] = useState(nextDays(1)[0]);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [slot, setSlot] = useState<{ staffId: string; start: number; label: string } | null>(null);
  const [notes, setNotes] = useState("");
  const [accept, setAccept] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (step !== 3 || !dogId || !serviceIds.length) return;
    setSlot(null);
    start(async () => {
      const r = await availabilityAction({ day, dogId, serviceIds, staffId });
      if (r.ok) setAvail(r.data);
      else toast.error(r.message);
    });
  }, [step, day, dogId, serviceIds, staffId]);

  const canNext = [!!dogId, serviceIds.length > 0, true, !!slot, accept][step];

  function confirm() {
    if (!slot || !dogId) return;
    start(async () => {
      const r = await bookOnlineAction({ dogId, serviceIds, staffId: slot.staffId, day, startMin: slot.start, notes, acceptCancellation: true });
      if (!r.ok) return void toast.error(r.message);
      toast.success("¡Reserva enviada! Te hemos enviado la confirmación.");
      router.push("/mi-cuenta/citas");
    });
  }

  const byCategory = props.services.reduce<Record<string, ServiceOpt[]>>((acc, s) => ((acc[s.category] ??= []).push(s), acc), {});

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <ol className="mb-6 flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-1 rounded-full border px-3 py-1", i === step && "border-primary bg-primary text-primary-foreground", i < step && "bg-secondary")}>
              {i < step ? <Check className="size-3" /> : <span>{i + 1}</span>} {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {dogs.map((d) => (
                <button key={d.id} type="button" onClick={() => setDogId(d.id)} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left", dogId === d.id && "border-primary ring-2 ring-primary/30")}>
                  <Dog className="size-8 text-primary" />
                  <span>
                    <span className="block font-semibold">{d.name}</span>
                    <span className="text-sm text-muted-foreground">{d.breed} · {SIZE_LABEL[d.size]}</span>
                  </span>
                </button>
              ))}
            </div>
            <QuickDogForm onCreated={(d) => { setDogs((x) => [...x, d]); setDogId(d.id); }} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            {Object.entries(byCategory).map(([cat, list]) => (
              <div key={cat}>
                <h3 className="mb-2 font-semibold">{cat}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((s) => {
                    const on = serviceIds.includes(s.id);
                    return (
                      <button key={s.id} type="button" onClick={() => setServiceIds((x) => (on ? x.filter((i) => i !== s.id) : [...x, s.id]))}
                        className={cn("rounded-lg border p-3 text-left text-sm", on && "border-primary bg-primary/5")}>
                        <span className="flex justify-between font-medium">{s.name} {on && <Check className="size-4 text-primary" />}</span>
                        <span className="text-muted-foreground">desde {formatCents(s.basePriceCents)} · ~{s.baseDurationMin} min</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => setStaffId(null)} className={cn("rounded-lg border p-4 text-left", staffId === null && "border-primary bg-primary/5")}>
              <span className="font-medium">Cualquiera</span>
              <span className="block text-xs text-muted-foreground">Más huecos disponibles</span>
            </button>
            {props.staff.map((s) => (
              <button key={s.id} type="button" onClick={() => setStaffId(s.id)} className={cn("rounded-lg border p-4 text-left", staffId === s.id && "border-primary bg-primary/5")}>
                <span className="flex items-center gap-2 font-medium"><span className="size-3 rounded-full" style={{ background: s.color }} /> {s.displayName}</span>
                {s.id === props.favoriteStaffId && <span className="text-xs text-muted-foreground">Tu favorito</span>}
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {nextDays(21).map((d) => {
                const date = new Date(`${d}T12:00:00`);
                return (
                  <button key={d} type="button" onClick={() => setDay(d)} className={cn("min-w-16 rounded-lg border px-3 py-2 text-center text-sm", day === d && "border-primary bg-primary text-primary-foreground")}>
                    <span className="block text-xs capitalize">{date.toLocaleDateString("es-ES", { weekday: "short" })}</span>
                    <span className="text-lg font-semibold">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
            {pending && <p className="text-sm text-muted-foreground">Buscando huecos libres…</p>}
            {!pending && avail && avail.slots.length === 0 && <p className="text-sm text-muted-foreground">No quedan huecos este día. Prueba otro día u otro peluquero.</p>}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {avail?.slots.map((s) => (
                <button key={`${s.staffId}-${s.start}`} type="button" onClick={() => setSlot(s)}
                  className={cn("rounded-md border py-2 text-sm", slot?.start === s.start && slot.staffId === s.staffId && "border-primary bg-primary text-primary-foreground")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notes">¿Algo que debamos saber? (opcional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: tiene la pata derecha sensible" maxLength={500} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>Acepto la <Link href="/legal/cancelacion" target="_blank" className="underline">política de cancelación</Link> (cancelación gratuita hasta 24 h antes).</span>
            </label>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Atrás</Button>
          {step < 4 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continuar</Button>
          ) : (
            <Button disabled={!canNext || pending} onClick={confirm}>{pending ? "Reservando…" : "Confirmar reserva"}</Button>
          )}
        </div>
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Mascota:</span> {dogs.find((d) => d.id === dogId)?.name ?? "—"}</p>
          <p><span className="text-muted-foreground">Peluquero:</span> {props.staff.find((s) => s.id === (slot?.staffId ?? staffId))?.displayName ?? "Cualquiera"}</p>
          {slot && <p><span className="text-muted-foreground">Cuándo:</span> {day} a las {slot.label}</p>}
          {avail ? (
            <>
              <ul className="border-t pt-2">
                {avail.quote.lines.map((l) => (
                  <li key={l.serviceId} className="flex justify-between"><span>{l.name}</span><span>{formatCents(l.priceCents)}</span></li>
                ))}
              </ul>
              <p className="flex justify-between border-t pt-2 font-semibold"><span>Total estimado</span><span>{formatCents(avail.quote.totalCents)}</span></p>
              <p className="text-xs text-muted-foreground">Duración aprox. {avail.quote.totalMin} min · IVA incluido</p>
            </>
          ) : (
            <p className="text-muted-foreground">{serviceIds.length} servicio(s) seleccionados</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuickDogForm({ onCreated }: { onCreated: (d: DogOpt) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <Button variant="outline" onClick={() => setOpen(true)}><Plus /> Añadir otra mascota</Button>
    );
  return (
    <form
      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
      action={(fd) =>
        start(async () => {
          const r = await createDogAction({
            name: String(fd.get("name")),
            breedText: String(fd.get("breed") || "") || undefined,
            weightKg: Number(fd.get("weight")),
            coatType: fd.get("coat") as "SHORT",
            temperament: fd.get("temperament") as "DOCILE",
            healthNotes: String(fd.get("health") || "") || undefined,
          });
          if (!r.ok) return void toast.error(r.message);
          onCreated({ id: r.data.id, name: r.data.name, size: r.data.size, breed: String(fd.get("breed") || "") });
          setOpen(false);
        })
      }
    >
      <div className="space-y-1.5"><Label>Nombre</Label><Input name="name" required /></div>
      <div className="space-y-1.5"><Label>Raza</Label><Input name="breed" placeholder="Caniche, mestizo…" /></div>
      <div className="space-y-1.5"><Label>Peso aprox. (kg)</Label><Input name="weight" type="number" step="0.1" min="0.5" required /></div>
      <div className="space-y-1.5">
        <Label>Tipo de pelo</Label>
        <NativeSelect name="coat">{Object.entries(COAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label>Carácter</Label>
        <NativeSelect name="temperament">
          <option value="DOCILE">Tranquilo</option><option value="NERVOUS">Nervioso</option><option value="FEARFUL">Miedoso</option><option value="REACTIVE">Reactivo</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5"><Label>Alergias o problemas de salud</Label><Input name="health" placeholder="Opcional" /></div>
      <div className="sm:col-span-2"><Button disabled={pending}>Guardar mascota</Button></div>
    </form>
  );
}
