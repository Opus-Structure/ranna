/**
 * `npm run seed`: idempotent local/demo data.
 *   - subscription plans (placeholder prices from src/config/plans.ts)
 *   - a platform admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from .env.local)
 *   - the demo shop at /s/demo with a trilingual menu (owner: SEED_DEMO_EMAIL / SEED_DEMO_PASSWORD)
 *   - sample orders on today's board for the demo shop (wiped and replaced on each run)
 * Run with the react-server condition so `server-only` modules load outside Next.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

import { randomBytes } from "node:crypto";
import { eq, notInArray, sql } from "drizzle-orm";
import { planSeeds } from "@/config/plans";
import { closeDb, serviceDb } from "@/lib/db/client";
import { plans, profiles } from "@/lib/db/schema";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { seedDemoShop } from "./seed-demo";
import { seedDemoOrders } from "./seed-orders";

async function seedPlans() {
  for (const p of planSeeds) {
    await serviceDb
      .insert(plans)
      .values({ ...p, isActive: true })
      .onConflictDoUpdate({
        target: plans.code,
        set: {
          name: p.name,
          nameI18n: p.nameI18n,
          priceMinor: p.priceMinor,
          currency: p.currency,
          interval: p.interval,
          trialDays: p.trialDays,
          limits: p.limits,
          sort: p.sort,
          isActive: true,
        },
      });
  }
  // Plans that are no longer sold stay readable for shops on them, but can't be chosen.
  await serviceDb
    .update(plans)
    .set({ isActive: false })
    .where(
      notInArray(
        plans.code,
        planSeeds.map((p) => p.code),
      ),
    );
  console.info(`plans: ${planSeeds.map((p) => p.code).join(", ")}`);
}

/** Creates (or finds) an auth user with a confirmed email; returns its id. */
export async function ensureAuthUser(
  email: string,
  password: string,
  meta: Record<string, string> = {},
) {
  const rows = await serviceDb.execute<{ id: string }>(
    sql`select id from auth.users where lower(email) = lower(${email}) limit 1`,
  );
  const existing = rows[0]?.id;
  if (existing) return existing;
  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error || !data.user) throw new Error(`could not create ${email}: ${error?.message}`);
  return data.user.id;
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("admin: skipped (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local)");
    return;
  }
  const id = await ensureAuthUser(email, password, { locale: "ar", full_name: "Platform admin" });
  await serviceDb.update(profiles).set({ isPlatformAdmin: true }).where(eq(profiles.id, id));
  console.info(`admin: ${email}`);
}

/** Demo owner (can sign in when SEED_DEMO_PASSWORD is set) and the demo shop at /s/demo. */
async function seedDemo() {
  const email = process.env.SEED_DEMO_EMAIL || "demo@ranna.local";
  const password = process.env.SEED_DEMO_PASSWORD || randomBytes(18).toString("base64url");
  const ownerId = await ensureAuthUser(email, password, { locale: "ar", full_name: "Demo owner" });
  const merchantId = await seedDemoShop(ownerId);
  console.info(`demo shop: /s/demo (owner ${email})`);
  console.info(`demo orders: ${await seedDemoOrders(merchantId, ownerId)}`);
}

async function main() {
  await seedPlans();
  await seedAdmin();
  // Production: SEED_DEMO=false seeds plans and the admin only.
  if (process.env.SEED_DEMO === "false") console.info("demo shop: skipped (SEED_DEMO=false)");
  else await seedDemo();
}

main()
  .then(() => console.info("seed: done"))
  .catch((err: unknown) => {
    console.error("seed: failed", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
