import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BeforeAfterGallery } from "@/features/dogs/components/BeforeAfterGallery";

export default async function MyDogDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePageRole(["CLIENT"]);
  const dog = await prisma.dog.findFirst({
    where: { id, ownerId: s.ownerId },
    include: {
      breed: true,
      groomingRecords: { orderBy: { performedAt: "desc" }, include: { groomer: true, photos: { where: { visibleToOwner: true } } } },
    },
  });
  if (!dog) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{dog.name}</h1>
      <Card>
        <CardHeader><CardTitle>Historial de visitas</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {dog.groomingRecords.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay visitas registradas.</p>}
          {dog.groomingRecords.map((r) => (
            <div key={r.id} className="border-b pb-4 last:border-0">
              <p className="font-medium">
                {r.performedAt.toLocaleDateString("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" })} · {r.servicesDone.join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">Le atendió {r.groomer.displayName}{r.cutDescription ? ` · ${r.cutDescription}` : ""}</p>
              <BeforeAfterGallery photos={r.photos} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
