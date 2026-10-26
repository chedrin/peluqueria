import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { BookingWizard } from "@/features/booking/components/BookingWizard";

export const metadata = { title: "Reservar cita" };
export const dynamic = "force-dynamic";

export default async function BookPage() {
  const session = await getSession();
  const [services, staff] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true, bookableOnline: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: { id: true, name: true, description: true, basePriceCents: true, baseDurationMin: true, category: { select: { name: true } } },
    }),
    prisma.staffProfile.findMany({ where: { bookableOnline: true, user: { isActive: true } }, orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true, color: true } }),
  ]);

  if (!session || session.role !== "CLIENT") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="mb-2 text-2xl font-bold">Reserva tu cita</h1>
        <p className="mb-6 text-muted-foreground">Entra o crea tu cuenta para guardar la ficha de tu perro y reservar en segundos.</p>
        <div className="flex justify-center gap-3">
          <Link href="/login?next=/reservar" className={buttonVariants({ variant: "outline" })}>Ya tengo cuenta</Link>
          <Link href="/registro?next=/reservar" className={buttonVariants()}>Crear cuenta</Link>
        </div>
      </div>
    );
  }

  const owner = await prisma.ownerProfile.findUnique({
    where: { id: session.ownerId },
    select: { favoriteGroomerId: true, dogs: { where: { isActive: true }, select: { id: true, name: true, size: true, breedText: true, breed: { select: { name: true } } } } },
  });

  return (
    <div className="py-10">
      <h1 className="mb-6 text-2xl font-bold">Reservar cita</h1>
      <BookingWizard
        dogs={(owner?.dogs ?? []).map((d) => ({ id: d.id, name: d.name, size: d.size, breed: d.breed?.name ?? d.breedText ?? "" }))}
        services={services.map((s) => ({ ...s, category: s.category?.name ?? "Otros" }))}
        staff={staff}
        favoriteStaffId={owner?.favoriteGroomerId ?? null}
      />
    </div>
  );
}
