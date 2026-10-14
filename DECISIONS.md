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

## Phase 2: Billing and account states

**D18. Mock gateway for development and tests.** `PAYMENT_PROVIDERS=mock` adds a "test payment" method. Its checkout page lives inside the console, and the result is sent as an HMAC-signed webhook over HTTP to `/api/webhooks/mock`. Signature checks, idempotency and settlement therefore run exactly as they will with Chargily. Never enable `mock` in production.

**D19. Paying early extends, it never overwrites.** A payment received while a paid period or trial is still running adds one interval to the current period end. After the period has ended, the new period starts at the payment date.

**D20. One free trial per merchant.** Tracked by `subscriptions.trial_used`. Canceling during a trial ends it immediately; canceling a paid period takes effect at period end and can be undone until then. `past_due` and `suspended` accounts cancel immediately.

**D21. Plan changes.** Choosing another plan while subscribed queues it for the next renewal (`pending_plan_id`). Paying for a different plan switches immediately.

**D22. Invoices.** Numbers come from a Postgres sequence (`RN-2026-000042`). An open, unexpired invoice for the same plan is reused, so retries and double clicks never create duplicates.

**D23. Webhook ledger.** `webhook_events (provider, event_id)` is unique. A replayed event returns 200 with no side effects. An event that was recorded but never finished is processed again, and settlement is idempotent on its own as well. Unknown payments are acknowledged with 200 so providers stop retrying. Processing errors return 500 so the provider retries.

**D24. Receipts.** Stored in the private `receipts` bucket, checked by content (magic bytes) and size, with images compressed in the browser first. Only platform admins see them, through signed links that expire after 5 minutes.

**D25. Emails.** A `Mailer` interface with a `log` implementation (bodies printed in development only, never in production logs) and a `resend` implementation. Account changes and receipt rejections email the owner in their own language.

**D26. Shop creation is serialised per user.** Found during browser verification: on the first visit after signing up, the console layout and page render in parallel and both created a shop. Creation now takes a per-user advisory lock, covered by a regression test that fails without the lock.

## Phase 3: Shop builder

**D27. Customer surface structure: the ticket builder.** From the surface roll (seed `18468747`): a merchant-branded menu with a docked order "ticket" that grows as items are added and, once placed, becomes the numbered order ticket on the status page. The contract is in `.impeccable/surfaces/` (development only). The menu is built in this phase; the ticket arrives with ordering in phase 5.

**D28. Merchant branding is enforced, not trusted.** `shopTheme()` derives the customer palette from any two colours. Text on a brand fill is white or ink, whichever has more contrast. Brand-coloured text on the page is darkened until it reaches 4.5:1 (`--brand-ink`). The editor shows a warning whenever a colour had to be corrected or still falls short. Brand fill appears only in the header band and the single primary action.

**D29. Curated fonts.** Eight Google faces with Arabic and Latin coverage, declared through `next/font` with `preload: false`. `@font-face` is lazy, so a shop downloads only its own face.

**D30. Slug redirects.** Changing the link records the old slug in `slug_redirects`, so `/s/old` answers with a 308 to `/s/new` and printed QR codes keep working. An owner can reclaim their own old slug. A slug that is, or was, another shop's is refused. Reserved words cover routes and impersonation risks.

**D31. Public data is cached with tags.** The slug lookup and the public menu are cached for 60 s with tags (`shop:<id>`, `shop-slug:<slug>`). Every menu, branding, slug and account change invalidates them. The page itself stays dynamic for the CSP nonce.

**D32. "Can a customer order now?" is one function.** `storefrontStatus()` requires all four: account live (active or in grace), shop switched open, inside posted opening hours (overnight hours supported), and taking orders. The phase 5 order endpoint will reuse it.

**D33. Language fallback.** A visitor whose language the shop doesn't offer is redirected to the shop's main language. Menu texts fall back to the untranslated base name. Search ignores Latin accents and Arabic diacritics and letter variants.

**D34. Images.** Logos, covers and dish photos are compressed in the browser (WebP, max 512/1600/1200 px), checked by content on the server, and stored under the merchant's own prefix in the public bucket. A replaced image's old file is deleted after the new record saves. An upload that is never saved can leave a stray file; a storage sweep is a possible later job.

**D35. Staff may pause orders.** "Taking orders" can be paused by any member during a rush. "Open/closed" and everything else in the shop editor is owner-only.

**D36. Week order.** The hours editor lists Saturday first, matching the Algerian working week. Day names come from `Intl`.
