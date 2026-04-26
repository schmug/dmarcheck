// Curated allowlist of domains whose `/check?domain=…` page is allowed to be
// indexed by search engines and listed in the sitemap. Two motivations:
//
//   1. Branded queries like "dmarc check gmail.com" are valuable inbound
//      traffic. By pre-listing the popular targets in our sitemap we give
//      Google a clean URL to crawl with a stable canonical and a meta
//      description we control.
//   2. Arbitrary user-submitted scan URLs make poor search results — content
//      varies per scan, snippets get scraped from icon glyphs, and we have no
//      query-intent signal. Those pages emit `noindex` so Google focuses
//      authority on landing/learn/scoring and the curated examples here.
//
// Keep the list small (curated, not exhaustive). Every entry must already be
// normalized through normalizeDomain() to lowercase, no protocol, no path.
// Adding a domain here also commits us to the snippet looking reasonable —
// don't list domains whose scans currently render poorly.

const RAW_INDEXABLE_SCAN_DOMAINS = [
  // Self
  "dmarc.mx",

  // Major mail providers — high-intent "dmarc check {provider}" queries
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "fastmail.com",
  "zoho.com",
  "aol.com",

  // Big consumer brands
  "google.com",
  "microsoft.com",
  "apple.com",
  "amazon.com",
  "meta.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "netflix.com",
  "spotify.com",
  "youtube.com",
  "reddit.com",
  "tiktok.com",

  // Developer / SaaS platforms
  "github.com",
  "gitlab.com",
  "stripe.com",
  "shopify.com",
  "cloudflare.com",
  "vercel.com",
  "netlify.com",
  "atlassian.com",
  "slack.com",
  "notion.so",
  "figma.com",
  "openai.com",
  "anthropic.com",

  // Commerce / financial
  "paypal.com",
  "ebay.com",
  "wellsfargo.com",
  "chase.com",
  "bankofamerica.com",

  // News / reference
  "wikipedia.org",
  "nytimes.com",
  "bbc.com",
  "cnn.com",
] as const;

const INDEXABLE_SCAN_DOMAINS: ReadonlySet<string> = new Set(
  RAW_INDEXABLE_SCAN_DOMAINS,
);

/**
 * Returns true if a `/check?domain=…` page for this domain should be indexed
 * by search engines and listed in the sitemap. Input must already be
 * normalized via normalizeDomain() (lowercase, no protocol, no path).
 */
export function isIndexableScanDomain(domain: string): boolean {
  return INDEXABLE_SCAN_DOMAINS.has(domain);
}

/**
 * The full curated list, used by the sitemap generator to enumerate the
 * scan URLs we want crawled.
 */
export function listIndexableScanDomains(): readonly string[] {
  return RAW_INDEXABLE_SCAN_DOMAINS;
}
