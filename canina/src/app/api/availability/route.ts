import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import { getAvailability } from "@/features/booking/server/booking.service";

const q = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dogId: z.string(),
  serviceIds: z.string().transform((s) => s.split(",").filter(Boolean)),
  staffId: z.string().optional(),
});

/** GET /api/availability?day=2026-11-03&dogId=…&serviceIds=a,b&staffId=… (para apps/integraciones) */
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: z.flattenError(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json(await getAvailability(parsed.data));
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ error: e.message, code: e.code }, { status: 422 });
    throw e;
  }
}
