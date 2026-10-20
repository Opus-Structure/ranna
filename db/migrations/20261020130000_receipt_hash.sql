-- Automatic receipt check: the same receipt file cannot be submitted twice (SHA-256 of its bytes).
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receipt_hash" text;
CREATE UNIQUE INDEX IF NOT EXISTS "payments_receipt_hash_key" ON "payments" USING btree ("receipt_hash") WHERE "receipt_hash" IS NOT NULL;
