import type {
  DmarcResult,
  SpfResult,
  DkimResult,
  BimiResult,
  MtaStsResult,
} from "../analyzers/types.js";

interface Protocols {
  dmarc: DmarcResult;
  spf: SpfResult;
  dkim: DkimResult;
  bimi: BimiResult;
  mta_sts: MtaStsResult;
}

export function computeGrade(protocols: Protocols): string {
  const { dmarc, spf, dkim, bimi, mta_sts } = protocols;

  // Gatekeeper: no DMARC or p=none is automatic F
  const dmarcPolicy = dmarc.tags?.p?.toLowerCase() ?? null;
  if (dmarc.status === "fail" || !dmarcPolicy || dmarcPolicy === "none") {
    return "F";
  }

  const hasSpf = spf.status !== "fail";
  const hasDkim = dkim.status !== "fail";
  const hasBimi = bimi.status === "pass";
  const hasMtaSts = mta_sts.status === "pass";

  // D: quarantine but missing SPF or DKIM
  if (dmarcPolicy === "quarantine" && (!hasSpf || !hasDkim)) {
    return "D";
  }

  // reject but missing SPF or DKIM
  if (dmarcPolicy === "reject" && (!hasSpf || !hasDkim)) {
    return "D+";
  }

  // C: quarantine with SPF + DKIM
  if (dmarcPolicy === "quarantine" && hasSpf && hasDkim) {
    let modifier = 0;
    modifier += spfModifier(spf);
    modifier += dkimModifier(dkim);
    return applyModifier("C", modifier);
  }

  // B: reject with SPF + DKIM
  if (dmarcPolicy === "reject" && hasSpf && hasDkim) {
    // Check if we should upgrade to A
    const spfStrong =
      spf.record?.includes("-all") && spf.lookups_used <= spf.lookup_limit;
    const hasExtras = hasBimi || hasMtaSts;

    if (spfStrong && hasDkim && hasExtras) {
      // A tier
      if (hasBimi && hasMtaSts) {
        return "A+";
      }
      let modifier = 0;
      modifier += spfModifier(spf);
      modifier += dkimModifier(dkim);
      if (mta_sts.policy?.mode === "testing") modifier -= 1;
      return applyModifier("A", modifier);
    }

    // B tier
    let modifier = 0;
    modifier += spfModifier(spf);
    modifier += dkimModifier(dkim);
    if (hasExtras) modifier += 1;
    return applyModifier("B", modifier);
  }

  return "C";
}

function spfModifier(spf: SpfResult): number {
  let mod = 0;
  if (spf.record?.includes("~all")) mod -= 1;
  if (spf.lookups_used > 8) mod -= 1;
  if (spf.record?.includes("-all") && spf.lookups_used <= 5) mod += 1;
  return mod;
}

function dkimModifier(dkim: DkimResult): number {
  let mod = 0;
  const found = Object.values(dkim.selectors).filter((s) => s.found);
  if (found.some((s) => s.key_bits && s.key_bits < 2048)) mod -= 1;
  if (found.length >= 2) mod += 1;
  return mod;
}

function applyModifier(
  base: "A" | "B" | "C" | "D",
  modifier: number,
): string {
  if (modifier >= 2) return `${base}+`;
  if (modifier <= -2) return `${base}-`;
  if (modifier >= 1) return `${base}+`;
  if (modifier <= -1) return `${base}-`;
  return base;
}
