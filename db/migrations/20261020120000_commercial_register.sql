-- Commercial register (registre de commerce): required before the free trial starts, one per
-- account, so repeat sign-ups cannot farm trials. The copy lives in the private receipts bucket.
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "register_number" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "register_path" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "register_submitted_at" timestamp with time zone;
CREATE UNIQUE INDEX IF NOT EXISTS "merchants_register_number_key" ON "merchants" USING btree ("register_number");

-- Shops that already have a plan (and the demo) are grandfathered: they are not asked again.
UPDATE "merchants" SET "register_submitted_at" = now()
WHERE "register_submitted_at" IS NULL AND ("plan_id" IS NOT NULL OR "is_demo");

-- Trial and pack allowances (owner's request, 2026-10-20): 15 free days, 15 and 50 dishes.
UPDATE "plans" SET "trial_days" = 15;
UPDATE "plans" SET "limits" = jsonb_set("limits", '{maxItems}', '15') WHERE "code" = 'starter';
UPDATE "plans" SET "limits" = jsonb_set("limits", '{maxItems}', '50') WHERE "code" = 'diamant';
