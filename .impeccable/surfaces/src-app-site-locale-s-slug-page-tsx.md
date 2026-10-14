---
version: 1
slug: "src-app-site-locale-s-slug-page-tsx"
primary_target: "src/app/(site)/[locale]/s/[slug]/page.tsx"
related_targets: ["src/app/(site)/[locale]/o/[token]/page.tsx"]
---

## Scope

Customer surfaces: the public shop page `/s/[slug]` (browse, build the order) and, from phase 5, the order status page `/o/[token]` (the same ticket, now numbered). Visitor mode: **Operate**. Merchant-branded: colours, logo, cover and font come from each merchant; structure, rhythm, legibility and guarantees come from us.

## Audience and job

A walk-in customer on a cheap Android phone, one hand, often outdoors, slow 3G/4G. Job: find food, add it, name the order, place it, then wait anywhere until the phone rings.

## Direction contract

THESIS: The customer builds a ticket, not a cart. A docked order ticket grows at the bottom of a merchant-branded menu and, once placed, becomes the order's own ticket with its number — the one the phone rings for. It refuses the food-delivery default: hero banner carousel, cart icon with a red badge, promo chips.

OWN-WORLD: The merchant's colours, logo and chosen face on a quiet warm-white ground (#fbfaf8). Brand fill appears in exactly two places: the header band and the single primary action. Text in brand colour uses the contrast-corrected `--brand-ink`. Prices are tabular and aligned at the line end. Our structural mark is the 45° lattice band, used as the ticket's perforated top edge in brand ink.

STORY: Scan; know whose shop this is and whether it is taking orders in one glance; find a dish by category chip or search; tap to add (options in a bottom sheet); watch the ticket grow line by line; name it; place it; keep the same ticket as the status page while waiting.

FIRST VIEWPORT: Phone 390×844. Header band in brand colour (cover photo when set, with a scrim) carrying the logo, shop name, open/closed state and the welcome line. Below it sticky category chips with a search button. Then items: rows (name, one-line description, price at the end, square thumbnail at the end) or a two-column grid when the merchant picks grid. The docked ticket at the bottom: line count · total · "Review order", in brand fill — the screen's single brand plate, thumb-reachable.

FORM: Ticket builder — candidate 7 of the ordered list, seed key 18468747. Signature: **the ticket** — a perforated lattice top edge; it grows with each add; after placing it turns into the numbered order ticket on `/o/[token]`.
- Raise (boarding pass and gate board): one alert colour reserved for change. A status change holds that colour until the customer acknowledges it, and the ticket's number is its sequence number in tabular display numerals.
- Declined: full-screen vertical media feed (one item per screen fights a 40-item menu); orienteering map; gridded type specimen (kept only its scale contrast, for the order number).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Constraints

Small JavaScript on these pages (server components first; the ticket and item sheet are the only client islands). Images lazy, sized, WebP. Lighthouse mobile 90+ target. RTL-first. No account, no app install.
