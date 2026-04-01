import { analyzeBimi } from "./analyzers/bimi.js";
import { analyzeDkim } from "./analyzers/dkim.js";
import { analyzeDmarc } from "./analyzers/dmarc.js";
import { analyzeMtaSts } from "./analyzers/mta-sts.js";
import { analyzeSpf } from "./analyzers/spf.js";
import type {
  BimiResult,
  DkimResult,
  DmarcResult,
  MtaStsResult,
  ScanResult,
  SpfResult,
} from "./analyzers/types.js";
import { computeGradeBreakdown } from "./shared/scoring.js";

export type ProtocolId = "dmarc" | "spf" | "dkim" | "bimi" | "mta_sts";
export type ProtocolResult =
  | DmarcResult
  | SpfResult
  | DkimResult
  | BimiResult
  | MtaStsResult;

function buildScanResult(
  domain: string,
  protocols: ScanResult["protocols"],
): ScanResult {
  const breakdown = computeGradeBreakdown(protocols);
  const dkimFound = Object.values(protocols.dkim.selectors).filter(
    (s) => s.found,
  ).length;
  const dmarcPolicy = protocols.dmarc.tags?.p?.toLowerCase() ?? null;

  return {
    domain,
    timestamp: new Date().toISOString(),
    grade: breakdown.grade,
    breakdown,
    summary: {
      dmarc_policy: dmarcPolicy,
      spf_result: protocols.spf.status,
      spf_lookups: `${protocols.spf.lookups_used}/${protocols.spf.lookup_limit}`,
      dkim_selectors_found: dkimFound,
      bimi_enabled: protocols.bimi.status === "pass",
      mta_sts_mode: protocols.mta_sts.policy?.mode ?? null,
    },
    protocols,
  };
}

export async function scan(
  domain: string,
  customSelectors: string[] = [],
): Promise<ScanResult> {
  const [dmarcResult, spfResult, dkimResult, mtaStsResult] = await Promise.all([
    analyzeDmarc(domain),
    analyzeSpf(domain),
    analyzeDkim(domain, customSelectors),
    analyzeMtaSts(domain),
  ]);

  const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
  const bimiResult = await analyzeBimi(domain, dmarcPolicy);

  return buildScanResult(domain, {
    dmarc: dmarcResult,
    spf: spfResult,
    dkim: dkimResult,
    bimi: bimiResult,
    mta_sts: mtaStsResult,
  });
}

export async function scanStreaming(
  domain: string,
  customSelectors: string[],
  onResult: (id: ProtocolId, result: ProtocolResult) => void,
): Promise<ScanResult> {
  // Start all 4 core analyzers in parallel
  const dmarcPromise = analyzeDmarc(domain);
  const spfPromise = analyzeSpf(domain);
  const dkimPromise = analyzeDkim(domain, customSelectors);
  const mtaStsPromise = analyzeMtaSts(domain);

  // Stream SPF, DKIM, MTA-STS as each resolves
  spfPromise.then((r) => onResult("spf", r));
  dkimPromise.then((r) => onResult("dkim", r));
  mtaStsPromise.then((r) => onResult("mta_sts", r));

  // BIMI depends on DMARC policy — stream DMARC first, then BIMI
  const dmarcResult = await dmarcPromise;
  onResult("dmarc", dmarcResult);

  const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
  const bimiResult = await analyzeBimi(domain, dmarcPolicy);
  onResult("bimi", bimiResult);

  // Wait for remaining analyzers
  const [spfResult, dkimResult, mtaStsResult] = await Promise.all([
    spfPromise,
    dkimPromise,
    mtaStsPromise,
  ]);

  return buildScanResult(domain, {
    dmarc: dmarcResult,
    spf: spfResult,
    dkim: dkimResult,
    bimi: bimiResult,
    mta_sts: mtaStsResult,
  });
}
