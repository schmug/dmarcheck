# @ Bug Creature Branding Pass — Design Spec

## Context

dmarcheck recently added an easter egg: the "@ Bug" — an animated CSS creature (orange `@` with googly eyes and three legs) that appears after 60 seconds of idle time, walks across the page eating elements, and panics when caught. The creature has strong personality and is entirely CSS/JS — no images.

This branding pass promotes the @ Bug from hidden easter egg to full brand mascot, incorporating it across every major touchpoint in the site and repo. The goal is a cohesive visual identity where the creature IS the brand.

## Creature Component System

A reusable `generateCreature(size, mood)` function in `components.ts` that returns an HTML string. All static creatures share the same anatomy: orange `@` character (#f97316), two white googly eyes with dark pupils, three small orange legs.

### Sizes

- **Large** (`creature-lg`, 48px) — landing page logo, loading state
- **Medium** (`creature-md`, 28-32px) — grade reactions, footer, error states
- **Small** (`creature-sm`, 16-20px) — report page nav, inline accents

### Moods (CSS classes)

| Class | Grade | Eyes | Pupils |
|-------|-------|------|--------|
| `.creature-celebrating` | A+/A | Normal | Up-and-out (looking up) |
| `.creature-content` | B | Normal | Centered, neutral |
| `.creature-worried` | C | Normal | Down, one offset (side-eye) |
| `.creature-scared` | D | Slightly enlarged | Small, wide-set |
| `.creature-panicked` | F | Enlarged (1.4x) | Tiny (same as easter egg panic) |

The easter egg in `scripts.ts` continues to create its own dynamic creature (needs JS-driven animation). Static instances all come from the shared `generateCreature` function.

## Placements

### 1. Favicon

Replace the shield+checkmark SVG with a creature SVG. The `@` with eyes renders legibly at 16×16 — legs omitted at this size (too small to read). Orange on dark background. Same inline data URI approach already used in `src/index.ts`.

### 2. Logo / Header

**Landing page:** Creature (large) sits left of "dmar**check**" wordmark. The grey `@` superscript (`.logo-at`) is removed — creature replaces it as the brand mark.

**Report page:** Small creature sits left of the "dmarcheck" text in the nav/breadcrumb.

The easter egg spawn origin updates from `.logo-at` to the new logo creature element.

### 3. Loading State

While a domain scan is running (direct navigation loading state), show the creature (large) with legs animating using the existing `creature-walk` keyframes. Text below: "Scanning {domain}..." Replaces or augments the current loading spinner.

### 4. Error / Empty States

When DNS resolution fails or returns no usable records, show the creature (medium) with `.creature-worried` mood alongside a contextual message (e.g., "Couldn't resolve {domain}"). Replaces bare text error messages with a branded treatment.

### 5. Grade Reactions

Small-to-medium creature next to the grade badge on the report page. Mood matches the grade tier per the mood table above. Static, no animation. Positioned to the right of the grade circle.

### 6. Footer Mascot

Small creature (medium) in the landing page footer area near the FOSS callout. Static, `.creature-content` mood. Subtle presence.

### 7. Open Graph / Social Preview

An SVG served at `/og-image.svg`. Contains: creature (large), "dmarcheck" wordmark, tagline "DNS Email Security Analyzer", and a "BIMI-ready" note tying into the BIMI protocol (brand indicators in email — thematically relevant to having a mascot). Dark background matching site theme. Referenced via `og:image` meta tag.

### 8. README / Repo Branding

Creature SVG at the top of `README.md`. Can reference the updated `/logo.svg` endpoint or an inline SVG. Branded header section.

## Files Modified

| File | Changes |
|------|---------|
| `src/views/components.ts` | New `generateCreature(size, mood)` helper. Grade reaction creature. Error state creature component. |
| `src/views/styles.ts` | Creature size classes (`.creature-lg`, `.creature-md`, `.creature-sm`). Mood classes. Logo layout update (creature + wordmark). Loading state creature styles. |
| `src/views/html.ts` | Landing: creature in logo, creature in footer. Report: creature in nav, grade reaction, loading state. Error states. OG image meta tag. Remove `.logo-at`. |
| `src/views/scripts.ts` | Update easter egg spawn origin from `.logo-at` to new logo creature element. Loading state walking animation. |
| `src/index.ts` | New favicon SVG (creature). New `/og-image.svg` endpoint. Update `/logo.svg` to include creature. |
| `README.md` | Branded header with creature SVG. |

## What Stays The Same

- Easter egg behavior: idle detection, eating, panic, restore — all unchanged
- Confetti easter egg — unchanged
- All analyzers, scoring, DNS, rate limiting — no changes
- Dark theme, orange accent (#f97316), full color scheme preserved
- Creature in the logo becomes the easter egg spawn point (replacing `.logo-at`)

## Verification

1. `npm test` — all existing tests pass (changes are view-layer only)
2. `npm run dev` — landing page: creature in logo, footer, loading state when scanning
3. Report page: creature in nav, grade reaction next to badge, error states
4. Verify favicon in browser tab
5. Check `/og-image.svg` and `/logo.svg` endpoints render correctly
6. Verify easter egg still spawns from the logo creature position
7. Test responsive behavior at mobile widths
8. Inspect OG tags with a link preview tool
9. Check README renders on GitHub
