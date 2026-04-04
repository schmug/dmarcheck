import { analyzeBimi } from "./analyzers/bimi.js";
import { analyzeDkim } from "./analyzers/dkim.js";
import { analyzeDmarc } from "./analyzers/dmarc.js";
import { analyzeMtaSts } from "./analyzers/mta-sts.js";
import { analyzeMx } from "./analyzers/mx.js";
import { analyzeSpf } from "./analyzers/spf.js";
import type {
  BimiResult,
  DkimResult,
  DmarcResult,
  MtaStsResult,
  MxResult,
  ScanResult,
  SpfResult,
} from "./analyzers/types.js";
import { queryTxt } from "./dns/client.js";
import { computeGradeBreakdown } from "./shared/scoring.js";

export type ProtocolId = "mx" | "dmarc" | "spf" | "dkim" | "bimi" | "mta_sts";
export type ProtocolResult =
  | MxResult
  | DmarcResult
  | SpfResult
  | DkimResult
  | BimiResult
  | MtaStsResult;

async function buildScanResult(
  domain: string,
  protocols: ScanResult["protocols"],
): Promise<ScanResult> {
  const breakdown = computeGradeBreakdown(protocols);

  // Easter egg: S grade for A+ domains advertising dmarc.mx
  if (breakdown.grade === "A+") {
    try {
      const txt = await queryTxt(domain);
      if (txt?.entries.some((e) => e.toLowerCase().includes("dmarc.mx"))) {
        breakdown.grade = "S";
      }
    } catch {
      // Silently ignore — don't downgrade the experience for a DNS hiccup
    }
  }

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
      mx_records: protocols.mx.records.length,
      mx_providers: protocols.mx.providers.map((p) => p.name),
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
  // Start independent DNS queries immediately for better performance
  const dmarcPromise = analyzeDmarc(domain);
  const spfPromise = analyzeSpf(domain);
  const mtaStsPromise = analyzeMtaSts(domain);

  const mxResult = await analyzeMx(domain);
  const providerNames = mxResult.providers.map((p) => p.name);

  // Start DKIM query after MX resolution provides email provider names
  const dkimPromise = analyzeDkim(domain, customSelectors, providerNames);

  const [dmarcResult, spfResult, dkimResult, mtaStsResult] = await Promise.all([
    dmarcPromise,
    spfPromise,
    dkimPromise,
    mtaStsPromise,
  ]);

  const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
  const bimiResult = await analyzeBimi(domain, dmarcPolicy);

  return await buildScanResult(domain, {
    mx: mxResult,
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
  // Start independent DNS queries immediately for better performance
  const dmarcPromise = analyzeDmarc(domain);
  const spfPromise = analyzeSpf(domain);
  const mtaStsPromise = analyzeMtaSts(domain);

  const mxResult = await analyzeMx(domain);
  onResult("mx", mxResult);
  const providerNames = mxResult.providers.map((p) => p.name);

  // Start DKIM query after MX resolution provides email provider names
  const dkimPromise = analyzeDkim(domain, customSelectors, providerNames);

  spfPromise.then((r) => onResult("spf", r));
  dkimPromise.then((r) => onResult("dkim", r));
  mtaStsPromise.then((r) => onResult("mta_sts", r));

  const dmarcResult = await dmarcPromise;
  onResult("dmarc", dmarcResult);

  const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
  const bimiResult = await analyzeBimi(domain, dmarcPolicy);
  onResult("bimi", bimiResult);

  const [spfResult, dkimResult, mtaStsResult] = await Promise.all([
    spfPromise,
    dkimPromise,
    mtaStsPromise,
  ]);

  return await buildScanResult(domain, {
    mx: mxResult,
    dmarc: dmarcResult,
    spf: spfResult,
    dkim: dkimResult,
    bimi: bimiResult,
    mta_sts: mtaStsResult,
  });
}
