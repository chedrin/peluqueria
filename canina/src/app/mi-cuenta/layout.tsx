import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { requirePageRole } from "@/lib/auth";
import { logoutAction } from "@/features/auth/server/auth.actions";

const NAV = [
  { href: "/mi-cuenta", label: "Resumen" },
  { href: "/mi-cuenta/mascotas", label: "Mis mascotas" },
  { href: "/mi-cuenta/citas", label: "Mis citas" },
  { href: "/mi-cuenta/fidelidad", label: "Saldo y fidelidad" },
];

export default async function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageRole(["CLIENT"]);
  return (
    <>
      <PublicHeader />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          <p className="hidden px-3 text-sm text-muted-foreground md:block">Hola, {s.name}</p>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-muted">{n.label}</Link>
          ))}
          <form action={logoutAction}><button className="px-3 py-2 text-sm text-muted-foreground hover:underline">Salir</button></form>
        </nav>
        <main>{children}</main>
      </div>
      <PublicFooter />
    </>
  );
}
