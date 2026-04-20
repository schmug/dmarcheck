// RFC 9727 API catalog — advertises the public scan API to automated agents.
// https://www.rfc-editor.org/rfc/rfc9727

export const CANONICAL_ORIGIN = "https://dmarc.mx";

export interface LinksetEntry {
  anchor: string;
  "service-desc": Array<{ href: string; type: string }>;
  "service-doc": Array<{ href: string; type: string }>;
  status: Array<{ href: string }>;
}

export interface ApiCatalog {
  linkset: LinksetEntry[];
}

export function buildApiCatalog(origin: string = CANONICAL_ORIGIN): ApiCatalog {
  const sharedRefs = {
    "service-desc": [
      { href: `${origin}/openapi.json`, type: "application/openapi+json" },
    ],
    "service-doc": [{ href: `${origin}/docs/api`, type: "text/html" }],
    status: [{ href: `${origin}/health` }],
  };
  return {
    linkset: [
      { anchor: `${origin}/api/check`, ...sharedRefs },
      { anchor: `${origin}/api/bulk-scan`, ...sharedRefs },
    ],
  };
}

// Built once per Worker instance — payload is ~300 bytes.
export const API_CATALOG_JSON = JSON.stringify(buildApiCatalog());
