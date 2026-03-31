# Email Security Resource Link

## Context

Users landing on dmarcheck may not know what DMARC, SPF, or DKIM are. Rather than writing custom educational content, we'll link to one authoritative external resource. The existing protocol tag pills on the landing page are non-interactive and add visual clutter — they'll be removed as part of this change.

## Design

### What changes

1. **Remove protocol tag pills** from the landing page (the `<div class="protocols">` section and its `.protocol-tag` CSS)
2. **Add a "What is email security?" link** in the space where the pills were, pointing to Cloudflare's guide: `https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/`
3. **Add the same link to the README** in a short new section

### Landing page layout (after)

```
logo
tagline
[search box]
"What is email security?" ↗   <-- new, replaces protocol pills
Try: google.com · github.com · cloudflare.com
curl hint
FOSS callout
```

### Files to modify

- `src/views/html.ts` — Remove `<div class="protocols">` block (lines 50-56), add the link in its place
- `src/views/styles.ts` — Remove `.protocols` and `.protocol-tag` CSS rules (line 38-42)
- `README.md` — Add a short "Learn more" section with the same Cloudflare link

### Link styling

- Orange text (`#f97316`) matching existing accent color
- External link indicator (↗ or similar)
- Small font size, subtle — similar weight to the "examples" line
- Opens in new tab (`target="_blank" rel="noopener"`)

### README section

Add after the Features section:

```markdown
## What is email security?

New to DMARC, SPF, and DKIM? Cloudflare has a great primer:
[What are DMARC, DKIM, and SPF?](https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/)
```

## Verification

1. Run `npm run dev` and check the landing page — pills should be gone, link should appear
2. Click the link — should open Cloudflare's guide in a new tab
3. Check README on GitHub — new section should render correctly
4. Run `npm test` — no regressions
