import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { AccountLockedError, assertCanEdit } from "@/lib/billing/access";
import { serviceDb, withRls } from "@/lib/db/client";
import { qrCodes } from "@/lib/db/schema";
import type { MerchantContext } from "@/lib/merchants/context";
import { cleanText } from "@/lib/validation/text";
import { TABLE_CODE } from "./matrix";

export type QrResult = { ok: true } | { ok: false; error: string; field?: string };
export type TableQr = { id: string; label: string; tableCode: string };

const tableSchema = z.object({
  label: z
    .string()
    .transform((v) => cleanText(v))
    .pipe(z.string().min(1, { error: "labelRequired" }).max(40, { error: "tooLong" })),
  tableCode: z.string().trim().regex(TABLE_CODE, { error: "code" }),
});

const bulkSchema = z
  .object({
    prefix: z
      .string()
      .transform((v) => cleanText(v))
      .pipe(z.string().min(1, { error: "labelRequired" }).max(30, { error: "tooLong" })),
    from: z.number().int().min(1).max(999),
    to: z.number().int().min(1).max(999),
  })
  .refine((v) => v.to >= v.from && v.to - v.from < 100, { error: "range", path: ["to"] });

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e.cause?.code ?? e.code) === "23505";
}

async function guarded(ctx: MerchantContext, run: () => Promise<QrResult>): Promise<QrResult> {
  if (ctx.role !== "owner") return { ok: false, error: "forbidden" };
  try {
    assertCanEdit(ctx);
    return await run();
  } catch (err) {
    if (err instanceof AccountLockedError) return { ok: false, error: "locked" };
    if (isUniqueViolation(err)) return { ok: false, error: "code_taken", field: "tableCode" };
    throw err;
  }
}

export async function listTableQrs(ctx: MerchantContext): Promise<TableQr[]> {
  const rows = await withRls(ctx.user.id, (tx) =>
    tx
      .select({ id: qrCodes.id, label: qrCodes.label, tableCode: qrCodes.tableCode })
      .from(qrCodes)
      .where(eq(qrCodes.merchantId, ctx.merchant.id))
      .orderBy(asc(qrCodes.createdAt)),
  );
  return rows.filter((r): r is TableQr => r.tableCode !== null);
}

export async function addTableQr(ctx: MerchantContext, input: unknown): Promise<QrResult> {
  return guarded(ctx, async () => {
    const parsed = tableSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue?.message ?? "invalid", field: issue?.path.join(".") };
    }
    await withRls(ctx.user.id, (tx) =>
      tx.insert(qrCodes).values({ merchantId: ctx.merchant.id, ...parsed.data }),
    );
    return { ok: true };
  });
}

/** "Table 1" … "Table 12" in one go; codes are the numbers. Existing codes are skipped. */
export async function addTableRange(ctx: MerchantContext, input: unknown): Promise<QrResult> {
  return guarded(ctx, async () => {
    const parsed = bulkSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return { ok: false, error: issue?.message ?? "invalid", field: issue?.path.join(".") };
    }
    const { prefix, from, to } = parsed.data;
    const values = Array.from({ length: to - from + 1 }, (_, i) => ({
      merchantId: ctx.merchant.id,
      label: `${prefix} ${from + i}`,
      tableCode: String(from + i),
    }));
    await withRls(ctx.user.id, (tx) => tx.insert(qrCodes).values(values).onConflictDoNothing());
    return { ok: true };
  });
}

export async function deleteTableQr(ctx: MerchantContext, id: string): Promise<QrResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  return guarded(ctx, async () => {
    const rows = await withRls(ctx.user.id, (tx) =>
      tx.delete(qrCodes).where(eq(qrCodes.id, id)).returning({ id: qrCodes.id }),
    );
    return rows.length ? { ok: true } : { ok: false, error: "not_found" };
  });
}

/** Public: the staff-facing name of a table code on a shop page (?t=), or null if unknown. */
export async function resolveTableLabel(
  merchantId: string,
  code: string | undefined,
): Promise<string | null> {
  if (!code || !TABLE_CODE.test(code)) return null;
  const [row] = await serviceDb
    .select({ label: qrCodes.label })
    .from(qrCodes)
    .where(and(eq(qrCodes.merchantId, merchantId), eq(qrCodes.tableCode, code)));
  return row?.label ?? null;
}
