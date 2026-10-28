"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: React.ReactNode; badge?: React.ReactNode; content: React.ReactNode };

/**
 * Pestañas accesibles (role=tablist, flechas izquierda/derecha). Todos los paneles
 * quedan montados y solo se ocultan, así un formulario a medias no pierde lo escrito.
 */
export function Tabs({ items, initial, label, className }: { items: TabItem[]; initial?: string; label: string; className?: string }) {
  const [active, setActive] = React.useState(initial ?? items[0]?.id);
  const baseId = React.useId();
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = items[(i + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length];
    setActive(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="mb-4 flex gap-1 overflow-x-auto border-b">
        {items.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${t.id}`}
            aria-controls={`${baseId}-panel-${t.id}`}
            aria-selected={active === t.id}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              active === t.id ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      {items.map((t) => (
        <div key={t.id} role="tabpanel" id={`${baseId}-panel-${t.id}`} aria-labelledby={`${baseId}-tab-${t.id}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
