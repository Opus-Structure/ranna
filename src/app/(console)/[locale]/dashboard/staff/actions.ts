"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { ownerAction } from "@/lib/auth/action-context";
import {
  inviteStaff,
  removeMember,
  revokeInvitation,
  type InviteResult,
} from "@/lib/merchants/staff";

const refresh = () => revalidatePath("/[locale]/dashboard/staff", "page");

export async function inviteStaffAction(input: unknown): Promise<InviteResult> {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false, error: "forbidden" };
  const result = await inviteStaff(ctx, input, await getLocale());
  if (result.ok) refresh();
  return result;
}

export async function revokeInvitationAction(id: string) {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false };
  const result = await revokeInvitation(ctx, id);
  refresh();
  return result;
}

export async function removeMemberAction(id: string) {
  const ctx = await ownerAction();
  if (!ctx) return { ok: false };
  const result = await removeMember(ctx, id);
  refresh();
  return result;
}
