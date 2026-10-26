import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

/**
 * Sesión mínima basada en JWT firmado (HS256) en cookie httpOnly.
 * Compatible con el runtime Edge (middleware). Sustituible por Auth.js
 * sin tocar las features: todas consumen `getSession()` / `requireRole()`.
 */
export const SESSION_COOKIE = "cania_session";
const MAX_AGE_S = 60 * 60 * 24 * 7;

export type SessionPayload = { sub: string; role: Role; name: string; ownerId?: string; staffId?: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, key());
    return payload;
  } catch {
    return null;
  }
}

export const STAFF_ROLES: Role[] = ["ADMIN", "GROOMER", "RECEPTION"];
export const sessionMaxAge = MAX_AGE_S;
