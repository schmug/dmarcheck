import { analyzeDmarc } from "./analyzers/dmarc.js";
import { analyzeSpf } from "./analyzers/spf.js";
import { analyzeDkim } from "./analyzers/dkim.js";
import { analyzeBimi } from "./analyzers/bimi.js";
import { analyzeMtaSts } from "./analyzers/mta-sts.js";
import { computeGrade } from "./shared/scoring.js";
import type { ScanResult } from "./analyzers/types.js";

export async function scan(
  domain: string,
  customSelectors: string[] = [],
): Promise<ScanResult> {
  // Run core analyzers in parallel, then BIMI sequentially since it needs the DMARC policy
  const [dmarcResult, spfResult, dkimResult, mtaStsResult] =
    await Promise.all([
      analyzeDmarc(domain),
      analyzeSpf(domain),
      analyzeDkim(domain, customSelectors),
      analyzeMtaSts(domain),
    ]);

  // BIMI needs the DMARC policy for cross-checking
  const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
  const bimiResult = await analyzeBimi(domain, dmarcPolicy);

  const protocols = {
    dmarc: dmarcResult,
    spf: spfResult,
    dkim: dkimResult,
    bimi: bimiResult,
    mta_sts: mtaStsResult,
  };

  const grade = computeGrade(protocols);

  const dkimFound = Object.values(dkimResult.selectors).filter(
    (s) => s.found,
  ).length;

  return {
    domain,
    timestamp: new Date().toISOString(),
    grade,
    summary: {
      dmarc_policy: dmarcPolicy,
      spf_result: spfResult.status,
      spf_lookups: `${spfResult.lookups_used}/${spfResult.lookup_limit}`,
      dkim_selectors_found: dkimFound,
      bimi_enabled: bimiResult.status === "pass",
      mta_sts_mode: mtaStsResult.policy?.mode ?? null,
    },
    protocols,
  };
}
