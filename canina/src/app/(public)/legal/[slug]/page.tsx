import { notFound } from "next/navigation";
import { LEGAL_PAGES } from "@/features/legal/domain/policies";

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: LEGAL_PAGES[slug]?.title };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = LEGAL_PAGES[slug];
  if (!page) notFound();
  return (
    <article className="prose mx-auto max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-bold">{page.title}</h1>
      {page.sections.map((s) => (
        <section key={s.heading} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{s.heading}</h2>
          <p className="text-muted-foreground">{s.body}</p>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">Texto modelo: revisa los campos entre corchetes con tu asesoría antes de publicar.</p>
    </article>
  );
}
