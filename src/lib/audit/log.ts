import "server-only";
import type { DbOrTx } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";

export type AuditEntry = {
  merchantId?: string | null;
  actorUserId?: string | null;
  actorType: "user" | "admin" | "system" | "webhook";
  action: string;
  fromState?: string | null;
  toState?: string | null;
  /** Never put tokens, keys, passwords or full phone numbers here. */
  details?: Record<string, unknown>;
};

export async function writeAudit(db: DbOrTx, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    merchantId: entry.merchantId ?? null,
    actorUserId: entry.actorUserId ?? null,
    actorType: entry.actorType,
    action: entry.action,
    fromState: entry.fromState ?? null,
    toState: entry.toState ?? null,
    details: entry.details ?? {},
  });
}
