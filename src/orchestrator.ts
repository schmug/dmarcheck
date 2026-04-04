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
  // Bolt Optimization: Kicking off independent DNS lookups immediately to maximize concurrency.
  // Previously, lookups waited for MX analysis to complete sequentially.
  // Expected impact: Reduces overall scan latency by overlapping I/O bound tasks.
  const mxPromise = analyzeMx(domain);
  const dmarcPromise = analyzeDmarc(domain);
  const spfPromise = analyzeSpf(domain);
  const mtaStsPromise = analyzeMtaSts(domain);

  // Dependent lookups are chained directly to their specific prerequisites
  const dkimPromise = mxPromise.then((mxResult) => {
    const providerNames = mxResult.providers.map((p) => p.name);
    return analyzeDkim(domain, customSelectors, providerNames);
  });

  const bimiPromise = dmarcPromise.then((dmarcResult) => {
    const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
    return analyzeBimi(domain, dmarcPolicy);
  });

  const [
    mxResult,
    dmarcResult,
    spfResult,
    dkimResult,
    bimiResult,
    mtaStsResult,
  ] = await Promise.all([
    mxPromise,
    dmarcPromise,
    spfPromise,
    dkimPromise,
    bimiPromise,
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

export async function scanStreaming(
  domain: string,
  customSelectors: string[],
  onResult: (id: ProtocolId, result: ProtocolResult) => void,
): Promise<ScanResult> {
  // Bolt Optimization: Maximize concurrency by starting independent lookups immediately
  // and streaming results as soon as they resolve via .then() handlers.
  const mxPromise = analyzeMx(domain);
  const dmarcPromise = analyzeDmarc(domain);
  const spfPromise = analyzeSpf(domain);
  const mtaStsPromise = analyzeMtaSts(domain);

  mxPromise.then((r) => onResult("mx", r));
  dmarcPromise.then((r) => onResult("dmarc", r));
  spfPromise.then((r) => onResult("spf", r));
  mtaStsPromise.then((r) => onResult("mta_sts", r));

  const dkimPromise = mxPromise.then((mxResult) => {
    const providerNames = mxResult.providers.map((p) => p.name);
    return analyzeDkim(domain, customSelectors, providerNames).then((r) => {
      onResult("dkim", r);
      return r;
    });
  });

  const bimiPromise = dmarcPromise.then((dmarcResult) => {
    const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
    return analyzeBimi(domain, dmarcPolicy).then((r) => {
      onResult("bimi", r);
      return r;
    });
  });

  const [
    mxResult,
    dmarcResult,
    spfResult,
    dkimResult,
    bimiResult,
    mtaStsResult,
  ] = await Promise.all([
    mxPromise,
    dmarcPromise,
    spfPromise,
    dkimPromise,
    bimiPromise,
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
