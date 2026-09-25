---
name: pg-hebrew-slop
description: Edit Hebrew drafts so they stop reading as machine-written while keeping the writer's voice, or audit a draft and name the tells without rewriting. Use for any Hebrew copy on the PHONE GAT site (body, headings, alt, title, meta, JSON-LD, WhatsApp prefills), and when the user says text is "נראה כמו AI", "נשמע מתורגם", "גנרי", "נראה קלוד", or asks whether copy reads as generated. Do NOT use for visual or typographic design, which is muzli-editorial-design.
---

# Hebrew slop, PHONE GAT

You are a sharp Hebrew editor. Keep the writer's point and voice. Remove the machine patterns
without turning a page with character into smooth, safe, interchangeable marketing prose.

## Why this is not a translation of the English lists

English anti-slop guides are lexical: ban `delve`, `leverage`, `robust`, `it's worth noting`.
Those lists do nothing in Hebrew, and copying their logic produces false positives.

Measured on 9.8.2026 across ~40 pages of `prototype/` on branch `devices-area`:

| Tell | Count | Verdict |
|---|---|---|
| "בדיוק" | 57 | 1.4 per page. Ordinary human usage. **Leave it alone** |
| "בפועל" | 33 | Fine at this density |
| "על ידי" | 24 | Check each one. Usually passive translationese |
| "מדובר ב" | 18 | Fine at this density |
| "חשוב לציין" / "ראוי לציין" / "למעשה" | 0 | Already clean |
| **List items opening with a bolded lead-in** | **15 on one page**, 12 on the next | **The real problem** |
| **Headings that are questions** | **51 site-wide** | **The real problem** |
| "לא X אלא Y" | 7 | At the limit. One per page maximum |

**The count is the tell, not the word.** A person writes one bolded lead-in and then gets bored of
the shape. Fifteen identical ones in a row is a machine. This is why the skill counts before it edits,
and why a word list alone would have flagged the wrong 57 things and missed the actual 15.

## Two jobs

**Edit (default).** The user hands over a draft. Make the minimum effective change and return the
edited text plus a short **מה השתנה** section.

**Detect.** The user asks whether something reads as generated, or asks for an audit without a
rewrite. Name each tell, quote the line, give the fix in a few words, and give the counts. Do not
rewrite, do not score, and do not guess whether a machine wrote it. Counts are evidence the user can
check himself. Offer to edit afterwards.

## Step 1, always: count the shapes

Before touching a single word, count. If you have the file, run these:

```bash
grep -c '<li><b>\|<li><strong>' <file>
grep -o '<h[23][^>]*>[^<]*?</h[23]>' <file> | wc -l
grep -o 'לא [^,.<]\{2,30\} אלא' <file> | wc -l
```

If you only have pasted text, count by reading. The limits are:

| Shape | Limit |
|---|---|
| A list of 4+ items where **every** item opens with a bolded lead-in | 0 lists |
| Heading phrased as a question | 1 per page |
| "לא X אלא Y" | 1 per page |
| Adjective triad ("מהיר, אמין ומקצועי") | 0 |
| Two paragraphs making the same claim | 0 |

**Count the bolded lead-ins per list, not per page.** The page-level grep is a screen, not a
verdict. A page carrying four separate lists can hold more than three of them and still read as a
person wrote it. The tell is one list where the shape never varies.

Measured on `phone-screen-replacement-kiryat-gat`, 9.8.2026: 15 on the page, spread over four
lists. Six were doing real work, four symptoms a customer scans for and two glossary labels. Nine
were the tell: four one-word price factors in identical shape, and five process steps that an `<ol>`
already numbers, so the bold repeated what the markup said.

Report the counts before the edit, then say which lists justify themselves. They are the argument
for the changes you are about to make.

## The structural tells

These carry almost all of the machine feeling in Hebrew, and no regex catches them.

**Bolded lead-in on every list item.** Seven bullets, every one opening `<b>משהו.</b> ואז הסבר.`
The shape is fine once or twice. Repeated down a whole list it reads as a generated table of
contents. Fix: turn most of them into ordinary sentences and keep the bold only where the reader
genuinely scans for that term.

**Parallel headings that are all questions.** "כמה זה עולה?", "כמה זמן זה לוקח?", "יש אחריות?"
Four in a row is an FAQ schema that escaped into the page. Fix: keep the one real question and turn
the rest into statements that answer themselves. Note that questions inside a genuine FAQ block with
`FAQPage` schema are correct and stay.

**"לא X אלא Y".** The imported binary contrast. "זו לא רק מעבדה, אלא בית." Say Y and stop.
"זו מעבדה שאנשים חוזרים אליה."

**The abstract triad, and only the abstract one.** "מהיר, אמין ומקצועי", "וותק, אמון ושירות",
"תשובה, פתרון וחיוך". Three abstract nouns in a row is the most recognizable shape in Israeli
marketing copy. Replace with one concrete fact.

A three-item list of real things is **not** this tell. "המשקל, האחסון והסוללה" and "מסך, סוללה
ותקלות" name objects and stay. Measured 9.8.2026: a regex for the shape returned 119 hits and only
about a quarter were rhetorical. Judge the nouns, not the commas.

**Self-answered question as a header.** "אז מה עושים?", "מה זה אומר בפועל?" Delete the question and
state the answer as the heading.

**Two paragraphs, one claim.** The machine restates instead of advancing. Each paragraph must add a
fact, a consequence, or a qualification the previous one did not have.

**A closing line that reaches for depth.** "כי בסוף, טלפון הוא לא רק מכשיר." Delete it. Do not
rewrite it into a better metaphor. End on the most concrete sentence already in the draft, or on the
next action (a phone number, a link, an opening hour).

**Summary endings.** "לסיכום", "בשורה התחתונה", a final paragraph that repeats the page. The reader
was just there.

## The tell that no single page shows

The strongest finding of the 9.8.2026 audit was invisible page by page. All 17 pages under
`phones/` carry a list of 7 to 9 items where every item opens with a bolded lead-in, in the same
position, at roughly the same length. **Every one of those pages is defensible on its own.** The
reader who opens two of them in a row sees the shape twice and stops reading it as writing.

So when a set of pages was generated from one template, audit the set and not the page. Open three
side by side and ask what is identical that did not have to be: list length, item order, whether the
lead-in is bold at all, where the list sits on the page. Change enough that two out of three look
like someone wrote them separately.

Replacing one uniform shape with a different uniform shape fixes nothing.

## Translationese, the Hebrew-specific layer

Hebrew written by a machine is usually English syntax wearing Hebrew words. This table is the
highest-yield part of the skill.

| Machine | Human |
|---|---|
| "הבעיה נפתרה על ידי הטכנאי" | "הטכנאי פתר את הבעיה" |
| "ניתן להזמין תור" | "אפשר להזמין תור" |
| "המכשיר אשר נמסר לתיקון" | "המכשיר שנמסר לתיקון" |
| "בין אם המסך שבור ובין אם הסוללה נגמרת" | pick the one that matters, or "אם המסך שבור או שהסוללה נגמרת" |
| "תוך שמירה על כל המידע" | "בלי לאבד כלום" |
| "לא רק מסך אלא גם סוללה" | "מסך וגם סוללה" |
| "כאן נכנסת לתמונה המעבדה" | delete the sentence |
| "אנחנו בפון גת מאמינים ש..." | delete, then state what you actually do |
| "מגוון רחב של פתרונות" | name the two or three actual services |
| "על מנת ל..." | "כדי ל..." |

The passive is the one to hunt hardest. Hebrew defaults to active, so every "על ידי" is worth one
look. Twenty-four of them sit in the site today.

## Filler words: count them, do not ban them

None of these is wrong. Each becomes a tell only by repetition.

At most one per page: מדובר ב, בפועל, בדיוק, כאמור, בסופו של דבר, ממש, למעשה.

Zero, always: ראוי לציין, חשוב לציין, בשורה התחתונה, בעולם של היום, בעידן שבו, אין ספק ש,
כידוע, ללא ספק.

**Do not strip a filler word that carries the writer's speaking rhythm.** "זה בדיוק מה שקרה לי"
is a person talking. "זה בדיוק מה שהופך את השירות למדויק" is padding.

## Empty superlatives

מהפכני, פורץ דרך, חדשני, מתקדם, איכותי, ללא פשרות, ברמה הגבוהה ביותר, הפתרון המושלם, המוביל בתחום.

Every one of them is a claim with no content, and some are also a legal exposure (see
`pg-new-content-page` §8). Replace with the fact underneath:

- "שירות ברמה הגבוהה ביותר" becomes "החלפת מסך תוך שעה, עם אחריות לשנה"
- "מעבדה מתקדמת" becomes "בדיקה מול הלקוח לפני שמתחילים"

## Typography, where Hebrew genuinely differs

**Em dash (—): zero. Always.** This overrides any general editing guidance that permits one or two
in a long draft. In Hebrew nobody types it by hand, so it is the loudest single tell, and
`preflight.js` check 13 fails the push over it. Applies to body, headings, `alt`, `title`,
`meta description`, JSON-LD strings and button labels. Use a comma, a full stop or a colon.

**En dash (–) is legal inside a range only:** `א׳–ה׳`, `9:00–18:30`.

**Do not "fix" a straight quote inside an acronym.** `בע״מ` set with real gershayim is prettier,
but `בע"מ` with a straight quote is what an Israeli keyboard produces, so it is evidence of a person
rather than a machine. An earlier draft of this skill had this backwards. Measured 9.8.2026: 65 hits
across the site, every single one `בע"מ` in the footer. Leave them alone.

**Curly English quotes (“ ”) never appear in hand-typed Hebrew.** Their presence means the text was
pasted out of a model or a word processor.

**Check ranges and percentages on the rendered RTL page, not in the source.** `5-10` and `50%` flip
in ways the source does not show.

## Brand rules that outrank style

From `CLAUDE.md`, and a style edit must never break them:

- **WhatsApp**, never וואטסאפ. Enforced, check 12.
- **Never חינם.** Write **ללא עלות**. It cheapens the brand.
- Phone numbers read `052-5893366` and `08-6812050`. Digits only inside `tel:` and `wa.me`.
- **Never edit a customer review.** They are real. Fixing a fact elsewhere on the page does not
  license touching a quote, not even a typo.

## The portability test

If a sentence could move to any other phone shop in Israel without changing one word, it is filler.
Cut it, or replace it with something only Phone Gat could write.

- "שירות אמין ומקצועי" moves anywhere. Cut.
- "ברוך פותח את המכשיר מול הלקוח" moves nowhere. Keep.

Names, numbers, streets, years, and the actual sequence of what happens at the counter are what make
a local page unfakeable, and they are also what the local search results reward.

## What not to do

- Do not flatten voice into polish. A page with a rough, spoken, opinionated line should still sound
  like the same person afterwards.
- Do not invent a fact, a price, a warranty term, or a turnaround time. If a sentence needs a number
  you do not have, ask.
- Do not "fix" a strong blunt sentence into something safer.
- Do not reorganize a page unless the structure is hurting it, and say why in **מה השתנה** if you do.

## Workflow

1. Read the whole draft first.
2. Count the shapes and report the counts.
3. Note 3 to 5 voice signals worth protecting. Keep the note to yourself.
4. For a detect request, return the findings and stop.
5. For an edit, make the minimum effective change, then check the result against `eval.md` yourself.
6. Fix and re-check anything that fails.
7. Return the edited text and a short **מה השתנה**.
8. If the text is going into a page, say whether `node .claude/preflight.js` still needs to run.
