import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { CookieBanner } from "@/components/legal/CookieBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CANIA · Peluquería y Estética Canina", template: "%s · CANIA" },
  description: "Reserva online de baño, corte y estética para tu perro.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14b8a6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh">
        {children}
        <Toaster richColors position="top-center" />
        <CookieBanner />
      </body>
    </html>
  );
}
