# Ranna (رنّة): build plan

Multi-tenant QR ordering with an "order ready" ring. The working brand name lives in `src/config/brand.ts`.
Stack: Next.js 15 App Router · TypeScript strict · Tailwind v4 + shadcn/ui · Neon (Postgres + RLS, Managed Better Auth, Realtime, Object Storage; Supabase until D80) · Drizzle · next-intl (ar default / fr / en) · Web Push · Vitest · Playwright.

## Architecture in one screen

```
Browser (customer)          Browser (merchant/staff)        Browser (admin)
  /s/[slug]  /o/[token]       /dashboard/*                    /admin/*
     │  ▲ broadcast              │  ▲ postgres_changes (RLS)      │
     ▼  │                        ▼  │                             ▼
  Next.js server (route handlers + server actions, all Zod-validated)
     │ withRls(claims) ── role=authenticated, RLS enforced ──┐
     │ serviceDb ── system jobs, explicit tenant scoping ────┤
     ▼                                                       ▼
  Supabase Postgres (RLS on every table) · Auth · Storage · Realtime
     ▲
  Chargily webhook (HMAC) · Vercel Cron (daily) · Web Push (VAPID)
```

Domain logic is pure and unit-tested (`src/lib/**`): pricing, order transitions, subscription state machine, slug rules, contrast, webhook verification. I/O sits behind small interfaces (`PaymentProvider`, `NotificationChannel`, `Mailer`, `RateLimiter`, `RealtimePublisher`).

## Phases (each phase ends green: lint, type-check, tests; then a commit)

1. **Foundation**: scaffold, Tailwind tokens (Kabyle clay/slip/enamel world, light + dark), fonts, next-intl with RTL, Supabase local config, Drizzle schema for _all_ tables, RLS policies + helper functions, auth (password + magic link), profiles, roles, middleware (i18n + session + CSP), dashboard/admin shells, `.env.example`.
2. **Billing & account states**: plans seed, pure state machine + `applyAccountEvent` service with audit log, mock + manual providers, receipt upload, admin approvals, gated dashboard (locked / read-only).
3. **Shop builder**: setup wizard, branding editor + live phone preview, contrast guard, menu CRUD (categories DnD, items, option groups), client-side image compression and storage upload, public shop page.
4. **QR codes**: main + per-table QR, SVG/PNG export, client-built A4 sheet + table-tent PDF, slug change with redirects.
5. **Ordering**: cart (localStorage), options and notes, honeypot + rate limit, server-side totals and snapshots, daily order numbers, `/o/[token]` with realtime + polling fallback.
6. **Order board**: realtime columns, new-order chime, actions (accept, prepare, ready, complete, cancel with reason, re-ring), history + CSV, staff invites, call-out screen.
7. **Ring system**: service worker + VAPID push, per-order manifest, enable-alerts UX, iOS Home Screen guide, looping WebAudio alarm, vibration, wake lock, flash, acknowledgement, SMS/WhatsApp adapter + mock, delivery tracking, cleanup.
8. **Chargily + cron**: Chargily v2 checkout + signed idempotent webhook, daily cron (reminders, past_due → suspended, trials, cancellations, phone purge, push cleanup).
9. **Marketing + demo**: landing, pricing, FAQ, legal pages, seeded demo shop, empty/error/loading states, a11y pass.
10. **Hardening**: security review, tenant-isolation tests, Playwright full-loop e2e, Lighthouse pass on the shop page, README (setup, env table, Mermaid, deploy, notification limits).

## Definition of done per phase

`npm run lint && npm run typecheck && npm test` passes · the app boots (`npm run dev`) · `git commit` · a 5-line summary.
