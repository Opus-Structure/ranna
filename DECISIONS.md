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

## Phase 4: QR codes

**D37. QR content is the shop page link.** The main code is `https://<domain>/s/<slug>`; table codes append `?t=<code>`. Changing the slug keeps printed codes working through the phase 3 redirects, which preserve `?t=`. Error correction "M" survives a crumpled tent while keeping modules large.

**D38. Downloads.** SVG (vector, about 3 KB) and a 2048 px PNG with the standard 4-module quiet zone come from an owner-only endpoint, `/api/qr`.

**D39. Printable PDFs are built in the browser.** Each card is painted on a 300 dpi canvas, so the browser shapes Arabic and renders the merchant's own font, then `pdf-lib` (loaded only on click) places the images on A4. This avoids server-side Chromium and Arabic-shaping hacks in a PDF library. The table tent prints its top half upside down, so both faces read correctly when folded; A4 sheets hold four A6 cards with cut guides. "Scan to order" appears in every shop language, main language first.

**D40. Table codes.** 1–12 characters `[A-Za-z0-9_-]`, unique per shop, managed one at a time or as a numbered series (at most 100 per series; existing codes are skipped). The label ("Table 5") is what staff see on the order.

**D41. Removed an unused dependency.** The shadcn CLI had installed an npm package called `cn` to satisfy an import it generated. The import was rewritten to `@/lib/utils` in phase 1, so the package was removed in phase 4.

## Phase 5: Ordering

**D42. The server prices every order.** The browser sends only item ids, option ids, quantities and notes. `priceOrder()` rebuilds each line from the live menu: the item must exist and be available, options must belong to it and respect each group's min/max, quantities are 1–50, lines at most 30. Names, translations and prices are snapshotted onto `order_items` (with a `position` for display order), so editing the menu never changes a placed order. v1 has no fees or discounts, so the total equals the subtotal; customers pay at the counter.

**D43. Daily order numbers start at 101.** Each shop has a counter per business date in its own timezone, incremented atomically in the placing transaction. The numbers are short, easy to call out, and never confused with a quantity ("2"). The number restarts each day; the id and the token stay unique.

**D44. The customer's link is the credential.** Placing returns a 128-bit token: HMAC(APP_SECRET, merchant id + client request id), base64url. Only its SHA-256 is stored. The status page `/o/<token>` and `/api/orders/<token>` need nothing else: no account, no cookie. The page is `noindex` and never sends its URL to another site (`Referrer-Policy: same-origin`; `no-referrer` would make browsers send `Origin: null` on form posts, which CSRF checks refuse). The browser keeps its last ten orders locally ("Your order 108" chip on the shop page for 12 h).

**D45. Placing is idempotent.** The ticket generates one `clientRequestId` per attempt and reuses it on retry. A unique index on (merchant, clientRequestId) plus the deterministic token means a double tap or a resend after a dropped connection returns the same order instead of a second one.

**D46. Abuse controls on public ordering.** A hidden honeypot field (filled ⇒ rejected as `invalid`) and two rate limits: per IP across all shops, and per IP per shop (5 per 5 min). The monthly order cap from the plan answers "the shop can't take more online orders right now", never an error about billing. A CAPTCHA can be added at the marked hook in `placeOrderAction` without touching the service.

**D47. Live status with a polling safety net.** Status changes go out as Supabase Realtime Broadcast messages (sent by the server over REST with the service key) on a topic derived from the token hash. The page subscribes with the anon key; the topic is unguessable, and its payload carries only number, status and times. It also polls every 15 s and on focus, visibility and reconnect, because cheap phones and patchy 4G drop sockets. The "Live / Reconnecting…" pill tells the truth about the socket.

**D48. Reserved colour for "ready".** On the customer page the enamel green `--state-ready` appears only when the order is ready: the number plate fills with it and a slow halo pulses (no opacity flicker, disabled under reduced motion). The three-step track uses lozenges from the band motif. Phase 7 adds the sound, vibration and push alert.

**D49. The demo seed uses stable ids and synthetic orders.** `npm run seed` rebuilds the demo menu with name-based UUIDs, so saved tickets and the 60 s menu cache stay valid. It then places seven orders through the real `placeOrder`/`setOrderStatus` code, covering every state. Demo orders are wiped and replaced on each run.

## Phase 6: Order board and staff

**D50. The board listens to Postgres changes but trusts only the server.** The board subscribes to Supabase Realtime `postgres_changes` on `orders`, filtered to the shop and authorized by RLS with the signed-in member's session. An event only means "something changed": the board is re-read through a server action (debounced 250 ms, coalesced while a read is in flight). It also polls every 20 s and on focus, visibility and reconnect. Moves are optimistic (the card jumps lanes at once) and roll back with a message if the server refuses (e.g. another device moved it first). Two traps found while testing: the socket must join only after the browser has loaded the session (`setAuth` with the user's token; joined as `anon` it silently receives nothing), and each mount uses its own topic, because leaving a channel removes the server-side subscription of every channel sharing that topic on the socket.

**D51. Board shape.** Three lanes: New (new + accepted), Preparing, Ready. Each card has one large primary action for the obvious next step (Start preparing → Ready → Collected). The rarer moves are in a menu so a hurried tap can't hit them: mark ready straight from New, "Not ready yet" from Ready, and cancel. Cancelling requires a reason (quick picks or free text) because the customer reads it. Open orders show whatever their day, so a forgotten ticket never disappears at midnight. "Finished today" lists the day's last 24 completed or canceled orders. On phones the lanes become a three-way switcher that keeps every count visible.

**D52. New-order chime.** Two short WebAudio tones, with no audio file. Browsers allow sound only after a tap, so the board unlocks audio on the first touch and shows a "Turn on the new-order sound" button until then. The setting (on/off) is per device. The tab title carries the count of new orders.

**D53. Call-out screen.** `/screen` runs outside the console frame for a display that customers can see. It shows numbers only, never names. Ready numbers take two thirds of the width in the reserved enamel green; a number that just turned ready is ringed for a minute and chimes once. "Start the screen" (one tap) shows the screen at once, then tries to unlock sound, enter full screen and take a screen wake lock; none of these may block it, since a display without speakers can leave audio start-up pending for ever. Numbers already ready at start are not announced.

**D54. History and export.** Any member can browse a business day with status and number/name/table filters; the day's totals ignore the filters. CSV export is owner-only (it carries customer names) and never includes phone numbers. The CSV has a UTF-8 BOM so Excel opens Arabic correctly, money in major units with a dot, times in the shop's timezone. Cells that a spreadsheet would run as formulas (`= + - @`) are prefixed with an apostrophe.

**D55. Staff invitations.** The owner invites by email; a member's role is always `staff`, and owners can't be removed through this path. The token is 256 random bits, stored only as a SHA-256 hash and valid for 7 days. Re-inviting the same address replaces the earlier link. Pending, unexpired invites count against the plan's `maxStaff`, checked under an advisory lock so parallel invites can't overrun it. The link is emailed and also shown once to the owner, because email is unreliable for many small shops in Algeria and they will pass it on by WhatsApp. Joining requires being signed in with the invited address, so a forwarded link is useless to anyone else. New staff create their account on the invite page itself: no shop name is stored, so no shop is created for them, and the confirmation email brings them back to join. Invites, joins and removals are written to the audit log.

## Phase 7: Ring system

**D56. Three layers, honestly labelled.** (1) The open status page rings by itself: Realtime + polling bring "ready", and the page takes over with a full-screen enamel-green alert, a looping WebAudio alarm, vibration and a "Got it, I'm coming" button. (2) Web Push reaches closed or sleeping pages. (3) An SMS/WhatsApp fallback (adapter interface; v1 ships a mock) is tried only when no push got through, the shop enabled it and the customer left a phone number. The page tells each customer what will work on _their_ phone ("Notifications are blocked: keep this page open"); it never promises a ring it can't deliver.

**D57. iPhone.** iOS only delivers web push to sites added to the Home Screen (iOS 16.4+), and an open Safari tab can't play sound until tapped. So on iPhone Safari the page offers "Ring me on this page" (unlocks sound, keeps the screen on) plus a three-step "Add to Home Screen" guide. Each order has its own web app manifest whose `start_url` is the order page, so the installed icon opens straight onto it, where the customer arms push. Recorded as a platform limit in the README, not hidden.

**D58. Push endpoints are allow-listed.** The server POSTs to whatever endpoint a browser registers, so only HTTPS endpoints on the known push services (FCM, Mozilla, Apple, Windows) are accepted, with no ports or credentials: otherwise "subscribe" would be a request-forgery primitive. At most 5 subscriptions per order; subscriptions answered 404/410 are retired, and after 3 consecutive failures they are no longer tried. Messages use high urgency and a 15-minute TTL (a stale "ready" is noise) and are tagged per order, so a re-ring replaces the earlier notification instead of stacking.

**D59. Ringing is awaited and recorded.** "Ready" awaits the push fan-out (8 s timeout per send, all in parallel), because serverless platforms may kill un-awaited work after the response. Every attempt lands in `notification_events` (sent / failed / skipped with the reason, e.g. `no_subscription`, `provider_mock`). The mock fallback is recorded as skipped, never as delivered.

**D60. Re-ring and acknowledgement.** Staff can "Ring again" on ready orders: at most once per 30 s per order and 6 rings in total, checked through RLS (only the shop's members get the order). A re-ring clears the customer's acknowledgement and restarts the alarm on the open page (a "ring" broadcast) and on phones (push). A fresh "Ready", including after "Not ready yet", also clears an earlier acknowledgement. "Got it, I'm coming" is idempotent, stops the alarm on every open copy of the page and shows "Customer is on the way" on the board. The alarm stops by itself after 3 minutes, and the flash alternates under once per second (well inside WCAG 2.3.1) and is skipped under reduced motion.

**D61. Icons and the service worker.** App icons are generated from the brand mark by `npm run icons` (sharp), so they are reproducible and their provenance is recorded. `public/sw.js` handles push and notification taps only: it caches nothing, because order pages must always be live.

## Phase 8: Chargily Pay and daily jobs

**D62. Chargily Pay V2, as documented.** Checked against dev.chargily.com on 2026-10-14: base URL `https://pay.chargily.net/test/api/v2` or `/api/v2` (the secret key's mode must match), `POST /checkouts` with `Authorization: Bearer <secret key>`, currency `dzd`, `success_url`, `failure_url`, `webhook_endpoint`, `locale`, `description`, `metadata` (our payment id and invoice number). Webhooks carry a `signature` header: hex HMAC-SHA256 of the raw body keyed with the same secret key, verified over the exact bytes received (the docs' Node sample re-serialises the JSON, which would break verification). `checkout.paid` → succeeded, `checkout.failed` / `checkout.canceled` → failed, anything else is acknowledged and ignored. **Unconfirmed:** the docs never state the unit of `amount`; their examples are whole dinars, so we send whole dinars (`toChargilyAmount` refuses non-whole amounts and other currencies). Confirm with one test-mode payment before going live.

**D63. A paid webhook must match what we asked for.** Any provider that reports an amount gets it checked by the generic webhook pipeline. A "paid" event whose amount or currency differs from our payment is acknowledged (so the gateway stops retrying), logged as `amount_mismatch` in the webhook ledger and never activates a plan; an admin resolves it. A test-mode event can never settle a live payment. Chargily is offered on the billing page only once `CHARGILY_SECRET_KEY` is set.

**D64. One daily job, idempotent tasks.** Vercel Cron calls `GET /api/cron/daily` at 04:00 UTC (05:00 in Algiers) with `Authorization: Bearer $CRON_SECRET`, compared in constant time; without a configured secret the endpoint refuses to run. Tasks, each isolated so one failure doesn't stop the rest: period checks (ended paid period → past due with grace; grace over → suspended; ended trial → pending payment; cancel at period end → canceled), owner emails for each change; one renewal reminder per period 3 days before it ends (payments are one-off, so the reminder is the renewal), deduplicated through the audit log; customer phone purge after each shop's `phoneRetentionDays` (default 30, clamped to 1–365); push subscriptions dropped a day after their order closes (or after 7 days, or once dead); rate-limit buckets older than a day; invitations 30 days past expiry or acceptance; notification events after 90 days. The response lists what each task did.

## Phase 9: Marketing site and polish

**D65. The landing is the counter, before and after.** Built from the impeccable surface roll (seed `d5f388cc`, contract in `.impeccable/surfaces/src-app-site-locale-marketing-page-tsx.md`). The owner's brief forbids questions, so the dealt lead structure was built directly instead of presenting the decision page. The first viewport holds the promise, the working action (name your shop → sign-up with the name prefilled, a plain GET form that works without JavaScript) and the counter band: a full-bleed scene the visitor sweeps (a real range input, keyboard and RTL aware) from the crowded clay "before" to the calm "after". Below it: the three moments as real interface fragments, the counter side, the real demo, what rings on which phone, prices, questions, and a clay closing plate with the same action. No testimonials, logos or metrics: none exist.

**D66. The demo café rings for real.** The demo shop has no staff, so its fresh orders advance by themselves when the customer's page polls (Preparing after 20 s, Ready after 50 s), through the real status service, so a visitor who orders from it gets the real ring. Only the shop flagged `is_demo` is touched, and only orders under 10 minutes old (the seeded board stays as seeded). The page says so in plain words.

**D67. Prices are shown as configured.** The pricing ledger reads the active plans (cached 5 minutes, invalidated when an admin edits a plan) and shows price, menu items, staff seats, monthly orders and trial as configured; no "most popular" badge, which nothing backs. The configured prices are still placeholders (PRODUCT.md).

**D68. Legal pages are honest drafts.** Terms and Privacy describe the product as built (data kept, retention and purge, processors, cookies, Algerian Law 18-07) in all three languages, with bracketed placeholders for the operator's legal identity and a visible note that a lawyer must review them before launch.

**D69. States and accessibility.** The customer pages get loading skeletons (slow 3G) and the app a self-contained global error page in all three languages. Playwright now runs axe (WCAG 2.2 A/AA rules) over the public pages in all three languages on desktop and phone. It found one issue: sold-out dishes dimmed their whole row, which dropped the "Sold out" chip below 4.5:1. Now only the photo dims and the name is struck through.

## Phase 10: Hardening

**D70. Session cookies.** Supabase session cookies are now explicitly `Secure` in production and `SameSite=Lax`, on the server, middleware and browser clients alike. They cannot be `HttpOnly`: the browser client reads the session to authorise Realtime for the order board (D50). The defence against script injection is the nonce-based CSP with `strict-dynamic` (no inline or third-party scripts; `unsafe-eval` only in development), plus React's escaping and no raw HTML except our own generated QR SVGs.

**D71. Security review.** Every Server Action re-checks authorisation itself (owner/member/admin helpers or a session check plus a rate limit), never trusting the page that rendered it. Every route handler is authenticated by its own means: owner session (QR, CSV), the 128-bit order token (status, manifest), token plus same-origin check and rate limit (push subscribe, acknowledge), provider HMAC over the raw body plus idempotency ledger and amount check (webhooks), constant-time cron secret (closed when unset), safe `next` paths (auth). Logs never contain tokens, keys, push endpoints, full phone numbers or production email bodies. A new schema-driven test fails if any public table lacks RLS, if a member can read another shop's rows in any table with a `merchant_id`, or if `anon` can read any row.

**D72. Metadata in the head.** Next 15 streams page metadata into the body for clients it doesn't class as limited bots, so Lighthouse (and some link previews) saw no meta description. `htmlLimitedBots: /.*/` makes every response carry `<title>` and `<meta>` in the `<head>`; our metadata resolves fast, so the first byte isn't delayed.

**D73. Measured, not claimed.** `npm run lighthouse` runs Lighthouse with mobile settings against a production build (Chromium from Playwright over the debugging port, because Lighthouse's own launcher fails on Windows). Measured on 2026-10-14 (local production build, simulated throttling): shop page performance 93–95, accessibility, best practices and SEO 100; landing performance 89–90 (its largest paint is the display headline). `npm run test:e2e` covers the full order → ready → ring → acknowledge loop as two people and an axe WCAG 2.2 scan. `npm run setup:env` writes `.env.local` from local Supabase and generated secrets, so a fresh clone runs in about 10 minutes.

**D74. Test the production build, not only dev.** Running the Playwright suite against `next build && next start` found a bug dev mode hides: the legal pages were statically prerendered (`generateStaticParams`), but the layout reads request headers for the CSP nonce, so French and English legal pages answered 500 in production. They now render per request like every other page (D31). The full suite (end-to-end loop and accessibility, desktop and phone) passes against the production build.

## Post-launch changes (2026-10-15)

**D75. Packs and prices from the owner's price sheet.** Three yearly packs with 90 days free: Starter 3 999 DZD (50 dishes = 5 categories of 10, 10 table QR codes), Diamant 5 999 DZD (500 dishes = 10 × 50, 30 table QR codes), Professional 19 999 DZD (unlimited categories and dishes, 30 table QR codes). Plan codes are now `starter`, `diamant`, `pro`; the earlier `business` plan is deactivated (shops on it keep working). A new `maxTables` limit is enforced when adding table QR codes (single and series) and editable in Admin → Plans. "Unlimited dishes" is stored as 100 000 and shown as unlimited. The sheet also lists a free custom domain, a professional email, and a delivery account for deliverers: none exist in the product (delivery is out of scope for v1), so they are not shown or promised. Pricing is presented as three pack columns with the same honest list for each.

**D76. Legal pages follow Algerian law.** Rewritten against Law 18-07 (as amended by Law 25-11 of 24 July 2025, per DLA Piper; not read in the official text), the ANPDP's published guidance on declaration and authorisation, Law 18-05 (e-commerce) and Law 09-03 (consumer protection): controller/processor roles (shop controls customer data; we process for it), consent for the optional phone number and notifications, retention, data subject rights and complaint to the ANPDP, transfer abroad (hosting is outside Algeria, so authorisation applies), breach notification, children, seller obligations, Arabic prevails, Algerian governing law, invoice mentions (RC, NIF, NIS, AI). **Not verified and left for an Algerian lawyer:** article numbers (deliberately not cited), the exact 25-11 changes, whether the platform must be hosted in Algeria or hold a .dz name under Law 18-05 (secondary sources conflict), VAT display, the 10-year accounting retention, and the exact breach-notification period. Bracketed fields are the operator's own details and ANPDP references.

**D77. Hosted on Vercel with a marketplace Supabase.** Production is https://ranna-delta.vercel.app (Vercel project `ranna`, connected to the GitHub repo, so every push to `master` deploys). The database is a Supabase project on its free plan created through the Vercel Marketplace integration (Supabase's marketplace terms were accepted by the CLI at the owner's request), which injects the Supabase keys and `POSTGRES_URL*` as project env vars. `DATABASE_URL` is the integration's transaction pooler URL with its `supa=` parameter dropped (postgres.js would send it to the server as a setting). Migrations were applied with `supabase db push --db-url`; plans, the platform admin (the owner's email) and the demo café were seeded. Production runs `PAYMENT_PROVIDERS=manual` (no Chargily key yet), `MAILER=log`, new `APP_SECRET`, `CRON_SECRET` and VAPID keys. Free-tier limits to know: Supabase pauses idle projects after a week, and its built-in auth email sender is rate-limited to a few emails an hour (set a custom SMTP for real use). **Manual step:** the marketplace gives no management API token, so Auth → URL Configuration (Site URL and redirect URLs) must be set once in the Supabase dashboard (D77 checklist in README).

**D78. Revised packs, middle pack as the offer (2026-10-15).** After the owner's pricing note: Starter 4 999 DZD (30 dishes, 5 table QR codes, 1 staff), Diamant 7 999 DZD (250, 25, 5; highlighted "most popular", recommended for restaurants and cafés), Professional 17 999 DZD (unlimited dishes and tables, 15 staff). All yearly with 90 days free. The note's "multi-branch / priority support" is not shown, because the product has neither (multi-branch is out of scope for v1). Cards now list only what differs between packs (dishes, tables, staff); what every pack includes is said once under them. Supersedes the numbers in D75.

**D79. A six-second demo.** The demo café's orders go Preparing after 1 s and Ready after 4 s, and its order page checks every second (other shops stay at 15 s plus realtime). "Place order" also unlocks the alarm audio during the tap itself: the order page is a soft navigation, so the unlocked audio context carries over and the beep isn't blocked by the browser's autoplay rule. Measured on the local demo café: 5.9–6.5 s from tapping Place order to the full-screen ring.
