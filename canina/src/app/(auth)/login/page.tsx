import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Entrar</h1>
      <LoginForm next={next} />
      <p className="mt-4 text-sm text-muted-foreground">
        ¿Primera vez? <Link href={`/registro${next ? `?next=${next}` : ""}`} className="text-primary underline">Crea tu cuenta</Link>
      </p>
    </>
  );
}
