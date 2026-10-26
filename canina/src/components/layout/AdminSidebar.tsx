"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Dog, Euro, Gift, PawPrint, Scissors, Star, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/clientes", label: "Clientes y perros", icon: Users },
  { href: "/admin/servicios", label: "Servicios y tarifas", icon: Scissors },
  { href: "/admin/bonos", label: "Bonos", icon: Gift },
  { href: "/admin/fidelidad", label: "Fidelización", icon: Star },
  { href: "/admin/facturas", label: "Facturación", icon: Euro },
];

export function AdminSidebar({ name, role }: { name: string; role: string }) {
  const path = usePathname();
  return (
    <aside className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card p-2 md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:border-b-0 md:border-r md:p-3">
      <Link href="/admin/agenda" className="mb-4 hidden items-center gap-2 px-2 font-bold md:flex">
        <PawPrint className="size-5 text-primary" /> CANIA <span className="text-xs font-normal text-muted-foreground">admin</span>
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href}
          className={cn("flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm", path.startsWith(href) ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          <Icon className="size-4" /> {label}
        </Link>
      ))}
      <div className="mt-auto hidden px-2 text-xs text-muted-foreground md:block">
        <Dog className="mb-1 size-4" /> {name} · {role}
      </div>
    </aside>
  );
}
