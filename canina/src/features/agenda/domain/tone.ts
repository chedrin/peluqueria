/**
 * Color de la tarjeta de cita según el servicio principal, para distinguir de un
 * vistazo baños, cortes, deslanados… El estado de la cita va aparte (texto + punto).
 */
export type ServiceTone = "bath" | "cut" | "deshed" | "strip" | "spa" | "other";

const RULES: [RegExp, ServiceTone][] = [
  [/deslan/i, "deshed"],
  [/stripp|arrancad/i, "strip"],
  [/spa|ozono|tratamiento|hidrata/i, "spa"],
  [/corte|tijera|estilis|arreglo/i, "cut"],
  [/baño|higiene|lavado/i, "bath"],
];

// Extras (uñas, glándulas…) no deciden el color si hay otro servicio en la cita
const EXTRA = /uñas|gl[aá]ndula|o[ií]dos|extra/i;

function toneOf(text: string): ServiceTone | null {
  return RULES.find(([re]) => re.test(text))?.[1] ?? null;
}

export function serviceTone(services: { name: string; category?: string | null }[]): ServiceTone {
  const main = services.filter((s) => !EXTRA.test(s.name) && !EXTRA.test(s.category ?? ""));
  for (const s of main.length ? main : services) {
    const t = toneOf(s.name) ?? toneOf(s.category ?? "");
    if (t) return t;
  }
  return "other";
}

export const TONE_META: Record<ServiceTone, { label: string; card: string; swatch: string }> = {
  bath: { label: "Baño", card: "bg-sky-50 text-sky-950", swatch: "bg-sky-300" },
  cut: { label: "Corte", card: "bg-amber-50 text-amber-950", swatch: "bg-amber-300" },
  deshed: { label: "Deslanado", card: "bg-teal-50 text-teal-950", swatch: "bg-teal-300" },
  strip: { label: "Stripping", card: "bg-violet-50 text-violet-950", swatch: "bg-violet-300" },
  spa: { label: "Spa", card: "bg-pink-50 text-pink-950", swatch: "bg-pink-300" },
  other: { label: "Otros", card: "bg-slate-50 text-slate-900", swatch: "bg-slate-300" },
};
