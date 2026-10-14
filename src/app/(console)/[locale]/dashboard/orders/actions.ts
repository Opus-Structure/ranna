"use server";

import { z } from "zod";
import { memberAction } from "@/lib/auth/action-context";
import { loadBoard, type Board } from "@/lib/orders/board";
import { setOrderStatus, type StatusChangeResult } from "@/lib/orders/service";
import { reRing, type ReRingResult } from "@/lib/orders/ring";
import { ORDER_STATUSES } from "@/lib/orders/transitions";

/** Fresh board for the live view (called on realtime events, polling and focus). */
export async function boardAction(): Promise<Board | null> {
  const ctx = await memberAction();
  return ctx ? loadBoard(ctx) : null;
}

const changeSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(ORDER_STATUSES),
  cancelReason: z.string().max(200).optional(),
});

/** Any member (owner or staff) moves orders; transitions and RLS are checked in the service. */
export async function changeStatusAction(input: unknown): Promise<StatusChangeResult> {
  const ctx = await memberAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "not_found" };
  const { orderId, to, cancelReason } = parsed.data;
  return setOrderStatus(ctx, orderId, to, { cancelReason });
}

/** "Ring again" for a ready order whose customer hasn't come (rate-limited in the service). */
export async function ringAgainAction(
  orderId: string,
): Promise<ReRingResult | { ok: false; error: "forbidden" }> {
  const ctx = await memberAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  return reRing(ctx, orderId);
}
