---
name: pg-new-content-page
description: Build-and-ship checklist for a new PHONE GAT content page (guide, article, explainer, landing page). Use when creating any new .html page in prototype/, when a page is "almost done" and about to be pushed, or when auditing an existing page for the standard. Covers the shared chrome every page must carry (environment guard, GTM gating, accessibility menu, cookie banner, service worker, schema), Hebrew typography sizing, 44px touch targets and the standard's exemptions, portrait images with a mobile crop plus WebP/srcset, the legal claims that create real exposure, analytics that GTM cannot infer on its own, and how to verify each item given this environment's limits. Every rule here exists because it was actually missed once. Do NOT use for visual/typographic design decisions — that is muzli-editorial-design; this is the compliance-and-shipping layer that sits under it.
license: MIT
compatibility: Plain HTML + inline CSS/JS, no build step, no dependencies. Hebrew RTL. Vercel, root = prototype/.
---

# New content page — the standard

`phone-problems.html` was built from scratch, shipped, and then found to be missing **fourteen**
things — none of them visible on screen. Every rule below is one of them. The page looked finished
long before it was.

**Read this before writing the page, not after.** Half of these are cheap up front and expensive
to retrofit.

## The two commands

```bash
# 1. scaffold — copies the chrome from the newest content page, so it cannot drift
node .claude/skills/pg-new-content-page/scripts/new-page.js \
  --slug screen-repair --title "…  | פון גת" --desc "…" --h1 "…"

# 2. after the photos land in prototype/<slug>/  (3:4 portrait)
node .claude/skills/pg-new-content-page/scripts/prep-images.js screen-repair
```

The scaffold arrives with the guard, the GTM gating, the accessibility menu, the cookie banner, the
service worker, the canonical, the `#business` entity, the skip link, the site's buttons and the full
footer already in place, plus `sitemap.xml` and the `sw.js` shell updated. You write `<main>`.

## What is enforced, and what is not

`node .claude/preflight.js` runs **19 checks** and exits 1 on failure. `.githooks/pre-push` blocks a
push to `main` unless it passes *and* the exact commit is already on `origin/staging`. The list of
content pages is read from the directory, so **a new page is covered the moment it exists** — nothing
to register.

Enforced automatically: `PG_PROD` guard · GTM gating · accessibility menu present · cookie banner
present · service worker registered · canonical → production · `#business` defined not just
referenced · one `<h1>` · `alt` on every image · `lang="he" dir="rtl"` · landmarks · skip link using
a logical inset · `<main tabindex="-1">` · nav matches `index.html` · footer complete · buttons in the
site's shape · mobile-bar clearance · no sweeping warranty claim · no reference to an unpublished
תקנון · no Hebrew "וואטסאפ" · accessibility-audit date not older than the newest page · JSON-LD parses
· FAQ count matches its schema · coupon offers in sync client↔server.

**Not enforced — these still need a person:** colour contrast, 44px touch targets, the reading
experience on a real phone, whether the copy is any good, and the crawler word count. §4, §9 say how
to measure each.

*Proof the checks bite: breaking five things in a scratch copy — removing the accessibility menu,
restoring the sweeping warranty claim, switching the skip link to physical `left`, dropping one `alt`,
removing the consent banner — produced exactly five failures, each naming what breaks for whom.*

---

## 0. The rule that matters most

**There is no build step. Every page carries its own copy of the shared chrome.** No framework,
no partials, no import. If you create a page by writing fresh HTML, you get *none* of it, and
nothing will look broken — the page will render beautifully while silently poisoning analytics and
failing the accessibility regulations.

**So: start from an existing content page, do not start from a blank file.** Copy
`phone-problems.html`, gut the `<main>`, keep everything else. That single decision prevents most
of what follows.

---

## 1. Shared chrome — the fourteen things

`node .claude/preflight.js` catches the ones marked ✅. The rest are on you.

| # | What | Why it matters | Caught by |
|---|---|---|---|
| 1 | `window.PG_ENV` / `PG_PROD` guard, first thing in `<head>` | Without it a staging visit is counted as a real customer in GA4. Unrecoverable data | ✅ 4, 8 |
| 2 | GTM wrapped in `if(window.PG_PROD\|\|location.search.indexOf('pg_gtm=1')>-1)` | Same | ✅ 8 |
| 3 | Accessibility menu: `#a11yTrigger` + `#a11yPanel` + the JS + **all ten** `html.a11y-*` effect rules | Regulatory. And a widget that shows a control which does nothing is worse than no widget | ✅ 10 |
| 4 | Cookie banner `#cookieOk` / `#cookieNo` | A landing page without it leaves every organic visitor at `analytics_storage: denied` with no way to consent — the traffic the page exists to attract is invisible | ✅ 10 |
| 5 | `navigator.serviceWorker.register('sw.js')` | A search landing page is often the only page a visitor opens; without this they never get the PWA | ✅ 10 |
| 6 | `<link rel="canonical">` to the real domain | | ✅ 8 |
| 7 | The `#business` entity **defined**, not only referenced by `@id` | A bare `@id` pointing at another page does not reliably resolve | ✅ 9 |
| 8 | Page added to `sitemap.xml` and to the `SHELL` list in `sw.js` | | — |
| 9 | Nav links **identical** to `index.html`, plus `aria-current="page"` on the self-link | | — |
| 10 | Footer identical: social links, PWA button, trademark disclaimer | | — |
| 11 | Skip link, first in tab order, using `inset-inline-start` (never `left`) | Physical `left` breaks in RTL | — |
| 12 | `<main id="main" tabindex="-1">` as the skip target | | — |
| 13 | Buttons in the site's shape, not the reference's pill (see §3) | | — |
| 14 | `track()` for on-page behaviour (see §6) | | — |

**When you add a new `html.a11y-*` effect rule, add it to every content page.** The prefs are
shared through one `localStorage` key, so a value set on one page and ignored on another is a
control that silently lies.

---

## 2. Hebrew typography — the trap that got us twice

**`rem` resolves against `<html>` at 16px, not against `body` at 18px.**

So `1rem` is **smaller** than the body text. Every "small" size taken from an English reference
lands 10–30 % too small in Hebrew:

| Element | Was | Is | Why |
|---|---|---|---|
| Section numerals | `.82rem` = 13.1px | `1.02rem` | 13px against an 18px body reads as a mistake |
| Small labels (`h3`, TOC, picker) | `.86–.92rem` | `.98–1.02rem` | |
| Footer phone numbers | 18px | **`1.3rem`** = 20.8px | Anything under ~1.15rem is smaller than the text beside it |

The design system already says *"Body: 16px → 18px, Hebrew needs the extra size."* **Apply the same
uplift to the small type.** It was written for the body and then not carried through.

Numerals gain from size twice over: a larger figure reads *more* editorial, not less.

---

## 3. Buttons — the site wins over the reference

`muzli-editorial-design` calls for a full pill. **Do not use it.** The owner compared two pages and
the same WhatsApp button changing shape between them read as two different sites.

```css
.btn{border-radius:4px;font-weight:700;padding:9px 20px;gap:.4rem;line-height:1.65}
```

Copy the rule from `index.html` verbatim. Also match, exactly:

- **Header CTA** is `btn btn-wa btn-sm` — WhatsApp **green**, with the icon, labelled `WhatsApp`.
  Not a teal button, not "דברו איתנו".
- **Hero CTA** is green with the icon and the green glow, sized like the home page hero.
- A button whose text says WhatsApp **must** be WhatsApp green. Teal reads as a different action.

**The editorial serif belongs to `main` only.** The header and footer are shared furniture — their
headings stay in `--font`, or the same footer renders in a different typeface depending on which
page you are standing on:

```css
header.site h1,header.site h2,header.site h3,
footer.site h1,footer.site h2,footer.site h3{font-family:var(--font);font-weight:800}
header.site h4,footer.site h4{font-family:var(--font);font-weight:700}  /* h4 is outside index's h1–h3 rule */
```

---

## 4. Touch targets — 44px, and the two real exemptions

Measure at **375px**, not by eye. Every control that is not inline prose gets 44px.

Ones that are easy to miss, because they hide inside widgets you copied and never opened:

- the accessibility menu's own **close button** (was 29px — a panel for people who need bigger
  targets cannot offer a 29px control)
- its **reset** button and footer link
- the cookie bar's two consent buttons — `.cookie .btn-sm` **outranks** any generic `.btn-sm`
  padding, so it needs saying again
- the chat's close, chips and send
- the carousel's pause button (the dots got a hit area; the pause button did not)

**`min-height` alone is not enough.** Borders and the line box eat into it — 44 declared came out
43. Let the `padding` carry the target.

**Growing a target must not grow the visual.** For a 9px dot: `box-sizing:content-box` +
`background-clip:content-box` + `padding`. The dot stays 9px, the target becomes 45px.

**Genuinely exempt** (do not "fix" these):
- links **inline inside a running sentence** — raising them breaks the paragraph's line spacing,
  and WCAG 2.5.8 exempts them
- the staging-only test banner

**Content must clear the mobile bar.** The bar measures **70px**; `padding-block-end` must be ≥ that.
It was 60px, so the last 10px of every page sat underneath it.

---

## 5. Images — portrait, cropped on mobile, WebP

**Aspect ratio: 3:4 portrait, 1200×1600.** Measured: the text column runs ~1440px tall on desktop,
so a 4:3 photo left **over 1000px of white** beside it. Portrait cuts that to ~684px. (An earlier
`position:sticky` on the figure existed only to hide that gap — a photo that follows you down the
column reads as a bug, and it detaches the image from the step it illustrates. Do not bring it back.)

**Same file, cropped to a band on mobile:**

```css
.fig img{aspect-ratio:3/4;object-fit:cover}                      /* desktop */
@media(max-width:900px){ .fig img{aspect-ratio:4/3} }             /* ~263px instead of ~468px */
```

A portrait photo on a phone runs ~468px tall and pushes the instructions below the fold — on a page
people open *because something is broken*, that is the wrong trade. The crop saves ~205px per
section.

**So the subject must survive a centre crop.** Brief the photographer or the image model: *the
device sits in the middle third of the height; top and bottom thirds are background only.*

**Serve WebP and two widths.** `ffmpeg` is available on this machine and has `libwebp`:

```bash
ffmpeg -i X.jpg -vf scale=700:-2 -q:v 4 X-700.jpg
ffmpeg -i X.jpg      -c:v libwebp -quality 80 X.webp
ffmpeg -i X-700.jpg  -c:v libwebp -quality 80 X-700.webp
```

```html
<picture>
  <source type="image/webp" sizes="(max-width:900px) 92vw, 53vw"
          srcset="problems/X-700.webp 700w, problems/X.webp 1086w">
  <source type="image/jpeg" sizes="(max-width:900px) 92vw, 53vw"
          srcset="problems/X-700.jpg 700w, problems/X.jpg 1086w">
  <img src="problems/X.jpg" alt="…" width="1086" height="1448" loading="lazy" decoding="async">
</picture>
```

Measured effect: **1284 KB → 364 KB on mobile, 72 % smaller.**

`sizes` desktop value is **53vw, not 42vw** — the layout alternates 492px and 666px columns and
53vw matches the wider one. Under-declaring starves high-DPI screens.

`loading="lazy"` is **correct** for these: the first figure sits ~1756px down, well below the fold.
Do not "optimise" it to eager — but do re-measure if the layout above it ever shrinks.

**Files supplied by hand are usually wrong.** Check before trusting: images arrived as PNG carrying
`.jpg` names (one was `.jpg.png`), 14.13 MB for seven. Verify the magic bytes, not the extension.
Re-encode to real JPEG at quality 82 and back up the originals.

**Keep the `.fig .ph` placeholder CSS even when unused.** It is the scaffold for staging a section
before its photo exists, with the shot described in the caption and the `alt` already written — so
dropping the real image in later is mechanical.

---

## 6. Analytics — measure only what GTM cannot infer

Two corrections that cost a wrong audit finding, twice:

1. **`track()` in `index.html` is the chatbot's helper.** All 17 calls are `chat_*`. CTA tracking
   lives in a **GTM Custom HTML tag** that is not in the repo. A count of `track()` says nothing
   about whether the page is measured.
2. **Give every outbound CTA its own `?text=` prefill.** A generic GTM click trigger then segments
   them by intent through the Click URL — with no page code at all. Seven symptom CTAs with seven
   different prefills are already fully attributable.

So add code **only** for on-page behaviour, which no trigger can see:

```js
function pgTrack(ev,d){try{window.dataLayer=window.dataLayer||[];var o={event:ev};
  if(d)for(var k in d)o[k]=d[k];window.dataLayer.push(o);}catch(e){}}
```

- **A choice the reader makes** (`guide_device`) — fire on the **click only**. Restoring a saved
  choice on load must stay silent, or every return visit looks like a fresh decision.
- **What was actually read** (`guide_section_read`) — once per section, and only after it has held
  the middle of the screen for **two seconds**. Scrolling past on the way somewhere else is not
  reading; counting it makes every section look equally popular.

`dataLayer` pushes are safe everywhere — the `PG_PROD` guard keeps GA4 itself off outside
production, so event wiring stays testable. **New events need a matching GA4 tag created in GTM**,
or they reach `dataLayer` and stop there.

---

## 7. Legal — the four that create real exposure

Statutory damages are up to **50,000 ₪ without proof of harm**, so these are not hygiene.
*(There is a 60-day cure period: a claim needs a prior fix notice. Route accessibility complaints
to the coordinator and act inside that window.)*

1. **Never promise something the page later contradicts.** The hero claimed *"אחריות על כל תיקון"*
   while §4 said liquid damage carries none, in any lab. A headline that promises and a section
   that denies is the textbook misleading-advertising shape. Use *"אחריות בכתב על תיקונים"*.
2. **Update both dates in `accessibility.html` when a page ships.** The statement's scope is the
   whole site; an audit date that predates the newest page claims coverage it does not have, and
   it is the easiest thing for a claimant to point at.
3. **Never write "בכפוף לתקנון" unless the תקנון is published and linked.** Conditioning an
   advertised offer on unpublished terms is exactly what consumer-protection law is for. State the
   real condition instead — *"לשימוש חד פעמי"*.
4. **Name every new processor in `privacy.html`,** with what is sent. When the coupon counter was
   added, Upstash had to be named *and* the fact that only the IP is sent.

Two things code cannot supply: a **certified מורשה נגישות השירות opinion** (the statement is
otherwise self-declared), and the fact that revenue-based exemptions almost certainly do not apply.

---

## 8. SEO — one rule, and it is easy to break

**Everything must be in the HTML with JavaScript switched off.**

The device filter hides blocks by setting `data-pgdev` on `<html>` — and only after a user clicks.
A crawler has no JS and no `localStorage`, so it sees **all** variants. Verify it:

```bash
curl -sS https://www.phonegat.co.il/PAGE.html | node -e "…strip scripts/styles/tags, count words…"
```

The guide returns **2,942 readable words** and all 27 device blocks. If a filter ever defaults to
hidden and reveals with JS, that number collapses and the page loses most of its content.

Also: one `h1`; no heading-level skips; `alt` on every content image and `alt=""` on decoration;
`TechArticle` + `BreadcrumbList` + the defined `#business`. `FAQPage` is fine to add for machine
readability, but **do not promise rich results from it** — Google restricted FAQ rich results to
government and health sites, and removed HowTo entirely.

---

## 9. Verification — and what this environment cannot tell you

Run in order. The first two are cheap and catch most regressions.

```bash
node .claude/preflight.js          # 19 checks; exits 1 on failure
node .claude/ship.js stage         # deploys to staging; prod is gated on this exact commit
```

Then measure in the browser pane — **measure, do not look**:

- horizontal overflow: `documentElement.scrollWidth <= clientWidth` at 375px
- touch targets: every `a,button,summary` with `display !== 'inline'` at ≥44px
- contrast: compute the ratio yourself and walk up for the first background whose alpha > 0.5.
  Beware: a naive `!/, 0\)$/` test rejects `rgb(0, 0, 0)` and turns a black footer into white,
  producing a page full of phantom failures.
- the design profile from `muzli-editorial-design`'s acceptance test

**Three things this environment genuinely cannot do. Do not read them as bugs, and do not claim a
page is verified on their strength:**

| Limit | Symptom | What to do |
|---|---|---|
| The pane reports `visibilityState: "hidden"` | **IntersectionObserver delivers no callbacks at all.** Scroll-driven counters freeze; dwell tracking never fires | Verify the wiring by firing the handler directly; verify thresholds on a real device |
| Screenshots time out | *"the page is not compositing frames"* | Headless Edge with a **fresh `--user-data-dir`** renders desktop reliably; it is **not** trustworthy for mobile widths on this page |
| Aggressive caching, including the service worker you just added | Edits appear to have no effect | `navigate` with `force:true`, or unregister the SW and clear `caches` |

**Say so when you could not verify something.** A measurement is not a substitute for one look at a
real phone.

---

## 10. Shipping alongside another session

The folder is often shared with a second chat editing `index.html` at the same time.

- `git fetch` **immediately** before any `push -f`. A force-push to `staging` once discarded a
  commit that had landed four minutes earlier; it was recoverable only because the object was still
  in the local store.
- Commit **your files only**. Never `git add -A` — the other session's half-finished work will ride
  along.
- `ship.js` refuses to run on a dirty tree. When the dirt is theirs and your commit is complete,
  `git push -f origin HEAD:staging` is the correct bypass, and worth stating out loud.
- Their in-progress work stays untracked on disk and is not yours to commit or delete.
