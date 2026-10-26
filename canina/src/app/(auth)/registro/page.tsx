import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Crea tu cuenta</h1>
      <RegisterForm next={next} />
    </>
  );
}
