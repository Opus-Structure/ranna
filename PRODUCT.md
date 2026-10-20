# Product

<!-- impeccable:product-schema 1 -->

> Source: written from the owner's master brief (2026-10-13). The owner asked for no interview, so nothing here was confirmed in a Q&A round. Lines marked _(inferred)_ are my reading of the brief, not the owner's words.

## Platform

web

## Stack

Pinned by the brief: Next.js 15 (App Router), TypeScript strict, Tailwind CSS, shadcn/ui, Neon (Postgres + RLS, Managed Better Auth, Realtime, Object Storage; Supabase until D80), Drizzle ORM, Web Push (VAPID) + service worker + PWA manifest, `qrcode`, Zod, React Hook Form, next-intl, Vitest, Playwright. Deploy target: Vercel + Neon.

## Users

- **Merchant owner**: runs a small restaurant, café, food truck, or snack shop. Mostly in Algeria. Signs up, pays a monthly subscription, sets up the shop page and menu, prints QR codes, and manages staff and billing.
- **Merchant staff (cashier / kitchen)**: works the live order board during service, often on a cheap Android tablet or phone propped by the counter, with greasy hands and noise around. Moves orders through their states and presses "Ready" to call the customer. Has no access to billing or settings.
- **Customer**: anonymous and walking in. Scans a QR code with the phone camera, orders without an account, then waits nearby (a table, outside, in a queue) until their phone rings. Often on a low-end Android phone with a slow 3G/4G connection.
- **Platform admin (us)**: approves manual payments, suspends accounts, and watches platform metrics.

## Product Purpose

Replace the restaurant's pager and the shouted order number with the customer's own phone. Scan the QR code, order, and get rung when the order is ready, with no app to install. Success for the merchant: fewer crowds at the counter, no lost pagers, orders arrive clean. Success for the customer: a fast order, then freedom to wait anywhere until the phone calls them.

## Positioning

A merchant-branded mini-app that combines **ordering** with a **layered "ready" alert**: web push, a looping sound, vibration, a flashing screen, and a wake lock, with SMS/WhatsApp and a big call-out screen as fallbacks. It is honest about platform limits (iOS needs the page on the Home Screen to get push). Built for Arabic-first, RTL, DZD, and local payment rails (Chargily: EDAHABIA/CIB; manual BaridiMob / bank transfer), not translated in afterwards.

## Operating Context

- Service happens at the counter, under time pressure. The order board must work at arm's length on a tablet, with big tap targets, an audible new-order chime, and glanceable columns.
- Customers order standing up, one-handed, and often outdoors.
- The ready moment is the emotional peak of the product: the phone has to be impossible to miss and easy to dismiss ("Got it, I'm coming").
- Payment for food is at the counter in v1. Merchants pay their subscription by Chargily checkout or by manual receipt upload that an admin approves.
- Printed artifacts: A4 sheets and table tents carrying the shop logo, the QR code, and "Scan to order".

## Capabilities and Constraints

- Three languages: Arabic (default, RTL), French, English. Currency is per merchant (default DZD, shown without decimals).
- Account states: `pending_payment`, `active`, `past_due` (grace), `suspended`, `canceled`. Outside active/grace, the shop page is neutral "temporarily unavailable" and the dashboard is read-only except billing.
- Order numbers are short and human (101, 102…) and reset daily per merchant. The order token is a 128-bit secret.
- Customer data is minimal: a name or nickname, plus an optional phone number used only for fallback alerts, with a retention purge.
- Out of scope for v1: customer online payment, delivery, inventory, loyalty, multi-branch, native apps, printers/KDS hardware, POS integrations.
- Working brand name: **Ranna / رنّة** ("a ring, a chime") _(inferred; the brief uses a `{{BRAND_NAME}}` placeholder, so the name lives in one config file and can be renamed)_.
- Prices for the Starter / Pro / Business plans are placeholders in config, not decided.

## Brand Commitments

- Clean, modern, confident, warm. Generous spacing, rounded corners, strong typography, subtle motion. _(brief, binding)_
- Customer shop pages are driven entirely by each merchant's colors and logo, with readable contrast enforced automatically. _(brief, binding)_
- Full dark mode on the merchant dashboard. _(brief, binding)_
- Arabic type: Cairo or Tajawal suggested. Latin: Inter suggested. _(brief, "e.g.", so suggested rather than binding)_
- All design, copy, components, and code are original.

## Evidence on Hand

- No real merchants, testimonials, logos, metrics, or press exist. Never invent them. The demo shop and its menu are synthetic and must be labelled as a demo.
- No photography or brand assets exist yet.

## Product Principles

1. **The ring must land.** Every layer of the ready alert is designed, tested, and honest about what each platform allows.
2. **Counter-speed first.** Staff screens are judged at arm's length, mid-rush, on a cheap tablet.
3. **The merchant's brand, our structure.** Customer pages wear the merchant's identity. The platform supplies the rhythm, legibility, and guarantees.
4. **Arabic is home, not a translation.** RTL, Arabic numerals policy, and local payment rails are first-class.
5. **Light on the wire.** Customer pages stay small and fast on slow networks and old phones.

## Accessibility & Inclusion

- WCAG 2.2 AA: semantic HTML, visible focus states, labels, and aria-live order status updates. _(brief)_
- The ready alert never relies on a single channel: sound, vibration, visual flash, and text are all present. Users with reduced-motion settings get a non-strobing visual alert _(inferred)_.
