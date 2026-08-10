# pg-hebrew-slop eval

Run this on the edited draft before returning it. Answer each check pass or fail. Fix every fail and
re-run. For a detect request, check only that every tell found is named, quoted, counted, and given a
short fix, with no rewriting.

## Counts

1. Is there no list of 4 or more items where every item opens with a bolded lead-in, and was each
   surviving list justified out loud rather than counted at the page level?
2. Is there at most 1 heading phrased as a question, not counting a genuine `FAQPage` block?
3. Is there at most 1 "לא X אלא Y"?
4. Are there zero adjective triads such as "מהיר, אמין ומקצועי"?
5. Does every paragraph add a fact, a consequence, or a qualification the one before it did not have?
6. Were the counts reported to the user alongside the edit?

## Structure

7. Was a closing line reaching for depth deleted rather than rewritten into a better metaphor?
8. Does the text end on a concrete point, a takeaway, or a next action rather than a recap?
9. Were self-answered question headers turned into statements?

## Translationese

10. Was every "על ידי" either turned active or justified?
11. Are "ניתן ל", "אשר", "על מנת", "תוך שמירה על", "בין אם ובין אם" replaced unless the formal
    register was deliberate?
12. Were "כאן נכנס לתמונה" and "אנחנו מאמינים ש" openers deleted rather than reworded?

## Words

13. Do "ראוי לציין", "חשוב לציין", "בשורה התחתונה", "בעולם של היום", "אין ספק" appear zero times?
14. Does each of "מדובר ב", "בפועל", "בדיוק", "כאמור", "בסופו של דבר" appear at most once?
15. Were filler words that carry the writer's speaking rhythm left in place?
16. Was every empty superlative replaced with the fact underneath it rather than deleted into a gap?

## Typography

17. Zero em dashes (—) in anything a reader or a crawler sees, including `alt`, `title`, `meta` and
    JSON-LD?
18. Are en dashes (–) present only inside ranges?
19. Were straight quotes inside acronyms (`בע"מ`, `ש"ח`) left untouched? Changing them to ״ is not
    an improvement and makes the text look less hand-typed, not more.
20. Are there no curly English quotes (“ ”)?

## Brand

21. "WhatsApp" and never "וואטסאפ"?
22. Zero occurrences of "חינם", replaced by "ללא עלות"?
23. Phone numbers `052-5893366` / `08-6812050` in display text, digits only in `tel:` and `wa.me`?
24. Was every customer review left byte for byte unchanged?

## Voice

25. Would the writer recognize this as his own text rather than a cleaned-up version of it?
26. Was any fact, price, warranty term, or turnaround time invented? (Must be no.)
27. Does every remaining sentence fail the portability test, meaning it could not move unchanged to
    another phone shop?
