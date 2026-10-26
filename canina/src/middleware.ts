import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, STAFF_ROLES, verifySession } from "@/lib/session";

/** Control de acceso por área: /admin → staff, /mi-cuenta → clientes. */
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = req.nextUrl;
  const login = new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url);

  if (pathname.startsWith("/admin")) {
    if (!session || !STAFF_ROLES.includes(session.role)) return NextResponse.redirect(login);
    // Ajustes fiscales y configuración: solo ADMIN
    if (pathname.startsWith("/admin/ajustes") && session.role !== "ADMIN")
      return NextResponse.redirect(new URL("/admin/agenda", req.url));
  }
  if (pathname.startsWith("/mi-cuenta") && (!session || session.role !== "CLIENT")) return NextResponse.redirect(login);
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/mi-cuenta/:path*"] };
