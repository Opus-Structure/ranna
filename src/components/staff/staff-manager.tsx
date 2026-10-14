"use client";

import { Check, Copy, Loader2, Mail, UserMinus, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  inviteStaffAction,
  removeMemberAction,
  revokeInvitationAction,
} from "@/app/(console)/[locale]/dashboard/staff/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { StaffMember, StaffOverview } from "@/lib/merchants/staff";
import { cn } from "@/lib/utils";

export function StaffManager({
  data,
  selfId,
  readOnly,
}: {
  data: StaffOverview;
  selfId: string;
  readOnly: boolean;
}) {
  const t = useTranslations("staff");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const full = data.maxStaff !== null && data.usedSeats >= data.maxStaff;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric" });

  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "");
    setError(null);
    setSent(null);
    setCopied(false);
    startTransition(async () => {
      const result = await inviteStaffAction({ email });
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      form.reset();
      setSent({ email: result.email, link: result.link });
      router.refresh();
    });
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast.error(t("invite.copyFailed"));
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-10">
        <section aria-labelledby="team-title" className="flex flex-col gap-3">
          <h2 id="team-title" className="font-display text-lg font-semibold">
            {t("members.title")}
          </h2>
          <ul className="divide-y rounded-xl border">
            {data.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate font-semibold" dir="ltr">
                    {m.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`members.${m.role}`)}
                    {m.userId === selfId ? ` · ${t("members.you")}` : ""} ·{" "}
                    {t("members.since", { date: date(m.since) })}
                  </p>
                </div>
                {m.role === "staff" && !readOnly ? (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                    <UserMinus className="size-4" aria-hidden />
                    {t("members.remove")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {data.members.every((m) => m.role === "owner") ? (
            <p className="text-sm text-muted-foreground">{t("members.onlyYou")}</p>
          ) : null}
        </section>

        <section aria-labelledby="pending-title" className="flex flex-col gap-3">
          <h2 id="pending-title" className="font-display text-lg font-semibold">
            {t("pending.title")}
          </h2>
          {data.invitations.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
              {t("pending.empty")}
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {data.invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate font-semibold" dir="ltr">
                      {i.email}
                    </p>
                    <p
                      className={cn(
                        "text-sm",
                        i.expired ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {i.expired
                        ? t("pending.expired")
                        : t("pending.expires", { date: date(i.expiresAt) })}
                    </p>
                  </div>
                  {!readOnly ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await revokeInvitationAction(i.id);
                          router.refresh();
                        })
                      }
                    >
                      <X className="size-4" aria-hidden />
                      {i.expired ? t("pending.remove") : t("pending.revoke")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside
        aria-labelledby="invite-title"
        className="flex h-fit flex-col gap-4 rounded-xl border p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id="invite-title" className="font-display text-lg font-semibold">
            {t("invite.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("invite.body")}</p>
        </div>
        <p className="text-sm font-semibold">
          {data.maxStaff === null
            ? t("seatsUnlimited", { used: data.usedSeats })
            : t("seats", { used: data.usedSeats, max: data.maxStaff })}
        </p>
        <form onSubmit={invite} className="flex flex-col gap-3" noValidate>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("invite.email")}
            <Input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              dir="ltr"
              required
              maxLength={254}
              placeholder={t("invite.placeholder")}
              disabled={readOnly || full}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "invite-error" : undefined}
              className="h-11 font-normal"
            />
          </label>
          {error ? (
            <p id="invite-error" role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-11" disabled={pending || readOnly || full}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Mail className="size-4" aria-hidden />
            )}
            {t("invite.submit")}
          </Button>
          {full ? <p className="text-sm text-muted-foreground">{t("errors.seats")}</p> : null}
        </form>
        {sent ? (
          <div role="status" className="flex flex-col gap-3 rounded-lg bg-muted p-4 text-sm">
            <p className="font-semibold">{t("invite.sent", { email: sent.email })}</p>
            <p className="text-muted-foreground">{t("invite.linkHint")}</p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={sent.link}
                dir="ltr"
                aria-label={t("invite.linkLabel")}
                className="h-10 font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                onClick={() => void copy(sent.link)}
                aria-label={t("invite.copy")}
              >
                {copied ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
              </Button>
            </div>
            {copied ? <p className="text-xs text-muted-foreground">{t("invite.copied")}</p> : null}
          </div>
        ) : null}
      </aside>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("members.removeTitle", { email: removing?.email ?? "" })}</DialogTitle>
            <DialogDescription>{t("members.removeBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              {t("members.keep")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const m = removing;
                if (!m) return;
                startTransition(async () => {
                  const result = await removeMemberAction(m.id);
                  setRemoving(null);
                  if (!result.ok) toast.error(t("errors.generic"));
                  router.refresh();
                });
              }}
            >
              {t("members.removeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
