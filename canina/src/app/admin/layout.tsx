import { requirePageRole } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/session";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePageRole(STAFF_ROLES);
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AdminSidebar name={s.name} role={s.role} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
