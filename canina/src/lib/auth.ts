import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { SESSION_COOKIE, sessionMaxAge, signSession, verifySession, type SessionPayload } from "./session";
import { DomainError } from "./errors";

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function startSession(payload: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Para páginas: redirige a /login si no hay permiso. */
export async function requirePageRole(roles: Role[]): Promise<SessionPayload> {
  const s = await getSession();
  if (!s || !roles.includes(s.role)) redirect("/login");
  return s;
}

/** Para server actions / route handlers: lanza DomainError. */
export async function requireRole(roles: Role[]): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new DomainError("UNAUTHENTICATED", "Debes iniciar sesión.");
  if (!roles.includes(s.role)) throw new DomainError("FORBIDDEN", "No tienes permiso para esta acción.");
  return s;
}
