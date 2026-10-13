---
version: 1
slug: "src-app-locale-dashboard-layout-tsx"
primary_target: "src/app/[locale]/dashboard/layout.tsx"
related_targets: ["src/app/[locale]/admin/layout.tsx"]
---

## Scope

Merchant console and platform admin: `/dashboard/*`, `/admin/*`, and the auth pages that lead into them. Visitor mode: **Operate**.

## Audience and job

Owner (setup, menu, QR, staff, billing) and cashier/kitchen staff (live order board), on a cheap Android tablet or phone at the counter, mid-service. Admin: payment approvals and account states.

## Direction contract

THESIS: The console is the shop's counter at arm's length. One deep clay-red rail, a slip-white work ground, and the order number as the only headline. It refuses the category default: a grey SaaS dashboard with one green accent and rows of metric cards.

OWN-WORLD: Kabyle painted pottery. Fired-clay red rail and reversed plates; kaolin-slip ground with near-white work surfaces; manganese brown-black ink for type and 1px line work; red ochre for actions and focus; resin amber = preparing, enamel cobalt = new, enamel green = ready, muted ink = done, deep oxblood = canceled. Alexandria (Kufi-geometric) for numerals and titles; Cairo (Arabic) and Inter (Latin) for UI text. Corners 10–14px, hairline rules, depth only for floating layers. Ornament is a single 45° lattice band and appears only as a functional mark.

STORY: Staff open the console and know within a second whether the shop is live (account state, open, accepting orders) and what needs a hand now. Owners move through menu, shop, QR, staff and billing without hunting. A locked account sees why, and sees the one path out: billing.

FIRST VIEWPORT: Desktop 1440×900. A 248px clay rail on the start side (it flips in RTL) carries the رنّة/Ranna wordmark, the shop name with its live state, and the nav: Orders (live count), Menu, Shop page, QR codes, Staff, Billing, Settings. The top strip on slip ground holds the page title (Alexandria ~28px), the open and accepting switches, language and theme. In the work area, "Service now" shows three lanes (New / Preparing / Ready) as display-scale counts with the wait band under each. Below sit today's totals and the setup checklist. The primary action, "Open the order board", is the screen's single reversed clay plate. Phone: the rail becomes a top bar plus a sheet, and the primary action stays thumb-reachable.

FORM: Kabyle painted pottery (Amazigh ware): candidate 7 of the ordered list, seed key f73af437. Signature move: **the wait band**, a hairline 45° lattice band under each order that inks one lozenge per minute toward the shop's prep target and turns ochre past it.
- Raise (variable-font specimen): hierarchy by scale contrast. The order number is set at display scale against small labels; no badge or box ranks it.
- Raise (transit diagram): every ornament and progress mark sits on one 45°/90° lattice; the pattern system has no curves.
- Raise (timetable slide rack): one element per screen goes to a reversed clay plate, the single most urgent thing.
- Raise (event catalog grid): the board repacks in whole cards and never truncates a card mid-content.
- Raise (catalog sleeve): numbers are names. Orders, invoices and tables are addressed by their number first.
- Alternate kept (warm consumer app surface, competitive on product clarity for the phone flows): action colour only where something can be pressed.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Customer shop and order-status pages are a separate, merchant-branded surface (own brief in phase 3).
