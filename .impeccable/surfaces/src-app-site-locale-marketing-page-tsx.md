---
version: 1
slug: "src-app-site-locale-marketing-page-tsx"
primary_target: "src/app/(site)/[locale]/(marketing)/page.tsx"
related_targets: ["src/app/(site)/[locale]/(marketing)/legal/[doc]/page.tsx"]
---

## Scope

Public marketing surface: the landing page `/` (with pricing and FAQ sections) and the legal pages `/legal/terms`, `/legal/privacy`. Visitor mode: **Persuade** (landing); legal pages are **Read**.

## Audience and job

Owners of small restaurants, cafés, food trucks and snack shops, mostly in Algeria, Arabic first. They must believe their counter gets calmer (no crowd, no shouted numbers, no lost pagers) and that it works on customers' own phones with no app. Action: create a shop (name it here, then sign up). Proof available: the product itself (the real demo shop and its real ring), real configured plan prices. No customers, testimonials, logos or metrics exist: none are invented.

## Direction contract

THESIS: The page is the counter, before and after. One full-bleed counter band the visitor sweeps from the crowded "before" (shouted numbers, pagers) to the calm "after" (phones holding numbered tickets, one ringing in enamel green). It refuses the category default: a split hero with a phone mockup, a logo strip and three feature cards.

OWN-WORLD: Kabyle painted pottery, as established: fired-clay rail red as whole fields, kaolin-slip ground, manganese ink, red-ochre action, enamel green reserved for "ready". Alexandria numerals and titles, Cairo/Inter text. One 45° lattice band as the only ornament; the band is also the sweep handle's track.

STORY: In one viewport the visitor sees the crowd become calm under their own hand, reads the one-line promise, and can name their shop and start. Below: how it works (table tent → order → ring) shown with real interface fragments; scan the demo shop's QR and get rung for real; what rings on which phone, honestly; prices; questions; a closing clay plate with the same start form.

FIRST VIEWPORT: Desktop 1440×900. Top: wordmark and nav. Upper third: headline in Alexandria (~64px, two lines) at the reading start, one-line body, and the working start action inline: "Your shop's name" field + "Create my shop" (ochre). Lower two thirds: the counter band, edge to edge, ~440px tall. Before half on a clay field: big order numbers 101–118 jostling at angles in slip white, crossed pager glyphs, a caption. After half on slip ground: five phone tickets in a calm row, numbers set straight, one ringing green with a halo. A vertical lozenge-handle divider at 50%, draggable, keyboard slider (arrow keys), mirrored in RTL (before sits at the reading start). Phone: headline, start form, then the band at full width with the handle.

FORM: "Counter before and after" (seed d5f388cc, dealt index 7, lead), with dealt structures 3 ("Try it on your phone": the demo QR section) and 1 ("Live ring": the how-it-works ring fragment) carried as sections. Raise, from the oscilloscope challenger (declined): the untriggered/triggered discipline: the before side never sits still (slow restless jitter of its numbers, reduced-motion still), the after side locks dead calm except the one ring. Raise, from the toy-catalogue challenger (declined): total colour commitment: both halves are full-bleed fields, never cards on a neutral page.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

Plan prices are placeholders configured in `src/config/plans.ts` (shown as configured). Legal pages are drafts to be reviewed by a lawyer before launch.
