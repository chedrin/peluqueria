import Link from "next/link";
import { PawPrint } from "lucide-react";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";

export async function PublicHeader() {
  const s = await getSession();
  const area = s ? (STAFF_ROLES.includes(s.role) ? "/admin/agenda" : "/mi-cuenta") : null;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <PawPrint className="size-5 text-primary" /> CANIA
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm sm:gap-4">
          <Link href="/#servicios" className="hidden hover:underline sm:inline">Servicios</Link>
          {area ? (
            <Link href={area} className="hover:underline">Mi área</Link>
          ) : (
            <Link href="/login" className="hover:underline">Entrar</Link>
          )}
          <Link href="/reservar" className={buttonVariants({ size: "sm" })}>Reservar cita</Link>
        </nav>
      </div>
    </header>
  );
}
