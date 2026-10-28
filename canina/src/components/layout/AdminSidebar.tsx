"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Euro, Gift, House, PawPrint, Scissors, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Inicio", icon: House, exact: true },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/clientes", label: "Clientes y perros", icon: Users },
  { href: "/admin/servicios", label: "Servicios y tarifas", icon: Scissors },
  { href: "/admin/bonos", label: "Bonos", icon: Gift },
  { href: "/admin/fidelidad", label: "Fidelización", icon: Star },
  { href: "/admin/facturas", label: "Caja y facturas", icon: Euro },
];

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administración", RECEPTION: "Recepción", GROOMER: "Peluquería" };

export function AdminSidebar({ name, role }: { name: string; role: string }) {
  const path = usePathname();
  // La ficha del perro y la caja cuelgan de otras secciones del menú
  const current = path.startsWith("/admin/perros") ? "/admin/clientes" : path.startsWith("/admin/caja") ? "/admin/facturas" : path;
  return (
    <aside className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card p-2 md:sticky md:top-0 md:h-dvh md:w-60 md:flex-col md:border-b-0 md:border-r md:p-3">
      <Link href="/admin" className="mb-5 hidden items-center gap-2 px-2 pt-1 text-lg font-bold tracking-tight md:flex">
        <PawPrint className="size-5 text-primary" /> CANIA
      </Link>
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? current === href : current.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}>
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
      <div className="mt-auto hidden items-center gap-2.5 border-t px-2 pt-3 md:flex">
        <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="flex flex-col text-sm leading-tight">
          <strong className="font-semibold">{name}</strong>
          <span className="text-xs text-muted-foreground">{ROLE_LABEL[role] ?? role}</span>
        </span>
      </div>
    </aside>
  );
}
