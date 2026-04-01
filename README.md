<p align="center">
  <img src="https://dmarc.mx/logo.svg" alt="dmarcheck" width="120" height="120">
</p>

<h1 align="center">dmarcheck</h1>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://dmarc.mx"><img src="https://img.shields.io/badge/Cloudflare%20Workers-Deployed-f38020?logo=cloudflare" alt="Deploy to Cloudflare Workers"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" alt="TypeScript"></a>
</p>

DNS email security analyzer — checks DMARC, SPF, DKIM, BIMI, and MTA-STS records for any domain.

**Live at [dmarc.mx](https://dmarc.mx)**

## Features

- **DMARC** — Policy parsing, validation, reporting URI checks
- **SPF** — Full recursive include chain resolution, 10-lookup limit tracking, misconfiguration detection
- **DKIM** — Auto-probes ~30 common selectors + custom selectors, key strength analysis
- **BIMI** — Logo and VMC validation, DMARC policy cross-check
- **MTA-STS** — DNS record + HTTPS policy file fetch and validation

### Dual Output

- **JSON API** for developers — `curl https://dmarc.mx/api/check?domain=dmarc.mx`
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

## What is email security?

New to DMARC, SPF, and DKIM? Cloudflare has a great primer: [What are DMARC, DKIM, and SPF?](https://www.cloudflare.com/learning/email-security/dmarc-dkim-spf/)

### Message header analyzers

Once your DNS records are configured, you can verify authentication results in actual email headers:

- [Google Admin Toolbox — Message Header Analyzer](https://toolbox.googleapps.com/apps/messageheader/)
- [Microsoft Remote Connectivity Analyzer — Message Header](https://mha.azurewebsites.net/)

## API

```bash
# JSON response
curl https://dmarc.mx/api/check?domain=dmarc.mx

# With custom DKIM selectors
curl "https://dmarc.mx/api/check?domain=dmarc.mx&selectors=myselector,other"

# Content negotiation on /check
curl -H "Accept: application/json" "https://dmarc.mx/check?domain=dmarc.mx"
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

## Self-Hosting

You can deploy your own instance of dmarcheck to Cloudflare Workers.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free plan works)

### Setup

```bash
git clone https://github.com/schmug/dmarcheck.git
cd dmarcheck
npm install
```

### Local Development

```bash
npm run dev       # starts local dev server on http://localhost:8790
npm test          # runs unit tests
```

### Deploy to Your Own Cloudflare Account

1. Authenticate with Cloudflare:
   ```bash
   npx wrangler login
   ```

2. Edit `wrangler.toml` to use your own custom domain (or remove the `routes` block to use the default `*.workers.dev` subdomain):
   ```toml
   routes = [
     { pattern = "yourdomain.com", custom_domain = true },
   ]
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

### Configuration

| Setting | Location | Default |
|---------|----------|---------|
| Dev server port | `wrangler.toml` → `[dev].port` | 8790 |
| Rate limit | `src/rate-limit.ts` → `LIMIT` | 10 req/IP/min |
| Rate limit window | `src/rate-limit.ts` → `WINDOW_SECONDS` | 60s |
| DKIM selectors | `src/analyzers/dkim.ts` → `COMMON_SELECTORS` | ~30 common selectors |

## Stack

- [Hono](https://hono.dev) — lightweight web framework for Cloudflare Workers
- TypeScript + `node:dns` via `nodejs_compat`
- Rate limited via Cloudflare Cache API (no extra bindings needed)

## License

MIT
