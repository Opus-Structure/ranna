# Decisions

Each entry records a choice the brief left open, with the reason. Newest decisions are appended at the end of their phase.

## Phase 1: Foundation

**D1. Working brand name: "Ranna / رنّة".** It means "a ring, a chime", which is the product's core moment. The name lives only in `src/config/brand.ts` (plus the translation catalogs that interpolate it), so a rename is a single edit.

**D2. Drizzle over Prisma.** Drizzle is SQL-first, so the RLS policies sit next to the tables (`pgPolicy`) and get reviewed together. It has no query-engine binary, which keeps Vercel cold starts small. It works with Supabase's transaction pooler (`prepare: false`). `drizzle-kit` generates Supabase-compatible timestamped migrations into `supabase/migrations`, so one migration history serves both tools. Custom SQL (helper functions, triggers, grants, storage buckets, realtime publication) lives in hand-written migrations in the same folder.

**D3. Two data-access paths.**

- `withRls(user, tx => …)` opens a transaction, sets `request.jwt.claims`, and switches to `set local role authenticated`. Every merchant- or staff-initiated read and write goes through it, so Postgres RLS enforces tenant isolation, not only application code.
- `serviceDb` is used only by system code: webhooks, cron, public order placement, token lookups, and admin services after an explicit admin check. Its queries always carry explicit tenant filters.

**D4. The anon role gets no table access.** Supabase exposes `public` through PostgREST with the public anon key, so anything `anon` can select is world-readable. Public shop data is read on the server with explicit column selection. Customers receive live updates through Realtime _Broadcast_, not table subscriptions.

**D5. Customer realtime.** Broadcast topic `order:<sha256(token)[:32]>`, published by the server after every status change. Knowing the topic requires the 128-bit token. The status page also polls every 15 s, and on focus/visibility change, because cheap phones drop websockets.

**D6. Merchant realtime.** Uses `postgres_changes` on `orders`, filtered by `merchant_id` and authorized by RLS for the logged-in member. The board also re-fetches every 20 s and on reconnect.

**D7. Order tokens.** 16 random bytes, base64url (22 chars). Only `sha256(token)` is stored. A database leak therefore does not expose live status URLs.

**D8. Daily order numbers.** They start at 101 per merchant per _business date_ in the merchant's timezone (default `Africa/Algiers`). They are allocated atomically by an upsert on `order_counters (merchant_id, business_date)`.

**D9. Money.** Integer minor units everywhere (`*_minor`), with a currency per merchant. DZD is displayed without decimals using `Intl.NumberFormat`. The server always recomputes totals from DB prices, and `order_items` keep price and name snapshots.

**D10. Numerals.** Arabic UI uses Western digits (`ar-DZ`, `numberingSystem: latn`), which is the everyday convention in Algeria. This is configurable per locale in `src/i18n/format.ts`.

**D11. Locale routing.** next-intl with `localePrefix: "as-needed"`: Arabic (default) has no prefix, French and English use `/fr`, `/en`. This keeps the printed QR URL short and stable (`/s/<slug>`).

**D12. Account state model.** The brief's five states are kept exactly: `pending_payment`, `active`, `past_due`, `suspended`, `canceled`. A free trial is `active` with `subscriptions.is_trial = true`. When a trial expires the account returns to `pending_payment`, not `past_due`, because there was never a paid period. Every transition goes through one pure function, `transition(state, event)`, and one service, `applyAccountEvent`, which locks the merchant row and writes `audit_logs`.

**D13. Rate limiting is Postgres-backed.** Fixed-window counters in `rate_limit_buckets`, one atomic upsert per check. It works across serverless instances with no extra infrastructure. Keys use a salted hash of the IP, never the raw IP. The limiter sits behind an interface, so Upstash/Redis can replace it.

**D14. Security headers.** A nonce-based CSP is set in middleware, plus HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `frame-ancestors 'none'`. This forces dynamic rendering, which the app needs anyway (tenant data). Server Actions keep Next's built-in Origin check. JSON route handlers that mutate state verify `Origin` themselves.

**D15. Visual direction.** The world draws on Kabyle pottery: a fired-clay red shell, slip-white grounds, manganese-black fine line work, and Beni Yenni enamel blue/green and resin amber as state colors. The signature move is a hairline geometric band that inks in as an order waits. Full contract: `.impeccable/surfaces/` (development only, never shipped). Faces: Alexandria (Kufi-geometric display and numerals, Arabic and Latin), Cairo (Arabic UI text), and Inter (Latin UI text). These are variable fonts, self-hosted through `next/font`.

**D16. Platform admins.** Flagged by `profiles.is_platform_admin`, which can only be set by the seed or SQL, never by any API. RLS policies grant admins read access through a `security definer` helper. Admin mutations run through services that re-check the flag.

**D17. A user can belong to several merchants.** The data model is many-to-many through `merchant_members`. The v1 UI uses the user's first membership (owner first). That is the extension point for multi-branch.
