import type {
  BimiResult,
  DkimResult,
  DmarcResult,
  MtaStsResult,
  SpfResult,
  Status,
} from "../analyzers/types.js";

interface Protocols {
  dmarc: DmarcResult;
  spf: SpfResult;
  dkim: DkimResult;
  bimi: BimiResult;
  mta_sts: MtaStsResult;
}

export interface ScoringFactor {
  protocol: "dmarc" | "spf" | "dkim" | "bimi" | "mta_sts";
  label: string;
  effect: number;
}

export interface Recommendation {
  priority: 1 | 2 | 3;
  protocol: "dmarc" | "spf" | "dkim" | "bimi" | "mta_sts";
  title: string;
  description: string;
  impact: string;
}

export interface GradeBreakdown {
  grade: string;
  tier: string;
  tierReason: string;
  modifier: number;
  modifierLabel: string;
  factors: ScoringFactor[];
  recommendations: Recommendation[];
  protocolSummaries: Record<string, { status: Status; summary: string }>;
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

function applyModifier(base: "A" | "B" | "C" | "D", modifier: number): string {
  if (modifier >= 1) return `${base}+`;
  if (modifier <= -1) return `${base}-`;
  return base;
}

// ── Breakdown helpers ──────────────────────────────────────────

function spfFactors(spf: SpfResult): ScoringFactor[] {
  const factors: ScoringFactor[] = [];
  if (spf.record?.includes("~all")) {
    factors.push({
      protocol: "spf",
      label: "Uses ~all (softfail) — permissive policy",
      effect: -1,
    });
  }
  if (spf.lookups_used > 8) {
    factors.push({
      protocol: "spf",
      label: `${spf.lookups_used} DNS lookups (>8 is inefficient)`,
      effect: -1,
    });
  }
  if (spf.record?.includes("-all") && spf.lookups_used <= 5) {
    factors.push({
      protocol: "spf",
      label: "Uses -all with ≤5 lookups (efficient hardfail)",
      effect: +1,
    });
  }
  return factors;
}

function dkimFactors(dkim: DkimResult): ScoringFactor[] {
  const factors: ScoringFactor[] = [];
  const found = Object.entries(dkim.selectors).filter(([, s]) => s.found);
  const weakKeys = found.filter(([, s]) => s.key_bits && s.key_bits < 2048);
  if (weakKeys.length > 0) {
    const names = weakKeys.map(([n]) => n).join(", ");
    factors.push({
      protocol: "dkim",
      label: `Key under 2048 bits (${names})`,
      effect: -1,
    });
  }
  if (found.length >= 2) {
    factors.push({
      protocol: "dkim",
      label: `${found.length} selectors found (rotation ready)`,
      effect: +1,
    });
  }
  return factors;
}

function buildProtocolSummaries(
  protocols: Protocols,
): GradeBreakdown["protocolSummaries"] {
  const { dmarc, spf, dkim, bimi, mta_sts } = protocols;
  const dmarcPolicy = dmarc.tags?.p ?? null;
  const dkimFound = Object.values(dkim.selectors).filter((s) => s.found);

  return {
    dmarc: {
      status: dmarc.status,
      summary: dmarcPolicy ? `p=${dmarcPolicy}` : "Not configured",
    },
    spf: {
      status: spf.status,
      summary:
        spf.status === "fail"
          ? "Not configured"
          : `${spf.lookups_used}/${spf.lookup_limit} lookups, ${spf.record?.includes("-all") ? "-all" : "~all"}`,
    },
    dkim: {
      status: dkim.status,
      summary:
        dkim.status === "fail"
          ? "Not configured"
          : `${dkimFound.length} selector${dkimFound.length !== 1 ? "s" : ""}`,
    },
    bimi: {
      status: bimi.status,
      summary: bimi.status === "pass" ? "Record found" : "Not configured",
    },
    mta_sts: {
      status: mta_sts.status,
      summary:
        mta_sts.status === "pass"
          ? `mode=${mta_sts.policy?.mode ?? "unknown"}`
          : "Not configured",
    },
  };
}

function generateRecommendations(
  tier: string,
  protocols: Protocols,
): Recommendation[] {
  const { dmarc, spf, dkim, bimi, mta_sts } = protocols;
  const recs: Recommendation[] = [];
  const dmarcPolicy = dmarc.tags?.p?.toLowerCase() ?? null;
  const hasSpf = spf.status !== "fail";
  const hasDkim = dkim.status !== "fail";
  const hasBimi = bimi.status === "pass";
  const hasMtaSts = mta_sts.status === "pass";

  if (tier === "F") {
    if (!dmarcPolicy || dmarcPolicy === "none") {
      recs.push({
        priority: 1,
        protocol: "dmarc",
        title: "Add a DMARC policy with p=reject",
        description:
          "DMARC is the foundation of email security. Start with p=quarantine if you need to monitor first, then move to p=reject.",
        impact: "Required to move above F",
      });
    }
    return recs;
  }

  // D/D+ tier: missing SPF or DKIM
  if (tier === "D") {
    if (!hasSpf) {
      recs.push({
        priority: 1,
        protocol: "spf",
        title: "Add an SPF record",
        description:
          "SPF tells receiving servers which IPs are allowed to send mail for your domain.",
        impact: "Would raise grade to C tier",
      });
    }
    if (!hasDkim) {
      recs.push({
        priority: 1,
        protocol: "dkim",
        title: "Set up DKIM signing",
        description:
          "DKIM cryptographically signs outgoing mail, proving it hasn't been tampered with.",
        impact:
          dmarcPolicy === "reject"
            ? "Would raise grade to B tier"
            : "Would raise grade to C tier",
      });
    }
  }

  // C tier: upgrade policy
  if (tier === "C") {
    recs.push({
      priority: 1,
      protocol: "dmarc",
      title: "Upgrade DMARC policy from quarantine to reject",
      description:
        "p=reject tells receivers to drop unauthenticated mail entirely, providing the strongest protection against spoofing.",
      impact: "Would raise grade from C to B tier",
    });
  }

  // SPF improvements (B tier and above)
  if (hasSpf && spf.record?.includes("~all")) {
    recs.push({
      priority: 2,
      protocol: "spf",
      title: "Switch SPF from ~all to -all",
      description:
        "Softfail (~all) asks receivers to accept but flag unauthenticated mail. Hardfail (-all) tells them to reject it.",
      impact: "Removes a scoring penalty",
    });
  }
  if (hasSpf && spf.lookups_used > 8) {
    recs.push({
      priority: 2,
      protocol: "spf",
      title: "Reduce SPF DNS lookups",
      description: `Your SPF record uses ${spf.lookups_used} DNS lookups. Flatten includes or remove unused entries to reduce lookup count.`,
      impact: "Removes a scoring penalty",
    });
  }

  // DKIM improvements
  const foundSelectors = Object.entries(dkim.selectors).filter(
    ([, s]) => s.found,
  );
  const weakKeys = foundSelectors.filter(
    ([, s]) => s.key_bits && s.key_bits < 2048,
  );
  if (weakKeys.length > 0) {
    const names = weakKeys.map(([n]) => n).join(", ");
    recs.push({
      priority: 2,
      protocol: "dkim",
      title: `Upgrade DKIM key${weakKeys.length > 1 ? "s" : ""} to 2048 bits`,
      description: `The ${names} selector${weakKeys.length > 1 ? "s use" : " uses"} a key under 2048 bits. Rotate to a 2048-bit or larger key.`,
      impact: "Removes a scoring penalty",
    });
  }

  // MTA-STS testing mode
  if (hasMtaSts && mta_sts.policy?.mode === "testing") {
    recs.push({
      priority: 2,
      protocol: "mta_sts",
      title: "Switch MTA-STS from testing to enforce mode",
      description:
        "Testing mode reports TLS failures but doesn't enforce them. Switch to enforce for full protection.",
      impact: "Removes a scoring penalty",
    });
  }

  // Extras (BIMI / MTA-STS) — suggest if missing
  if (!hasBimi && (tier === "B" || tier === "A")) {
    recs.push({
      priority: 3,
      protocol: "bimi",
      title: "Add a BIMI record",
      description:
        "BIMI displays your brand logo in supporting email clients. Requires DMARC p=reject.",
      impact:
        tier === "A"
          ? "Required for A+"
          : "Adds a scoring bonus, path to A tier",
    });
  }
  if (!hasMtaSts && (tier === "B" || tier === "A")) {
    recs.push({
      priority: 3,
      protocol: "mta_sts",
      title: "Add MTA-STS",
      description:
        "MTA-STS enforces TLS encryption for inbound mail delivery, preventing downgrade attacks.",
      impact:
        tier === "A"
          ? "Required for A+"
          : "Adds a scoring bonus, path to A tier",
    });
  }

  // DKIM rotation
  if (hasDkim && foundSelectors.length < 2) {
    recs.push({
      priority: 3,
      protocol: "dkim",
      title: "Add a second DKIM selector",
      description:
        "Multiple selectors enable key rotation without downtime — publish a new key before retiring the old one.",
      impact: "Adds a scoring bonus",
    });
  }

  return recs;
}

export function computeGradeBreakdown(protocols: Protocols): GradeBreakdown {
  const grade = computeGrade(protocols);
  const { dmarc, spf, dkim, bimi, mta_sts } = protocols;
  const dmarcPolicy = dmarc.tags?.p?.toLowerCase() ?? null;
  const hasSpf = spf.status !== "fail";
  const hasDkim = dkim.status !== "fail";
  const hasBimi = bimi.status === "pass";
  const hasMtaSts = mta_sts.status === "pass";

  let tier: string;
  let tierReason: string;
  let modifier = 0;
  let factors: ScoringFactor[] = [];

  if (dmarc.status === "fail" || !dmarcPolicy || dmarcPolicy === "none") {
    tier = "F";
    tierReason = !dmarcPolicy
      ? "No DMARC record found"
      : dmarcPolicy === "none"
        ? "DMARC policy is set to none (no enforcement)"
        : "DMARC record failed validation";
  } else if (dmarcPolicy === "quarantine" && (!hasSpf || !hasDkim)) {
    tier = "D";
    tierReason = `p=quarantine but ${!hasSpf && !hasDkim ? "SPF and DKIM are" : !hasSpf ? "SPF is" : "DKIM is"} missing`;
  } else if (dmarcPolicy === "reject" && (!hasSpf || !hasDkim)) {
    tier = "D";
    tierReason = `p=reject but ${!hasSpf && !hasDkim ? "SPF and DKIM are" : !hasSpf ? "SPF is" : "DKIM is"} missing`;
  } else if (dmarcPolicy === "quarantine" && hasSpf && hasDkim) {
    tier = "C";
    tierReason = "p=quarantine with SPF and DKIM passing";
    factors = [...spfFactors(spf), ...dkimFactors(dkim)];
    modifier = factors.reduce((sum, f) => sum + f.effect, 0);
  } else if (dmarcPolicy === "reject" && hasSpf && hasDkim) {
    const spfStrong =
      spf.record?.includes("-all") && spf.lookups_used <= spf.lookup_limit;
    const hasExtras = hasBimi || hasMtaSts;

    if (spfStrong && hasDkim && hasExtras) {
      if (hasBimi && hasMtaSts) {
        tier = "A+";
        tierReason =
          "p=reject with strong SPF, DKIM, BIMI, and MTA-STS — perfect score";
        factors = [...spfFactors(spf), ...dkimFactors(dkim)];
        modifier = 0;
      } else {
        tier = "A";
        tierReason =
          "p=reject with strong SPF, DKIM, and " +
          (hasBimi ? "BIMI" : "MTA-STS");
        factors = [...spfFactors(spf), ...dkimFactors(dkim)];
        if (mta_sts.policy?.mode === "testing") {
          factors.push({
            protocol: "mta_sts",
            label: "MTA-STS in testing mode (not enforcing)",
            effect: -1,
          });
        }
        modifier = factors.reduce((sum, f) => sum + f.effect, 0);
      }
    } else {
      tier = "B";
      tierReason = "p=reject with SPF and DKIM passing";
      factors = [...spfFactors(spf), ...dkimFactors(dkim)];
      if (hasExtras) {
        factors.push({
          protocol: hasBimi ? "bimi" : "mta_sts",
          label: `${hasBimi ? "BIMI" : "MTA-STS"} configured`,
          effect: +1,
        });
      }
      modifier = factors.reduce((sum, f) => sum + f.effect, 0);
    }
  } else {
    tier = "C";
    tierReason = "Fallback — quarantine-level enforcement";
    factors = [...spfFactors(spf), ...dkimFactors(dkim)];
    modifier = factors.reduce((sum, f) => sum + f.effect, 0);
  }

  const modifierLabel = modifier >= 1 ? "+" : modifier <= -1 ? "−" : "";
  const recommendations = generateRecommendations(tier, protocols);
  const protocolSummaries = buildProtocolSummaries(protocols);

  return {
    grade,
    tier,
    tierReason,
    modifier,
    modifierLabel,
    factors,
    recommendations,
    protocolSummaries,
  };
}
