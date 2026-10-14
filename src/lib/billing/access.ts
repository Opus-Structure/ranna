import "server-only";
import type { MerchantContext } from "@/lib/merchants/context";
import { accountAccess, type AccountAccess } from "./state-machine";

export function merchantAccess(
  merchant: MerchantContext["merchant"],
  at = new Date(),
): AccountAccess {
  return accountAccess(merchant, at);
}

/** Thrown by mutations while the account is locked or read-only (everything except billing). */
export class AccountLockedError extends Error {
  constructor() {
    super("account_locked");
    this.name = "AccountLockedError";
  }
}

export function assertCanEdit(ctx: MerchantContext, at = new Date()): void {
  if (!merchantAccess(ctx.merchant, at).canEdit) throw new AccountLockedError();
}
