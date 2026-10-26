import Link from "next/link";
import { OpenCookieSettings } from "@/components/legal/CookieBanner";

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} CANIA · Peluquería y Estética Canina</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/legal/aviso-legal" className="hover:underline">Aviso legal</Link>
          <Link href="/legal/privacidad" className="hover:underline">Privacidad</Link>
          <Link href="/legal/cookies" className="hover:underline">Cookies</Link>
          <Link href="/legal/cancelacion" className="hover:underline">Cancelaciones</Link>
          <OpenCookieSettings />
        </nav>
      </div>
    </footer>
  );
}
