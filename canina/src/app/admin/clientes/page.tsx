import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export const metadata = { title: "Clientes" };

export default async function OwnersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const owners = await prisma.ownerProfile.findMany({
    where: q
      ? {
          OR: [
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { phone: { contains: q } } },
            { dogs: { some: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : undefined,
    include: { user: true, dogs: { select: { id: true, name: true } }, _count: { select: { appointments: true } } },
    take: 100,
    orderBy: { user: { lastName: "asc" } },
  });
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Clientes y perros</h1>
        <form className="w-full max-w-xs"><Input name="q" defaultValue={q} placeholder="Buscar por dueño, perro, teléfono…" /></form>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <THead><TR><TH>Propietario</TH><TH>Contacto</TH><TH>Perros</TH><TH className="text-right">Citas</TH></TR></THead>
          <TBody>
            {owners.map((o) => (
              <TR key={o.id}>
                <TD><Link className="font-medium hover:underline" href={`/admin/clientes/${o.id}`}>{o.user.firstName} {o.user.lastName}</Link></TD>
                <TD className="text-muted-foreground">{o.user.phone ?? o.user.email}</TD>
                <TD>{o.dogs.map((d, i) => <span key={d.id}>{i > 0 && ", "}<Link className="text-primary hover:underline" href={`/admin/perros/${d.id}`}>{d.name}</Link></span>)}</TD>
                <TD className="text-right">{o._count.appointments}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}
