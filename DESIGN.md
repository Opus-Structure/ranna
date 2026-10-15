---
name: Ranna
description: Kabyle painted pottery for a counter that rings customers' phones. Clay rail, slip ground, manganese ink, enamel state colours.
colors:
  red-ochre: "oklch(0.53 0.15 38)"
  red-ochre-ink: "oklch(1 0 0)"
  fired-clay: "oklch(0.38 0.105 30)"
  clay-slip: "oklch(0.965 0.012 70)"
  clay-muted: "oklch(0.84 0.04 45)"
  clay-line: "oklch(0.47 0.1 30)"
  clay-hover: "oklch(0.43 0.11 30)"
  cobalt-enamel: "oklch(0.47 0.13 262)"
  resin-amber: "oklch(0.74 0.13 72)"
  enamel-green: "oklch(0.5 0.11 162)"
  oxblood: "oklch(0.45 0.15 22)"
  kaolin-slip: "oklch(0.968 0.007 75)"
  slip-white: "oklch(0.992 0.003 75)"
  manganese-ink: "oklch(0.235 0.018 40)"
  worn-ink: "oklch(0.47 0.022 45)"
  slip-wash: "oklch(0.94 0.01 65)"
  slip-shade: "oklch(0.93 0.014 60)"
  slip-blush: "oklch(0.925 0.02 52)"
  hairline: "oklch(0.885 0.012 60)"
  control-line: "oklch(0.66 0.02 50)"
  band-empty: "oklch(0.82 0.015 55)"
  night-ground: "oklch(0.175 0.012 40)"
  night-card: "oklch(0.215 0.014 40)"
  night-ink: "oklch(0.94 0.01 75)"
  night-clay: "oklch(0.27 0.07 30)"
  night-ochre: "oklch(0.7 0.14 45)"
  night-enamel-green: "oklch(0.72 0.12 162)"
  shop-ground: "#fbfaf8"
  shop-card: "#ffffff"
  shop-ink: "#1f1a17"
  shop-muted: "#625a55"
  shop-line: "#e8e3de"
  merchant-default-brand: "#b14420"
  merchant-default-brand-2: "#1f4f8f"
typography:
  display:
    fontFamily: "Alexandria, Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 4.5vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Alexandria, Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Alexandria, Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  order-number:
    fontFamily: "Alexandria, Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(5rem, 28vw, 8.5rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\", \"lnum\""
  body:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-ar:
    fontFamily: "Cairo, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, Cairo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  sheet: "24px"
  pill: "9999px"
spacing:
  tight: "8px"
  card: "16px"
  card-loose: "24px"
  gutter-sm: "16px"
  gutter-md: "24px"
  gutter-lg: "40px"
  section: "80px"
  section-loose: "96px"
components:
  button-primary:
    backgroundColor: "{colors.red-ochre}"
    textColor: "{colors.red-ochre-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-board:
    backgroundColor: "{colors.red-ochre}"
    textColor: "{colors.red-ochre-ink}"
    rounded: "{rounded.md}"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.kaolin-slip}"
    textColor: "{colors.manganese-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.slip-blush}"
  start-button:
    backgroundColor: "{colors.red-ochre}"
    textColor: "{colors.red-ochre-ink}"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "56px"
  start-button-on-clay:
    backgroundColor: "{colors.clay-slip}"
    textColor: "{colors.fired-clay}"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "56px"
  input:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.manganese-ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  start-input:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.manganese-ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "56px"
  card:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.manganese-ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  order-card:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.manganese-ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  rail:
    backgroundColor: "{colors.fired-clay}"
    textColor: "{colors.clay-slip}"
    width: "260px"
  rail-nav-item:
    textColor: "{colors.clay-muted}"
    rounded: "{rounded.lg}"
    height: "44px"
  rail-nav-item-hover:
    backgroundColor: "{colors.clay-hover}"
    textColor: "{colors.clay-slip}"
  clay-plate:
    backgroundColor: "{colors.fired-clay}"
    textColor: "{colors.clay-slip}"
    padding: "24px"
  ready-takeover:
    backgroundColor: "{colors.enamel-green}"
    textColor: "{colors.red-ochre-ink}"
    typography: "{typography.order-number}"
  shop-chip:
    textColor: "{colors.shop-muted}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  ticket-dock:
    backgroundColor: "{colors.merchant-default-brand}"
    textColor: "{colors.shop-card}"
    rounded: "{rounded.xl}"
    padding: "0 20px"
    height: "60px"
---

# Design System: Ranna

## Overview

**Creative North Star: "Kabyle Painted Pottery"**

Ranna is painted the way Amazigh ware is painted: a kaolin-slip ground, manganese brown-black line work, and fired-clay red laid down as whole fields rather than accents. Red ochre is the colour of anything you can press. The glaze colours (cobalt, resin amber, enamel green, oxblood) are kept off the decoration entirely and only ever carry state, first and foremost the state of an order. The one ornament is the pot's shoulder band: a 45° lattice of lozenges between two rules. It appears only where it does a job: a divider, the ticket's perforated edge, the wait band that inks one lozenge per minute, the track of the landing page's sweep handle.

The system serves three surfaces with one grammar. The merchant console is a counter seen at arm's length: a clay rail on the start side, a slip work ground, and the order number as the only headline. The customer shop is the merchant's world: their colour, logo and chosen face on a quiet warm-white ground, with our structure (rhythm, lattice band, display numerals, enforced contrast) underneath. The marketing site is the counter before and after: whole clay and slip fields, never cards on a neutral page.

Density is generous and touch-first. Targets are 44px in navigation, 48px on the order board, 56px on the start form and 64px on the "I'm coming" acknowledgement. Arabic is the default and the layout is built from logical properties, so every surface mirrors in RTL without separate styling.

**Key Characteristics:**
- Fired-clay fields (rail, bands, closing plates) against a kaolin-slip ground; manganese ink for type and 1px rules.
- Red ochre only for action, focus, and lateness past the prep target.
- Four enamel and resin colours that only ever carry state, never decoration.
- Alexandria display numerals and titles; Inter for Latin text, Cairo for Arabic.
- A single 45° lozenge lattice as the only ornament; status dots and active markers are lozenges too.
- Flat surfaces, hairline borders, soft ink-tinted shadows only on lifted objects.
- Contrast is enforced in code: token pairs are unit-tested, and merchant colours are corrected before use.

## Colors

An earthenware palette: warm slip neutrals, one deep clay red for fields, one ochre for action, and glaze colours that only ever carry state. Values are authored in OKLCH in `src/app/globals.css`. Contrast pairs are asserted at 4.5:1 for text and 3:1 for control borders in `tests/unit/tokens.test.ts`.

### Primary
- **Red Ochre** (`red-ochre`): every primary button, the start form's submit, focus rings (`--ring`), the caret, text selection at 24%, and the lateness signal (the wait band's past-target lozenges and divider, and a late order's waited time). On dark it lifts to **Night Ochre** (`night-ochre`) with an ink label.
- **Fired Clay** (`fired-clay`): the field colour. It fills the console rail and its mobile top bar and sheet, the auth aside, the console's one reversed plate ("Open the order board"), the landing's "before" half and the closing plate. Text on clay is **Clay Slip** (`clay-slip`), with **Clay Muted** (`clay-muted`) for secondary text and inactive nav, **Clay Line** (`clay-line`) for rules and borders on clay, and **Clay Hover** (`clay-hover`) for hover fills. App icons are the brand mark in clay slip on a fired-clay plate.

### Secondary
- **Cobalt Enamel** (`cobalt-enamel`): state *new*. New-order lane, the live order count in the rail nav, the "received" dot on tickets.
- **Resin Amber** (`resin-amber`): state *preparing*. The only state colour that takes an ink label rather than white. Outside orders, tinted at 16–24% behind ink text, it marks caution: a past-due account, the account banner, contrast warnings in the shop editor.
- **Enamel Green** (`enamel-green`): state *ready*. The phone ticket that is ringing, the full-screen ring takeover, the call-out screen's ready half, the numbered order ticket once ready. In the console, as text, a lozenge or a 12–14% tint, it also marks a settled-good state: shop live, account active, payment paid, setup step done. On dark it becomes **Night Enamel Green** (`night-enamel-green`).
- **Oxblood** (`oxblood`): state *canceled* and destructive actions. On dark it lightens to oklch(0.66 0.16 25) with an ink label.
- *Done* uses **Worn Ink** (`worn-ink`): a finished order goes quiet, it does not celebrate.

### Neutral
- **Kaolin Slip** (`kaolin-slip`): the page ground of console and marketing.
- **Slip White** (`slip-white`): cards, popovers, inputs on the marketing form; the work surface sitting on the ground.
- **Manganese Ink** (`manganese-ink`): all body text, headings, 1px line work, the counter band's 3px top and bottom rules and its divider.
- **Worn Ink** (`worn-ink`): secondary text, descriptions, captions.
- **Slip Wash / Slip Shade / Slip Blush** (`slip-wash`, `slip-shade`, `slip-blush`): muted fills, secondary buttons, and hover fills respectively.
- **Hairline** (`hairline`): decorative borders and dividers. **Control Line** (`control-line`) is the boundary of anything you type into or toggle; it holds 3:1 against cards.
- **Band Empty** (`band-empty`): the unfilled lozenges of the wait band.
- **Night Ground / Night Card / Night Ink / Night Clay** (`night-ground`, `night-card`, `night-ink`, `night-clay`): the console's dark theme, "fired clay at night". Every light token has a dark counterpart in the `.dark` block; the hues stay at 30–45 so the night stays warm.

### Customer shop palette
The shop surface does not use the platform neutrals. It runs on **Shop Ground** (`shop-ground`), **Shop Card** (`shop-card`), **Shop Ink** (`shop-ink`), **Shop Muted** (`shop-muted`) and **Shop Line** (`shop-line`), and on four merchant-derived variables computed by `shopTheme()` in `src/lib/branding/theme.ts`: `--brand` and `--brand-2` (the merchant's colours), `--brand-contrast` and `--brand-2-contrast` (white or ink, whichever reads better on the fill), and `--brand-ink` / `--brand-2-ink` (the brand colour darkened until it reaches 4.5:1 on the shop ground). The defaults are `merchant-default-brand` and `merchant-default-brand-2`. Inside the shop, the wait band and lattice re-point to brand: `--band-ink` becomes `--brand-ink` and `--band-empty` becomes shop line.

### Named Rules
**The Glaze Means State Rule.** Cobalt, resin amber, enamel green, oxblood and worn ink name order states (new, preparing, ready, canceled, done). Beyond orders they may only carry the matching kind of state (green for settled-good, amber for caution, oxblood for destructive). They never decorate a section, a background, or a marketing illustration. On customer and order surfaces, full enamel-green fill means "ready" and nothing else.

**The Clay Field Rule.** Fired clay is laid down as a whole field (a rail, a band half, a plate edge to edge). It is never a small accent, a border colour on slip, or a text colour on the slip ground. A console screen gets at most one reversed clay plate: its single most urgent action.

**The Merchant Plate Rule.** On customer pages the merchant's brand fill appears in exactly two places: the header band and the single primary action (the docked ticket). Brand-coloured text always goes through `--brand-ink`, never raw `--brand`.

## Typography

**Display Font:** Alexandria (with Inter, then Cairo)
**Body Font:** Inter for Latin and Cairo for Arabic. On `lang="ar"` pages Cairo leads so digits and Latin fragments share its metrics.
**Merchant faces (customer shop only):** one of Cairo, Alexandria, Tajawal, Readex Pro, Changa, El Messiri, Baloo Bhaijaan 2, Reem Kufi. All carry Arabic and Latin, and only the chosen face downloads.

**Character:** Alexandria is a geometric Kufi-derived face, so numerals and titles feel painted on with a square nib. Inter and Cairo stay out of the way for working text. All faces are variable, self-hosted through `next/font`, and not preloaded.

### Hierarchy
- **Display** (700, clamp(2.1rem, 4.5vw, 4rem), line-height 1.05, max ~24ch): the landing headline only.
- **Headline** (700, 1.875rem on phones / 2.25rem from 640px, line-height 1.25): marketing section titles, kept to 16–20ch with balanced wrapping. The closing plate rises to 3rem.
- **Title** (700, 1.75rem / 1.875rem from 640px, tight leading): console page titles in the page header. Card and setup titles step down to 1.25rem at 600.
- **Order Number** (700, tabular and lining numerals, line-height 0.9, -0.02em): the headline of every order surface. 2.25rem on board cards, 3–4.5rem on the call-out screen, clamp(5rem, 28vw, 8.5rem) on the customer's ticket, clamp(7rem, 40vw, 12rem) on the ring takeover.
- **Body** (400, 1rem, 1.5): all working text. Lead paragraphs run 1.125rem with relaxed leading, capped at 56–60ch (80ch for the one-line hero body).
- **Label** (600, 0.875rem): form labels, status pills, waited times, nav counts (700, 0.75rem). Sentence case, no tracking.

### Named Rules
**The Number Is the Headline Rule.** On any order surface the order number, set as above, is the largest thing in its container and needs no badge or box to rank it. Orders, tickets and tables are addressed by number first.

**The Tabular Rule.** Anything that counts (board numbers, prices, totals, waited minutes, tables) is set in tabular figures, through `data-numeric`, `tabular-nums` or the order-number style, so columns line up at arm's length.

## Layout

The console is a two-column grid from 1024px: a 260px clay rail on the start side (sticky, full height) and a fluid work area. The work area has 16px gutters, 24px from 640px and 40px from 1024px, and 24/36px vertical padding, with content capped at 72rem. Below 1024px the rail becomes a 56px clay top bar and a 300px sheet (max 85vw) from the start side. Page headers sit 32px above content with actions wrapping to the end. The order board packs whole cards: a card is never truncated mid-content.

The marketing page uses a 72rem column with the same gutters; FAQ narrows to 48rem. Sections breathe at 80–96px vertical padding. The counter band breaks the column and runs edge to edge: 17rem tall on phones and clamp(24rem, 46vh, 26.5rem) from 640px, ruled top and bottom in 3px manganese. On phones its captions move out of the band into a two-column row beneath it, before at the reading start. Both halves are full fields, never cards on a neutral page.

The customer shop is a single 42rem column for one-handed phone use. The brand header band is at least 12rem with content bottom-aligned. A sticky 56px chip bar sits under it. Items run as rows (price and thumbnail at the line end) or a two-column grid, and the column ends with 9rem of padding so the docked ticket, which respects the safe-area inset, never covers the last item.

Everything is laid out with logical properties (`start`/`end`, `ps`/`pe`, `insetInlineStart`) so RTL mirrors without overrides. Directional icons flip with `rtl:rotate-180`.

## Elevation & Depth

Flat by default. Depth comes from tonal layering (slip-white cards on the kaolin ground, clay fields against slip) and from 1px hairline borders. Shadows are soft, low, and tinted with manganese ink rather than grey, always with a negative spread so they read as an object resting on a surface rather than a floating panel. Nothing in the system casts a hard offset shadow.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px rgb(31 26 23 / 0.06)`): order cards on the board; barely there, just separates card from ground.
- **Lifted object** (`box-shadow: 0 10px 30px -18px rgb(31 26 23 / 0.35)`): the customer's order ticket and marketing interface fragments.
- **Held object** (`box-shadow: 0 14px 30px -20px rgb(31 26 23 / 0.5)`): phone tickets in the counter band.
- **Docked plate** (`box-shadow: 0 14px 30px -14px rgb(0 0 0 / 0.55)`): the customer's docked ticket, floating over the menu.
- **Ready halo** (`box-shadow: 0 0 0 14px` expanding from enamel green at 45% to 0%, 2.4s): the only coloured glow, on whatever is ringing.

### Named Rules
**The Halo Not Flicker Rule.** "Ready" is shown with an outward halo or a two-step background alternation between enamel green and a deeper mix of it, never by fading the number. The number stays fully legible at every frame, and under reduced motion every animation collapses to a single still state.

## Shapes

Corners are generous and consistent, derived from a 12px base: 8px for small controls, 10px for buttons and inputs, 12px for nav items and panels, 16px for cards, the start form and the docked ticket, and 24px for bottom sheets and the order ticket. Chips, status pills and avatars are full pills. Fields of clay (rail, band halves, plates) are square-edged: they are ground, not objects.

The geometric signature is the 45° lozenge. The brand mark is three nested lozenges. The rail's active marker, every status dot, the setup checklist marks and the sweep handle are lozenges (squares rotated 45° with 1px corners). The **band rule** is a 9px divider of small lozenges between two 1px rules. The **lattice** is a 24px band of filled lozenges with sawtooth triangles hanging from 2px rules. Both are masks painted in `currentColor`, so they take the ink of whatever surface they sit on.

### Named Rules
**The 45° Lattice Rule.** Ornament is drawn only on the 45°/90° lattice: lozenges, rules, sawtooth. There are no curves, flourishes or illustrations in the ornament system, and the lattice only appears where it does a job (divide, perforate, measure, or carry a handle).

## Components

### Buttons
Confident, ochre, and large where hands are busy.
- **Shape:** gently rounded (10px). The start form and the ring acknowledgement use 16px.
- **Primary:** red ochre fill, white label at 500–600, 36px default height with 16px horizontal padding. The order board's "next step" button is 48px with a 1rem label and takes the full card width beside a 48px overflow menu.
- **Hover / Focus:** hover drops the fill to 90%. Focus is a 3px ring of ochre at 50% (shadcn primitives) or a 2px solid ochre outline at 2px offset (base). Press scales to 0.98–0.99 on large touch buttons.
- **Outline / Ghost:** slip ground with a hairline border, or no fill, turning to slip blush on hover.
- **On clay:** the start form's clay variant inverts: a clay-slip button with a fired-clay label, going to pure white on hover.

### Chips
- **Style (customer shop):** pill, 6px by 14px, 0.875rem at 600, transparent border. Inactive text is shop muted and turns shop ink on hover.
- **State:** the active category takes a `--brand-ink` border and text. Never a brand fill: fill is reserved for the header and the ticket.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** slip white on kaolin slip (console, marketing); shop card on shop ground (customer).
- **Shadow Strategy:** resting card or none (see Elevation & Depth).
- **Border:** 1px hairline.
- **Internal Padding:** 16px on order cards with 12px gaps; 24px on general cards. Metric-card rows are not part of the system: the dashboard shows lanes with display-scale counts.

### Inputs / Fields
- **Style:** 1px control-line border, transparent or slip-white fill, 10px radius, 36px tall in the console. The marketing start field is 56px with a 16px radius and 1rem text. Customer fields are 48px on shop card with a shop-line border.
- **Focus:** border shifts to ochre (or `--brand-ink` in the shop) plus a soft ring at 20–30%.
- **Error / Disabled:** oxblood border and ring on `aria-invalid`; disabled drops to 50% opacity.

### Navigation
- **Console rail:** 44px items with 12px radius, 15px text. Inactive items are clay muted, and hover fills clay hover with clay-slip text. The active item gets a 13% clay-slip wash, 600 weight, and a lozenge marker at the inline start. Live counts sit at the end as cobalt pills. A band rule separates identity from navigation.
- **Marketing header:** wordmark (ochre mark, Arabic name leading) and 0.875rem/600 worn-ink links that darken to ink on hover. Links collapse below 768px.
- **Mobile:** the rail's content moves into a clay sheet behind a 56px clay top bar with a 44px trigger.

### The Wait Band (signature)
A 14px band ruled top and bottom at 45% ink, holding 8–16 six-pixel lozenges. One lozenge is inked per minute an order has waited. A 1.5px ochre tick marks the prep target, and lozenges past it, or every inked lozenge once late, turn ochre. It fills from the reading start, so it runs right to left in Arabic. It sits under every open order card and is labelled for screen readers.

### The Ticket (customer signature)
Docked at the bottom of the shop: a 60px brand-fill plate with a 16px radius and a band-rule perforation along its top edge. It shows the item count pill, "Review order", and the tabular total. It opens into a 24px-radius bottom sheet headed by a band rule in brand ink. Once the order is placed it becomes the numbered order ticket: slip card, band-rule edge, the order number at display scale, a three-step progress line in brand ink. When ready it turns enamel green with the halo.

### The Ring Takeover
Full screen in enamel green, alternating with a deeper mix of itself every 0.6s (motion-safe only). A band rule leads into the title, then the order number at up to 12rem, then a 64px white "I'm coming" button with a 16px radius. Focus moves to the button on open.

### The Counter Band (marketing signature)
A full-bleed before/after scene. The "before" half is fired clay with jostling clay-slip numbers (restless 3.2s jitter, motion-safe) and struck-through pagers. The "after" half is slip mixed with clay muted, holding five phone tickets in a calm row, one ringing in enamel green. A 3px manganese divider carries a 48px lozenge handle, and a lattice band runs along the bottom of both halves. The control is a real range input (arrow keys work), clipped and mirrored for RTL. On load the split eases in from 88% to 50% over 1.4s.

## Do's and Don'ts

### Do:
- **Do** take every colour from a token: platform variables in `globals.css`, shop variables from `shopTheme()` and `ShopRoot`. Add a contrast assertion to `tests/unit/tokens.test.ts` for any new text/ground pair.
- **Do** set order numbers with the order-number style (Alexandria 700, tabular lining figures, line-height 0.9) and make them the largest element on order surfaces.
- **Do** use the band rule or lattice, painted in `currentColor`, when a surface needs a divider, a perforated edge or a progress measure.
- **Do** draw status dots and markers as 45° lozenges (6–12px, 1px corner radius), not circles.
- **Do** keep touch targets at 44px minimum, 48px on the order board and 56px or more for the page's primary action on phones.
- **Do** build with logical properties so every surface mirrors in Arabic, and flip directional icons in RTL.
- **Do** regenerate `public/icons` with `npm run icons` (`scripts/icons.ts`) after changing the brand mark or the clay colour. The icons are generated from the mark, not drawn.

### Don't:
- **Don't** use cobalt, resin amber, enamel green or oxblood as decoration or section colour. They carry state only, and a full enamel-green fill always means an order is ready.
- **Don't** put fired clay in small doses (borders, text, icons on slip). It is a field or nothing.
- **Don't** fill anything with the merchant's brand colour on customer pages except the header band and the primary action, and don't set brand-coloured text without `--brand-ink`.
- **Don't** add curved or illustrative ornament, or use the lattice purely as decoration.
- **Don't** use hard offset or grey drop shadows. Shadows are soft, negatively spread and ink-tinted, and only on lifted objects.
- **Don't** signal "ready" by fading or strobing the number's opacity. Use the halo or the green alternation, and respect reduced motion.
- **Don't** add uppercase tracked labels above headings. Labels are sentence case at 0.875rem/600.
