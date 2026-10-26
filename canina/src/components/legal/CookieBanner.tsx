"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CONSENT_COOKIE,
  COOKIE_CATEGORIES,
  COOKIE_CONSENT_VERSION,
  parseConsent,
  type CookieCategories,
} from "@/features/legal/domain/cookies";

function readCookie(name: string) {
  return document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1];
}

/**
 * Banner de cookies conforme a la Guía de la AEPD:
 *  - "Rechazar" al mismo nivel que "Aceptar" (sin dark patterns).
 *  - Configuración granular por finalidad, nada pre-marcado.
 *  - El consentimiento se registra en servidor (CookieConsentLog) como prueba.
 *  - Reabrible desde el pie con el evento `cania:open-cookies`.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [prefs, setPrefs] = useState<CookieCategories>({ necessary: true, preferences: false, analytics: false, marketing: false });

  useEffect(() => {
    const existing = parseConsent(readCookie(CONSENT_COOKIE));
    if (!existing) setOpen(true);
    else setPrefs(existing);
    const reopen = () => {
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener("cania:open-cookies", reopen);
    return () => window.removeEventListener("cania:open-cookies", reopen);
  }, []);

  async function save(p: CookieCategories) {
    const value = { ...p, version: COOKIE_CONSENT_VERSION };
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
    setOpen(false);
    await fetch("/api/cookie-consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }).catch(() => {});
    window.dispatchEvent(new CustomEvent("cania:cookies-updated", { detail: value }));
  }

  if (!open) return null;
  return (
    <div role="dialog" aria-label="Configuración de cookies" className="fixed inset-x-0 bottom-0 z-[60] border-t bg-card p-4 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-md sm:rounded-xl sm:border">
      <p className="mb-2 font-semibold">🍪 Usamos cookies</p>
      <p className="mb-3 text-sm text-muted-foreground">
        Usamos cookies técnicas necesarias y, con tu permiso, analíticas y de marketing. Más info en la{" "}
        <Link href="/legal/cookies" className="underline">política de cookies</Link>.
      </p>
      {custom && (
        <div className="mb-3 space-y-2">
          {COOKIE_CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={prefs[c.key]}
                disabled={c.locked}
                onChange={(e) => setPrefs((p) => ({ ...p, [c.key]: e.target.checked }))}
              />
              <span>
                <strong>{c.title}</strong>
                <span className="block text-muted-foreground">{c.description}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button variant="outline" onClick={() => save({ necessary: true, preferences: false, analytics: false, marketing: false })}>Rechazar</Button>
        {custom ? (
          <Button variant="outline" onClick={() => save(prefs)}>Guardar</Button>
        ) : (
          <Button variant="outline" onClick={() => setCustom(true)}>Configurar</Button>
        )}
        <Button className="col-span-2 sm:col-span-1" onClick={() => save({ necessary: true, preferences: true, analytics: true, marketing: true })}>Aceptar todo</Button>
      </div>
    </div>
  );
}

export function OpenCookieSettings() {
  return (
    <button type="button" className="hover:underline" onClick={() => window.dispatchEvent(new Event("cania:open-cookies"))}>
      Configurar cookies
    </button>
  );
}
