/* eslint-disable @next/next/no-img-element */
import type { PhotoKind } from "@prisma/client";

const LABEL: Record<PhotoKind, string> = { BEFORE: "Antes", AFTER: "Después", DETAIL: "Detalle" };

export function BeforeAfterGallery({ photos }: { photos: { id: string; kind: PhotoKind; url: string }[] }) {
  if (!photos.length) return null;
  const order: PhotoKind[] = ["BEFORE", "AFTER", "DETAIL"];
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[...photos].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).map((p) => (
        <figure key={p.id} className="relative overflow-hidden rounded-lg border">
          <img src={p.url} alt={LABEL[p.kind]} className="aspect-square w-full object-cover" loading="lazy" />
          <figcaption className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">{LABEL[p.kind]}</figcaption>
        </figure>
      ))}
    </div>
  );
}
