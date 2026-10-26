import type { AuditAction, Prisma } from "@prisma/client";
import type { Db } from "./prisma";

/** Escribe en el registro de auditoría (append-only). Usar dentro de la misma transacción. */
export async function audit(
  db: Db,
  entry: {
    actorId?: string | null;
    action: AuditAction;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
