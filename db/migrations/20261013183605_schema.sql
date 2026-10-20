CREATE TYPE "public"."invoice_status" AS ENUM('open', 'paid', 'void', 'failed');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('pending_payment', 'active', 'past_due', 'suspended', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('push', 'sms', 'whatsapp', 'inpage');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'accepted', 'preparing', 'ready', 'completed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('mock', 'manual', 'chargily');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'pending_review', 'succeeded', 'failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."push_status" AS ENUM('active', 'expired', 'failed');--> statement-breakpoint
CREATE TABLE "merchant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text,
	"name" text NOT NULL,
	"status" "merchant_status" DEFAULT 'pending_payment' NOT NULL,
	"plan_id" uuid,
	"period_end" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"currency" text DEFAULT 'DZD' NOT NULL,
	"default_locale" text DEFAULT 'ar' NOT NULL,
	"locales" text[] DEFAULT '{ar}'::text[] NOT NULL,
	"timezone" text DEFAULT 'Africa/Algiers' NOT NULL,
	"phone" text,
	"address" text,
	"branding" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"accepting_orders" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" text DEFAULT 'DZD' NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"interval_count" integer DEFAULT 1 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"limits" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"locale" text DEFAULT 'ar' NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"old_slug" text PRIMARY KEY NOT NULL,
	"merchant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slug_redirects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'staff' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "staff_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"merchant_id" uuid,
	"actor_user_id" uuid,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"number" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "invoice_status" DEFAULT 'open' NOT NULL,
	"provider" "payment_provider",
	"provider_ref" text,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_ref" text,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"receipt_path" text,
	"reference" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"pending_plan_id" uuid,
	"is_trial" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"description_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_minor" integer NOT NULL,
	"image_path" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "option_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "option_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_i18n" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_delta_minor" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"table_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qr_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"kind" text NOT NULL,
	"status" "notification_status" NOT NULL,
	"status_code" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_counters" (
	"merchant_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"last_number" integer NOT NULL,
	CONSTRAINT "order_counters_merchant_id_business_date_pk" PRIMARY KEY("merchant_id","business_date")
);
--> statement-breakpoint
ALTER TABLE "order_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"item_id" uuid,
	"name" text NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"quantity" integer NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"line_total_minor" integer NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"business_date" date NOT NULL,
	"token_hash" text NOT NULL,
	"client_request_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"table_label" text,
	"note" text,
	"locale" text DEFAULT 'ar' NOT NULL,
	"subtotal_minor" integer NOT NULL,
	"total_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"payment_method" text DEFAULT 'counter' NOT NULL,
	"cancel_reason" text,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"preparing_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"last_rung_at" timestamp with time zone,
	"ring_count" integer DEFAULT 0 NOT NULL,
	"phone_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"merchant_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"status" "push_status" DEFAULT 'active' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_buckets_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_pending_plan_id_plans_id_fk" FOREIGN KEY ("pending_plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_group_id_option_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."option_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_counters" ADD CONSTRAINT "order_counters_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_members_merchant_user_key" ON "merchant_members" USING btree ("merchant_id","user_id");--> statement-breakpoint
CREATE INDEX "merchant_members_user_idx" ON "merchant_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_slug_key" ON "merchants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "merchants_status_idx" ON "merchants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "slug_redirects_merchant_idx" ON "slug_redirects" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "staff_invitations_merchant_idx" ON "staff_invitations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_merchant_idx" ON "audit_logs" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "invoices_merchant_idx" ON "invoices" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_merchant_idx" ON "payments" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments" USING btree ("provider","provider_ref") WHERE provider_ref is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_merchant_key" ON "subscriptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_key" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "categories_merchant_idx" ON "categories" USING btree ("merchant_id","sort");--> statement-breakpoint
CREATE INDEX "items_merchant_idx" ON "items" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category_id","sort");--> statement-breakpoint
CREATE INDEX "option_groups_item_idx" ON "option_groups" USING btree ("item_id","sort");--> statement-breakpoint
CREATE INDEX "options_group_idx" ON "options" USING btree ("group_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_codes_merchant_table_key" ON "qr_codes" USING btree ("merchant_id","table_code");--> statement-breakpoint
CREATE INDEX "notification_events_order_idx" ON "notification_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_merchant_day_number_key" ON "orders" USING btree ("merchant_id","business_date","number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_merchant_client_request_key" ON "orders" USING btree ("merchant_id","client_request_id");--> statement-breakpoint
CREATE INDEX "orders_merchant_status_idx" ON "orders" USING btree ("merchant_id","status","placed_at");--> statement-breakpoint
CREATE INDEX "orders_merchant_placed_idx" ON "orders" USING btree ("merchant_id","placed_at");--> statement-breakpoint
CREATE INDEX "orders_phone_purge_idx" ON "orders" USING btree ("placed_at") WHERE customer_phone is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_order_endpoint_key" ON "push_subscriptions" USING btree ("order_id","endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_merchant_idx" ON "push_subscriptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_window_idx" ON "rate_limit_buckets" USING btree ("window_start");--> statement-breakpoint
CREATE POLICY "merchant_members_select" ON "merchant_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING (user_id = (select auth.uid()) or (merchant_id in (select public.owner_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "merchants_select_member" ON "merchants" AS PERMISSIVE FOR SELECT TO "authenticated" USING (id in (select public.member_merchant_ids()) or (select public.is_platform_admin()));--> statement-breakpoint
CREATE POLICY "merchants_update_owner" ON "merchants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (id in (select public.owner_merchant_ids())) WITH CHECK (id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "plans_select" ON "plans" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_active or (select public.is_platform_admin()));--> statement-breakpoint
CREATE POLICY "profiles_select_self" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (id = (select auth.uid()) or (select public.is_platform_admin()));--> statement-breakpoint
CREATE POLICY "profiles_update_self" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "slug_redirects_select_member" ON "slug_redirects" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "staff_invitations_select_owner" ON "staff_invitations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.owner_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "staff_invitations_delete_owner" ON "staff_invitations" AS PERMISSIVE FOR DELETE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "audit_logs_select_owner" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids()) or (select public.is_platform_admin()));--> statement-breakpoint
CREATE POLICY "invoices_select_owner" ON "invoices" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.owner_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "payments_select_owner" ON "payments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.owner_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "subscriptions_select_owner" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.owner_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "categories_select_member" ON "categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "categories_insert_owner" ON "categories" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "categories_update_owner" ON "categories" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids())) WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "categories_delete_owner" ON "categories" AS PERMISSIVE FOR DELETE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "items_select_member" ON "items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "items_insert_owner" ON "items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "items_update_owner" ON "items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids())) WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "items_delete_owner" ON "items" AS PERMISSIVE FOR DELETE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "option_groups_select_member" ON "option_groups" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "option_groups_insert_owner" ON "option_groups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "option_groups_update_owner" ON "option_groups" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids())) WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "option_groups_delete_owner" ON "option_groups" AS PERMISSIVE FOR DELETE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "options_select_member" ON "options" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "options_insert_owner" ON "options" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "options_update_owner" ON "options" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids())) WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "options_delete_owner" ON "options" AS PERMISSIVE FOR DELETE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "qr_codes_select_member" ON "qr_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "qr_codes_insert_owner" ON "qr_codes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "qr_codes_update_owner" ON "qr_codes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids())) WITH CHECK (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "qr_codes_delete_owner" ON "qr_codes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (merchant_id in (select public.owner_merchant_ids()));--> statement-breakpoint
CREATE POLICY "notification_events_select_member" ON "notification_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "order_items_select_member" ON "order_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "orders_select_member" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));--> statement-breakpoint
CREATE POLICY "orders_update_member" ON "orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (merchant_id in (select public.member_merchant_ids())) WITH CHECK (merchant_id in (select public.member_merchant_ids()));--> statement-breakpoint
CREATE POLICY "push_subscriptions_select_member" ON "push_subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((merchant_id in (select public.member_merchant_ids()) or (select public.is_platform_admin())));