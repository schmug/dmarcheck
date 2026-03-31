# Email Creature Easter Egg — Design Spec

## Context

dmarcheck is a DNS email security analyzer with a polished dark-theme UI and an existing easter egg (confetti on good grades). This feature adds a second easter egg: an animated "@" creature that appears when users are idle, walks across the page eating elements by dragging them off-screen, and panics when caught. It's a fun reward for users who leave the tab open. The entire feature runs client-side with zero server impact.

## Creature: The @ Bug

- A `position: fixed` `<div>` containing:
  - Large orange `@` character (monospace, matching the `#f97316` accent)
  - Two white googly eyes with dark pupils that shift based on movement direction
  - Three small legs at the bottom that alternate height via `@keyframes creature-walk`
- Rendered entirely with CSS — no images, SVGs, or canvas

## Idle Detection

- Listeners on `mousemove`, `keydown`, `scroll`, `touchstart` reset a 60-second `setTimeout`
- When the timer fires, the creature spawns from a random viewport edge
- Active on both landing page and report page
- After the creature is dismissed, idle timer restarts with 2x cooldown (120s)
- Cooldown resets on page navigation

## Element Eating (Drag Off-Screen)

- Creature walks toward elements in top-to-bottom DOM order
- Movement: CSS `transition` on `left`/`top`, duration proportional to distance for consistent speed
- Leg animation plays only while moving

### Eat sequence per element:

1. **Approach** — creature walks to the target, offset slightly to one side
2. **Chomp** — 300ms pause, `@` symbol scales up slightly (`.creature-chomp` class)
3. **Drag** — target element gets `position: fixed` with its current `getBoundingClientRect()` as starting coords; CSS transition slides it off the nearest viewport edge; creature walks alongside
4. **Gone** — element set to `visibility: hidden`; original styles stored in an array for restoration

### Target elements:

- **Landing page:** logo, tagline, search box, examples, API hint, footer
- **Report page:** grade badge, domain name, score snippet, each protocol card
- Any element in the creature's path is fair game — maximum chaos
- Elements scrolled out of view are skipped

## Click to Panic & Restore

- **Click the creature:** eyes go wide (pupils shrink, eyes scale up), legs speed up, creature zigzags erratically toward the nearest edge via `@keyframes creature-panic` (~500ms), then exits and is removed from DOM
- **Any user interaction** (mouse move, keypress, scroll, touch) while creature is active also triggers the panic sequence — the page never feels stuck
- **Restore:** all eaten elements slide back simultaneously from their exit edges to original positions; ~400ms CSS transition with 80ms stagger between elements; inline styles removed after transition so elements return to normal flow

## Accessibility

- **`prefers-reduced-motion`:** entire feature disabled (same pattern as confetti)
- **Keyboard:** creature gets `tabindex="0"`, `role="button"`, `aria-label="Stop the email creature"`; Enter/Space triggers panic
- **Screen readers:** `aria-live="polite"` announces "An email creature appeared!" on spawn; eaten elements keep DOM position (only visually moved)

## Performance

- All animations use `transform` and `opacity` only (compositor-layer, no layout thrashing)
- Creature element gets `will-change: transform`
- Idle detection is a single `setTimeout`, not an interval
- Estimated addition: ~150-200 lines JS in `scripts.ts`, ~40 lines CSS in `styles.ts`

## Files Modified

| File | Changes |
|------|---------|
| `src/views/scripts.ts` | Idle detection, creature spawn, walk/eat/panic/restore logic in a self-contained IIFE |
| `src/views/styles.ts` | `.at-creature`, `@keyframes creature-walk`, `@keyframes creature-panic`, `@keyframes creature-chomp`, `.eaten-element` transition, `prefers-reduced-motion` gate |

No changes to: `index.ts`, `html.ts`, `components.ts`, analyzers, orchestrator, scoring, DNS, rate limiting, or tests.

## Verification

1. `npm test` — all 144 existing tests still pass (feature is client-side only)
2. `npm run dev` — load landing page, wait 60s (or temporarily reduce to 5s), confirm creature appears and eats elements top-to-bottom
3. Click creature — confirm panic animation, exit, and all elements restore with stagger
4. Move mouse while creature is active — confirm it also triggers panic/restore
5. Set `prefers-reduced-motion: reduce` in browser DevTools — confirm creature never appears
6. Tab through to creature with keyboard, press Enter — confirm panic triggers
7. Test on report page with a real scan result
8. Test responsive behavior at mobile viewport widths
