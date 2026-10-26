import Link from "next/link";
import { PawPrint } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-secondary/40 p-4">
      <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-bold">
        <PawPrint className="size-6 text-primary" /> CANIA
      </Link>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">{children}</div>
    </div>
  );
}
