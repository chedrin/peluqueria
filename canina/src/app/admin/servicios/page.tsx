import { prisma } from "@/lib/prisma";
import { ServiceEditor } from "@/features/catalog/components/ServiceEditor";

export const metadata = { title: "Servicios y tarifas" };

export default async function ServicesPage() {
  const [services, categories] = await Promise.all([
    prisma.service.findMany({ orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }], include: { pricing: true, category: true } }),
    prisma.serviceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Servicios, tarifas y tiempos</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Precios con IVA incluido. La duración de cada tarifa ajusta automáticamente el hueco en la agenda (más el tiempo de limpieza).
      </p>
      <div className="space-y-4">
        <ServiceEditor categories={categories} />
        {services.map((s) => <ServiceEditor key={s.id} service={s} categories={categories} />)}
      </div>
    </>
  );
}
