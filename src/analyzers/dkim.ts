import { queryTxt } from "../dns/client.js";
import { parseTags } from "../shared/parse-tags.js";
import type { DkimResult, DkimSelectorResult, Validation } from "./types.js";

const COMMON_SELECTORS = [
  "google",
  "selector1",
  "selector2",
  "default",
  "dkim",
  "s1",
  "s2",
  "k1",
  "k2",
  "k3",
  "mail",
  "email",
  "pm",
  "protonmail",
  "protonmail2",
  "protonmail3",
  "mandrill",
  "mxvault",
  "smtp",
  "cm",
  "amazonses",
  "ses",
  "everlytickey1",
  "everlytickey2",
  "dkim1",
  "dkim2",
  "mailo",
  "postmark",
  "turbo-smtp",
  "cf2024-1",
  "cf2024-2",
  "cf2025-1",
  "cf2025-2",
];

export async function analyzeDkim(
  domain: string,
  customSelectors: string[] = [],
): Promise<DkimResult> {
  const allSelectors = [
    ...new Set([...COMMON_SELECTORS, ...customSelectors]),
  ];

  const results = await Promise.allSettled(
    allSelectors.map((sel) => probeSelector(domain, sel)),
  );

  const selectors: Record<string, DkimSelectorResult> = {};
  for (let i = 0; i < allSelectors.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      selectors[allSelectors[i]] = result.value;
    } else {
      selectors[allSelectors[i]] = { found: false };
    }
  }

  const found = Object.entries(selectors).filter(([, v]) => v.found);
  const validations: Validation[] = [];

  if (found.length > 0) {
    validations.push({
      status: "pass",
      message: `${found.length} DKIM selector${found.length > 1 ? "s" : ""} found`,
    });
  } else {
    validations.push({
      status: "fail",
      message:
        "No DKIM selectors found among common selectors — try specifying a custom selector",
    });
  }

  // Check for weak keys
  const weakKeys = found.filter(
    ([, v]) => v.key_bits && v.key_bits < 2048,
  );
  if (weakKeys.length > 0) {
    validations.push({
      status: "warn",
      message: `${weakKeys.map(([k]) => k).join(", ")} — RSA key under 2048 bits (weak)`,
    });
  }

  // Check for revoked keys
  const revoked = found.filter(([, v]) => v.revoked);
  if (revoked.length > 0) {
    validations.push({
      status: "warn",
      message: `${revoked.map(([k]) => k).join(", ")} — key revoked (empty p= tag)`,
    });
  }

  // Check for testing mode
  const testing = found.filter(([, v]) => v.testing);
  if (testing.length > 0) {
    validations.push({
      status: "warn",
      message: `${testing.map(([k]) => k).join(", ")} — in testing mode (t=y)`,
    });
  }

  const hasFailure = validations.some((v) => v.status === "fail");
  const hasWarn = validations.some((v) => v.status === "warn");
  const status = hasFailure ? "fail" : hasWarn ? "warn" : "pass";

  return { status, selectors, validations };
}

async function probeSelector(
  domain: string,
  selector: string,
): Promise<DkimSelectorResult> {
  const txt = await queryTxt(`${selector}._domainkey.${domain}`);
  if (!txt) return { found: false };

  const dkimRecord = txt.entries.find(
    (e) => e.includes("v=DKIM1") || e.includes("p="),
  );
  if (!dkimRecord) return { found: false };

  const tags = parseTags(dkimRecord, { lowercaseKeys: false });

  const keyType = tags.k || "rsa";
  const publicKey = tags.p || "";
  const revoked = publicKey === "";
  const testing = tags.t === "y";

  // Estimate key bits from DER-encoded public key byte length
  let keyBits: number | undefined;
  if (publicKey && keyType === "rsa") {
    const decoded = atob(publicKey.replace(/\s/g, ""));
    keyBits = estimateRsaKeyBits(decoded.length);
  }

  return { found: true, key_type: keyType, key_bits: keyBits, testing, revoked };
}

/**
 * Map DER-encoded SubjectPublicKeyInfo byte length to standard RSA key size.
 * Known DER sizes: 1024-bit ≈ 162 bytes, 2048-bit ≈ 294 bytes, 4096-bit ≈ 550 bytes.
 * Uses ranges to account for slight variations in key parameters.
 */
function estimateRsaKeyBits(derLength: number): number {
  if (derLength <= 200) return 1024;
  if (derLength <= 400) return 2048;
  return 4096;
}

