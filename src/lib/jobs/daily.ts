import "server-only";
import { and, eq, gte, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import { appUrl, brandName } from "@/config/brand";
import { localizedPath } from "@/lib/auth/paths";
import { applyAccountEvent } from "@/lib/billing/account-service";
import { dispatchAccountEffects } from "@/lib/billing/notify";
import { serviceDb } from "@/lib/db/client";
import {
  auditLogs,
  merchantMembers,
  merchants,
  notificationEvents,
  orders,
  profiles,
  pushSubscriptions,
  staffInvitations,
  subscriptions,
} from "@/lib/db/schema";
import { translatorFor } from "@/lib/i18n/translator";
import { sendSafely } from "@/lib/mail/mailer";
import { purgeOldBuckets } from "@/lib/rate-limit";

const DAY = 86_400_000;
/** Owners hear about the end of a paid period or trial this many days ahead. */
export const REMINDER_DAYS = 3;
/** Default when a shop hasn't set its own phone retention. */
export const DEFAULT_PHONE_RETENTION_DAYS = 30;

export type DailyReport = {
  periodChecks: { due: number; changed: number };
  reminders: number;
  phonesPurged: number;
  pushSubscriptionsRemoved: number;
  rateLimitBucketsRemoved: number;
  invitationsRemoved: number;
  notificationEventsRemoved: number;
  errors: string[];
};

/**
 * Everything that must happen once a day. Each task is independent and idempotent: a failure
 * is reported and the others still run, and running the job twice changes nothing more.
 */
export async function runDailyJobs(now = new Date()): Promise<DailyReport> {
  const report: DailyReport = {
    periodChecks: { due: 0, changed: 0 },
    reminders: 0,
    phonesPurged: 0,
    pushSubscriptionsRemoved: 0,
    rateLimitBucketsRemoved: 0,
    invitationsRemoved: 0,
    notificationEventsRemoved: 0,
    errors: [],
  };
  const task = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      report.errors.push(`${name}: ${err instanceof Error ? err.message.slice(0, 200) : "failed"}`);
    }
  };

  await task("periodChecks", async () => {
    report.periodChecks = await runPeriodChecks(now);
  });
  await task("reminders", async () => {
    report.reminders = await sendPeriodReminders(now);
  });
  await task("phonePurge", async () => {
    report.phonesPurged = await purgeCustomerPhones(now);
  });
  await task("pushCleanup", async () => {
    report.pushSubscriptionsRemoved = await purgePushSubscriptions(now);
  });
  await task("rateLimits", async () => {
    report.rateLimitBucketsRemoved = await purgeOldBuckets(new Date(now.getTime() - DAY));
  });
  await task("invitations", async () => {
    const removed = await serviceDb
      .delete(staffInvitations)
      .where(
        or(
          lt(staffInvitations.expiresAt, new Date(now.getTime() - 30 * DAY)),
          lt(staffInvitations.acceptedAt, new Date(now.getTime() - 30 * DAY)),
        ),
      )
      .returning({ id: staffInvitations.id });
    report.invitationsRemoved = removed.length;
  });
  await task("notificationEvents", async () => {
    const removed = await serviceDb
      .delete(notificationEvents)
      .where(lt(notificationEvents.createdAt, new Date(now.getTime() - 90 * DAY)))
      .returning({ id: notificationEvents.id });
    report.notificationEventsRemoved = removed.length;
  });
  return report;
}

/** Ends paid periods and trials, and suspends accounts whose grace ran out. */
export async function runPeriodChecks(now: Date) {
  const due = await serviceDb
    .select({ id: merchants.id })
    .from(merchants)
    .where(
      or(
        and(eq(merchants.status, "active"), lte(merchants.periodEnd, now)),
        and(eq(merchants.status, "past_due"), lte(merchants.graceUntil, now)),
      ),
    );
  let changed = 0;
  for (const m of due) {
    const applied = await applyAccountEvent(
      m.id,
      { type: "period_check", at: now },
      { type: "system" },
    );
    if (applied.ok && applied.changed) {
      changed++;
      await dispatchAccountEffects(m.id, applied.effects);
    }
  }
  return { due: due.length, changed };
}

/**
 * One reminder per period: owners of active accounts whose period (or trial) ends within
 * REMINDER_DAYS and who haven't cancelled. Payments are one-off (no card on file), so the
 * reminder is the renewal. Deduplicated through the audit log.
 */
export async function sendPeriodReminders(now: Date): Promise<number> {
  const horizon = new Date(now.getTime() + REMINDER_DAYS * DAY);
  const rows = await serviceDb
    .select({
      merchantId: merchants.id,
      shopName: merchants.name,
      periodEnd: merchants.periodEnd,
      timezone: merchants.timezone,
      isTrial: subscriptions.isTrial,
      merchantLocale: merchants.defaultLocale,
      profileLocale: profiles.locale,
      email: sql<
        string | null
      >`(select email from neon_auth."user" u where u.id = ${merchantMembers.userId})`,
    })
    .from(merchants)
    .innerJoin(subscriptions, eq(subscriptions.merchantId, merchants.id))
    .innerJoin(
      merchantMembers,
      and(eq(merchantMembers.merchantId, merchants.id), eq(merchantMembers.role, "owner")),
    )
    .leftJoin(profiles, eq(profiles.id, merchantMembers.userId))
    .where(
      and(
        eq(merchants.status, "active"),
        eq(merchants.isDemo, false),
        eq(subscriptions.cancelAtPeriodEnd, false),
        gte(merchants.periodEnd, now),
        lte(merchants.periodEnd, horizon),
      ),
    );
  let sent = 0;
  for (const r of rows) {
    if (!r.email || !r.periodEnd) continue;
    const key = r.periodEnd.toISOString();
    const [already] = await serviceDb
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.merchantId, r.merchantId),
          eq(auditLogs.action, "billing.reminder_sent"),
          sql`${auditLogs.details}->>'periodEnd' = ${key}`,
        ),
      )
      .limit(1);
    if (already) continue;
    const { t, locale } = translatorFor(r.profileLocale ?? r.merchantLocale);
    const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ-u-nu-latn" : locale, {
      day: "numeric",
      month: "long",
      timeZone: r.timezone,
    }).format(r.periodEnd);
    const kind = r.isTrial ? "trial" : "paid";
    await sendSafely({
      to: r.email,
      subject: t(`emails.reminder.${kind}.subject`, {
        shop: r.shopName,
        date,
        brand: brandName(locale),
      }),
      text: `${t(`emails.reminder.${kind}.body`, { shop: r.shopName, date })}\n\n${appUrl()}${localizedPath("/dashboard/billing", locale)}\n\n— ${brandName(locale)}`,
    });
    await serviceDb.insert(auditLogs).values({
      merchantId: r.merchantId,
      actorType: "system",
      action: "billing.reminder_sent",
      details: { periodEnd: key, kind },
    });
    sent++;
  }
  return sent;
}

/** Minimal data: customer phone numbers are erased after each shop's retention period. */
export async function purgeCustomerPhones(now: Date): Promise<number> {
  const at = now.toISOString();
  const result = await serviceDb.execute<{ id: string }>(sql`
    update ${orders} o
       set customer_phone = null, phone_purged_at = ${at}::timestamptz
      from ${merchants} m
     where m.id = o.merchant_id
       and o.customer_phone is not null
       and o.placed_at < ${at}::timestamptz - make_interval(days =>
             greatest(1, least(365, coalesce((m.settings->>'phoneRetentionDays')::int, ${DEFAULT_PHONE_RETENTION_DAYS}))))
    returning o.id`);
  return result.length;
}

/** Push subscriptions only matter while an order is open: drop them a day after it closes. */
export async function purgePushSubscriptions(now: Date): Promise<number> {
  const dayAgo = new Date(now.getTime() - DAY);
  const closed = serviceDb
    .select({ id: orders.id })
    .from(orders)
    .where(
      or(
        and(eq(orders.status, "completed"), lt(orders.completedAt, dayAgo)),
        and(eq(orders.status, "canceled"), lt(orders.canceledAt, dayAgo)),
      ),
    );
  const removed = await serviceDb
    .delete(pushSubscriptions)
    .where(
      or(
        inArray(pushSubscriptions.orderId, closed),
        // Orders forgotten open for a week, and subscriptions that stopped working.
        lt(pushSubscriptions.createdAt, new Date(now.getTime() - 7 * DAY)),
        and(
          inArray(pushSubscriptions.status, ["expired", "failed"]),
          isNotNull(pushSubscriptions.lastFailureAt),
        ),
      ),
    )
    .returning({ id: pushSubscriptions.id });
  return removed.length;
}
