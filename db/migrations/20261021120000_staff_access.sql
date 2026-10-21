-- Staff can be limited to the order board or to the kitchen screen.
DO $$ BEGIN
  CREATE TYPE "staff_access" AS ENUM ('orders', 'kitchen');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "merchant_members" ADD COLUMN IF NOT EXISTS "access" "staff_access" NOT NULL DEFAULT 'orders';
ALTER TABLE "staff_invitations" ADD COLUMN IF NOT EXISTS "access" "staff_access" NOT NULL DEFAULT 'orders';
