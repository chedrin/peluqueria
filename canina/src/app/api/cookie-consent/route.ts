import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const schema = z.object({
  necessary: z.literal(true),
  preferences: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  version: z.string(),
});

/** Registro probatorio del consentimiento de cookies (AEPD). */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const session = await getSession();
  const visitorId = req.headers.get("cookie")?.match(/cania_vid=([^;]+)/)?.[1] ?? randomUUID();
  await prisma.cookieConsentLog.create({ data: { ...parsed.data, visitorId, userId: session?.sub } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("cania_vid", visitorId, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}
