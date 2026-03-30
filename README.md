# dmarcheck

DNS email security analyzer — checks DMARC, SPF, DKIM, BIMI, and MTA-STS records for any domain.

**Live at [dmarcheck.cortech.online](https://dmarcheck.cortech.online)**

## Features

- **DMARC** — Policy parsing, validation, reporting URI checks
- **SPF** — Full recursive include chain resolution, 10-lookup limit tracking, misconfiguration detection
- **DKIM** — Auto-probes ~30 common selectors + custom selectors, key strength analysis
- **BIMI** — Logo and VMC validation, DMARC policy cross-check
- **MTA-STS** — DNS record + HTTPS policy file fetch and validation

### Dual Output

- **JSON API** for developers — `curl https://dmarcheck.cortech.online/api/check?domain=cloudflare.com`
- **Interactive HTML report** for browsers — expandable protocol cards, SPF include tree, educational tooltips

### Grading

Letter grades from A+ to F. DMARC is the gatekeeper — no DMARC record or `p=none` is an automatic F.

| Grade | Criteria |
|-------|----------|
| **A+** | All five protocols fully configured and validated |
| **A** | DMARC reject, SPF valid with hardfail, DKIM found, + BIMI or MTA-STS |
| **B** | DMARC reject, SPF + DKIM present |
| **C** | DMARC quarantine, SPF + DKIM present |
| **D** | DMARC quarantine but missing SPF or DKIM |
| **F** | No DMARC record or `p=none` |

## API

```bash
# JSON response
curl https://dmarcheck.cortech.online/api/check?domain=example.com

# With custom DKIM selectors
curl "https://dmarcheck.cortech.online/api/check?domain=example.com&selectors=myselector,other"

# Content negotiation on /check
curl -H "Accept: application/json" "https://dmarcheck.cortech.online/check?domain=example.com"
```

Response includes a `summary` with elevated fields and full `protocols` detail:

```json
{
  "domain": "example.com",
  "grade": "A",
  "summary": {
    "dmarc_policy": "reject",
    "spf_result": "pass",
    "spf_lookups": "3/10",
    "dkim_selectors_found": 2,
    "bimi_enabled": true,
    "mta_sts_mode": "enforce"
  },
  "protocols": { ... }
}
```

## Development

```bash
npm install
npm run dev       # starts local dev server on port 8790
npm test          # runs unit tests
```

## Deploy

```bash
npm run deploy    # deploys to Cloudflare Workers
```

## Stack

- [Hono](https://hono.dev) — lightweight web framework for Cloudflare Workers
- TypeScript + `node:dns` via `nodejs_compat`
- Rate limited to 10 requests/IP/minute via Cloudflare Cache API

## License

MIT
