ALTER TABLE "order_items" ADD COLUMN "name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "position" smallint DEFAULT 0 NOT NULL;