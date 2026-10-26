/** Categorías de cookies según la Guía de cookies de la AEPD (2023). */
export const COOKIE_CONSENT_VERSION = "2026-10";
export const CONSENT_COOKIE = "cania_cookie_consent";

export type CookieCategories = { necessary: true; preferences: boolean; analytics: boolean; marketing: boolean };

export const COOKIE_CATEGORIES: { key: keyof CookieCategories; title: string; description: string; locked?: boolean }[] = [
  { key: "necessary", title: "Técnicas (necesarias)", description: "Sesión, seguridad y recordar tu elección de cookies. No requieren consentimiento.", locked: true },
  { key: "preferences", title: "Preferencias", description: "Recuerdan opciones como tu peluquero favorito o idioma." },
  { key: "analytics", title: "Analíticas", description: "Medición anónima de uso para mejorar la web." },
  { key: "marketing", title: "Marketing", description: "Publicidad personalizada y redes sociales." },
];

export function parseConsent(raw: string | undefined): (CookieCategories & { version: string }) | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw));
    return v.version === COOKIE_CONSENT_VERSION ? v : null; // nueva versión → volver a preguntar
  } catch {
    return null;
  }
}
