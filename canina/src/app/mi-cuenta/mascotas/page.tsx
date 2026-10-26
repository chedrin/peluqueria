import Link from "next/link";
import { Dog } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COAT_LABEL, SIZE_LABEL } from "@/features/catalog/domain/pricing";

export default async function MyDogs() {
  const s = await requirePageRole(["CLIENT"]);
  const dogs = await prisma.dog.findMany({
    where: { ownerId: s.ownerId, isActive: true },
    include: { breed: true, _count: { select: { groomingRecords: true } } },
  });
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Mis mascotas</h1>
      {dogs.length === 0 && <p className="text-muted-foreground">Aún no tienes mascotas. Añádela al <Link className="underline" href="/reservar">reservar</Link>.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {dogs.map((d) => (
          <Link key={d.id} href={`/mi-cuenta/mascotas/${d.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-center gap-3">
                <Dog className="size-8 text-primary" />
                <div>
                  <CardTitle>{d.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{d.breed?.name ?? d.breedText ?? "Mestizo"}</p>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="secondary">{SIZE_LABEL[d.size]}</Badge>
                <Badge variant="secondary">{COAT_LABEL[d.coatType]}</Badge>
                <Badge variant="outline">{d._count.groomingRecords} visitas</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
