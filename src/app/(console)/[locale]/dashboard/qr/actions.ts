"use server";

import { revalidatePath } from "next/cache";
import { ownerAction } from "@/lib/auth/action-context";
import { addTableQr, addTableRange, deleteTableQr, type QrResult } from "@/lib/qr/service";

async function run(
  fn: (ctx: NonNullable<Awaited<ReturnType<typeof ownerAction>>>) => Promise<QrResult>,
) {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false as const, error: "forbidden" };
  const result = await fn(ctx);
  if (result.ok) revalidatePath("/[locale]/dashboard/qr", "page");
  return result;
}

export async function addTableAction(input: unknown) {
  return run((ctx) => addTableQr(ctx, input));
}

export async function addRangeAction(input: unknown) {
  return run((ctx) => addTableRange(ctx, input));
}

export async function deleteTableAction(id: string) {
  return run((ctx) => deleteTableQr(ctx, id));
}
