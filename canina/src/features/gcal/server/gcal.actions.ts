"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { DomainError, toActionResult } from "@/lib/errors";
import { syncGoogleCalendar } from "./sync.service";

export async function syncGoogleNowAction() {
  return toActionResult(async () => {
    await requireRole(["ADMIN", "RECEPTION"]);
    try {
      const stats = await syncGoogleCalendar();
      revalidatePath("/admin/ajustes");
      revalidatePath("/admin/agenda");
      return stats;
    } catch (e) {
      revalidatePath("/admin/ajustes");
      throw new DomainError("GOOGLE", (e as Error).message);
    }
  });
}
