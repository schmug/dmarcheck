---
name: dmarcus-mood-check
description: Invariants and conventions for DMarcus, the dmarcheck mascot (the @ creature with three legs). Use when editing src/views/components.ts, src/views/styles.ts, src/views/scripts.ts, or any view that renders the creature — to ensure sizes, moods, party-hat rules, grade-to-mood mapping, and the reduced-motion contract stay consistent.
user-invocable: false
---

# DMarcus mood + rendering invariants

DMarcus is the dmarcheck mascot: an orange `@` character with googly eyes and three legs. He appears in the landing page, report header, loading state, error page, nav, footer, and as an idle easter egg. Any change to his rendering must preserve the invariants below.

## Where he lives

- **Render helper:** `generateCreature(size, mood?, partyHat?)` in `src/views/components.ts`.
- **Mood mapping:** `gradeToMood(grade)` in the same file.
- **Styles + animation:** `src/views/styles.ts` (selectors: `.creature`, `.creature-eyes`, `.creature-legs`, `.creature-partying`, etc.).
- **Easter-egg behavior:** `src/views/scripts.ts` (idle walk/eat, 60s trigger, panic on interaction).

## Invariants

### Sizes
Exactly three: `lg` | `md` | `sm`. Used as:
- `lg` — landing page logo
- `md` — grade reactions in the report header, footer
- `sm` — nav links

Do NOT introduce `xl`, `xs`, or numeric sizes. If a new context needs a size variant, map it to the closest existing size.

### Moods
Exactly five: `celebrating` | `content` | `worried` | `scared` | `panicked`.
Mood is ONLY passed when rendering a grade-reaction creature (in the report). Landing, nav, and footer creatures have no mood class.

### Grade → mood mapping (must match `gradeToMood`)
- `S` → `celebrating` (perfect grade, easter egg)
- `A+` / `A` / `A-` → `celebrating`
- `B+` / `B` / `B-` → `content`
- `C+` / `C` / `C-` → `worried`
- `D+` / `D` / `D-` → `scared`
- `F` → `panicked`

Only the first character (A/B/C/D/F) matters except for `S`.

### Party hat
- `partyHat = true` ONLY for the `S` grade (perfect, with the `dmarc.mx` TXT easter egg triggered in orchestrator).
- Party hat enables the `creature-partying` animation class (dance).
- Never ship party hat for any A-tier grade, even `A+`. The distinction is intentional.

### Accessibility
- Creature HTML includes `aria-hidden="true"` — DMarcus is decorative. His meaning is conveyed by the grade text elsewhere.
- If you add text near the creature, ensure the textual grade/status is still the authoritative signal for screen readers.

### Reduced motion (easter egg)
- The idle creature-walk-around-eating-the-page easter egg in `src/views/scripts.ts` MUST respect `prefers-reduced-motion: reduce`. Check with `window.matchMedia("(prefers-reduced-motion: reduce)")` before starting the animation; disable or significantly reduce movement if set.
- The 60-second idle trigger and the panic-on-interaction behavior should also be suppressed under reduced motion.
- Party-hat dance animation should ideally also gate on reduced-motion, but at minimum the idle easter egg must.

### Name
The mascot's name is **DMarcus** — not "the creature", "@-character", "the mascot", etc. Use the name in user-facing strings (loading text, footer "Guarded by DMarcus", error page, aria-labels where a human name helps).

The name is a pun on DMARC. Do not rename.

### Color
Orange accent `#f97316` — pulled from the existing theme tokens, not hardcoded. Light/dark theme variants are already handled in `src/views/styles.ts`; new creature-specific styling should use CSS variables, not literal hex.

## Before committing changes

When your change touches the creature:
- Read `src/views/components.ts` (`generateCreature`, `gradeToMood`) to confirm you haven't drifted from the helper.
- Grep for `creature-` class selectors to make sure any new class you added is styled in `src/views/styles.ts`.
- If you added a new mood or size: update this skill file to match.

## When NOT to apply

- Editing non-view code (analyzers, scoring, DNS) — DMarcus invariants don't apply.
- Pure text copy changes in views that don't render the creature.
- Changes to non-creature UI elements (forms, tables, cards) — those have their own conventions in `CLAUDE.md` §Conventions.
