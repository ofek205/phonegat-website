---
name: muzli-editorial-design
description: Design system for PHONE GAT content pages, derived from measured muz.li tokens, serif display headings against a light sans body, zero corner radius, hairline rules instead of cards, and no tinted panels. Use when building or restyling any content/guide/article page in this project, when the user says a design "looks generic", "looks like AI", "נראה קלוד", "גנרי", when asked to follow the muz.li reference, or before adding any card, badge, pill, chip or coloured callout to a page. Covers the type scale with Hebrew font substitutions, RTL specifics, component recipes (header, hero, index, numbered steps, labelled variants, notes, CTA), an anti-pattern checklist, and a measurable browser acceptance test. Do NOT use for the home page (index.html), which keeps its own heavy-sans landing-page identity.
license: MIT
compatibility: Plain HTML + inline CSS, no build step, no dependencies. Google Fonts only. RTL/Hebrew.
---

# Muzli-derived editorial design

## What this is

A design language for PHONE GAT's **content pages** (guides, articles, explainers), measured from
[muz.li](https://muz.li) on 29 July 2026. It exists because the default output of an AI assistant —
rounded cards, pill tags, tinted callout boxes, uniform radius, heavy sans headings, is now a
recognisable style that reads as generic. The reference solves the same problem with typography and
white space instead.

**Take the system, never the site.** Tokens, scale and structural patterns are fair game. Muzli's
logo, wordmark, copy, imagery and brand blue are not, substitute the project's own.

## The five rules

1. **Headings are serif at a normal weight.** Never a heavy sans headline. The serif/sans contrast
   is the single strongest signal that a human set this page.
2. **Body copy carries the light weights.** Standfirsts and ledes at 300; never bold a whole paragraph.
3. **`border-radius: 0` on everything structural.** In the reference, 175 of ~200 measured elements
   are square. The only rounded things are call-to-action buttons.
   **Buttons are the one place this system yields to the site.** The reference uses full pills, and
   `phone-problems.html` shipped that way at first — then the owner compared the two pages and the
   same WhatsApp button changing shape and weight between them read as two different sites. Buttons
   now match `index.html` exactly: `border-radius:4px`, `font-weight:700`, `padding:9px 20px`,
   `gap:.4rem`. Do not "restore" the pill — it was tried and rejected on 31 Jul 2026.
4. **No filled surfaces.** No tinted panels, no card backgrounds, no coloured chips. The page is
   white; a single dark band at the end is the maximum contrast move.
5. **Separate with hairlines and space.** A 1px rule and 2rem of air replace every box you were
   about to draw.

## Measured tokens and their Hebrew substitutes

| Role | muz.li | Use here | Notes |
|---|---|---|---|
| Display face | Instrument Serif 400 | **Frank Ruhl Libre 400/500** | The Hebrew editorial serif. `--serif:"Frank Ruhl Libre","David Libre",Georgia,serif` |
| Text face | Poppins 200–600 | **Assistant 300–800** | Already cached site-wide; add weight 300 to the Google Fonts URL |
| H1 | 84.8px / lh 1.375 / weight 400 | `clamp(2.6rem,7vw,5.3rem)` / lh 1.14 / weight 400 | |
| Section heading | n/a | `clamp(1.5rem,3vw,2.15rem)` / weight 500 serif | |
| Lede / standfirst | 20px weight 200 | `clamp(1.1rem,1.5vw,1.3rem)` weight **300** | Hebrew at 200 gets too fragile; 300 is the floor |
| Body | 16px | 18px | Hebrew needs the extra size |
| Small label | 14px | `.86rem` weight 700, `letter-spacing:.07em` | Hebrew has no caps, letter-spacing does that job |
| Page width | 1280px | `--maxw:1400px` (site) with a 900–1000px reading column | |
| Header height | 65px | 64–68px | |
| CTA button | radius 9999px, padding 12px 48px, 18px | **radius 4px, weight 700, padding 9px 20px** in `--teal` | Matches index.html, not the reference — see rule 3 |
| Accent | `#2E54FF` | `--teal:#1878A8` | One accent. The other three brand colours are section marks only |
| Hero top space | 160px | `clamp(64px,11vw,150px)` | Generosity here is most of the effect |

## Component recipes

**Header**: white, hairline bottom, no shadow. Logo at the start, nav links in sans 500 at `.95rem`,
one teal CTA at the end, same shape as the site's buttons. Sticky. On a white header the logo needs no white box behind it.

**Hero**: white, centred, `max-width:min(1100px,92vw)`. Serif H1, then a 300-weight lede at ~54ch,
then byline and trust line as one hairline-separated row of plain text. No badge, no gradient bar,
no dark background.

**Index / contents**: a numbered two-column list. `counter(x,decimal-leading-zero)` set in the serif
at `.95rem` in the accent, `border-top:1px solid var(--line)` on each row. Not pills.

**Numbered steps**: hanging serif numeral in the accent, hairline between steps, no bullets and no
circles. `counter-increment` + `::before`, so the numbers never enter the text layer (screen readers
and Google read the sentence, not "1The device...").

**Section number**: `decimal-leading-zero` serif numeral on its own line *above* the heading, in the
section's accent colour. Never a coloured square beside the heading.

**Labelled variants** (per-device instructions, specs, comparisons), a two-column grid: `8rem` label
column in sans 700, text column beside it, `border-top` hairline per row. Collapses to stacked label
+ text under 640px. Not cards.

**Note / warning**: `border-inline-start: 3px solid` + `padding-inline-start: 1.1rem`, no background,
no border on the other three sides, no radius. The lead-in words carry the colour, not a panel.

**Closing CTA**: the one dark band on the page (`--dark`), serif heading at weight 400, light body,
buttons in the site's shape (4px, weight 700).

## Anti-patterns, stop if you are about to write any of these

- `border-radius` on anything that is not a CTA button
- `background:#eef6f9` / `#fdf3f2` / any tint behind a block of text
- `box-shadow` on a content element
- a `<span>` styled as a pill for a tag, category, device name or filter
- `font-weight:800` on a heading (that's the sans-headline reflex)
- alternating grey/white section backgrounds to create rhythm, use rules and space
- emoji as section icons
- four equal cards in a grid

## Acceptance test

Run in the browser pane against the finished page. It should read like the reference profile:

```js
(() => { const radii={}, fills={};
  [...document.querySelectorAll('main *')].forEach(e=>{const c=getComputedStyle(e);
    radii[c.borderRadius]=(radii[c.borderRadius]||0)+1;
    const b=c.backgroundColor; if(b!=='rgba(0, 0, 0, 0)') fills[b]=(fills[b]||0)+1;});
  return {radii:Object.entries(radii).sort((a,b)=>b[1]-a[1]).slice(0,4),
          fills:Object.entries(fills).sort((a,b)=>b[1]-a[1]),
          h1:getComputedStyle(document.querySelector('h1')).fontFamily}; })()
```

Pass conditions: `0px` is the dominant radius by a wide margin; the only other radii belong to
buttons (`4px`) and icons; `fills` contains nothing but button colours, the dark CTA band, and
white; `h1` resolves to the serif. A `9999px` radius anywhere means the pill crept back in — see
rule 3 before "fixing" it.

## RTL and Hebrew specifics

- Always logical properties: `border-inline-start`, `padding-inline`, `margin-inline`, never `left`/`right`.
- Alternating image/text rows flip with `order` on the figure, and must reset to `order:0` under 900px
  so the image always sits above the text on a phone.
- `letter-spacing` substitutes for the uppercase labels the reference uses; Hebrew has no case.
- Latin strings (`WhatsApp`, `iPhone`, phone numbers) go in `<bdo dir="ltr">` or `.ltr`.
- Frank Ruhl Libre has real Hebrew coverage; most Latin editorial serifs do not. Verify before swapping.

## Project constraints this must respect

- Everything inline in one `.html` file. No `package.json`, no dependencies (see `CLAUDE.md`).
- The header, footer, WhatsApp rail and mobile bar are shared with the site, restyle them for the
  page, keep their markup and links identical so navigation stays consistent.
- `index.html` is **out of scope**. It is a landing page with its own identity; this system is for
  content pages only.
