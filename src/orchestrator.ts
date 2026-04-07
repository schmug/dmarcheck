import * as Sentry from "@sentry/cloudflare";
import { analyzeBimi, prefetchBimiDns } from "./analyzers/bimi.js";
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
  // Fire all independent DNS queries immediately
  const dmarcPromise = analyzeDmarc(domain);
  const spfPromise = analyzeSpf(domain);
  const mtaStsPromise = analyzeMtaSts(domain);
  const bimiDnsPromise = prefetchBimiDns(domain);
  const mxPromise = analyzeMx(domain);

  // Chain DKIM off MX so it starts as soon as MX resolves
  // without blocking on unrelated queries
  const dkimPromise = mxPromise.then((mxResult) => {
    Sentry.addBreadcrumb({
      category: "analyzer.complete",
      message: `mx: ${mxResult.status}`,
      data: { protocol: "mx", status: mxResult.status },
      level: "info",
    });
    const providerNames = mxResult.providers.map((p) => p.name);
    return analyzeDkim(domain, customSelectors, providerNames);
  });

  // Optimize: Chain BIMI off DMARC and prefetch so it runs concurrently with other scans
  const bimiPromise = Promise.all([dmarcPromise, bimiDnsPromise]).then(
    async ([dmarcResult, bimiDns]) => {
      const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
      const bimiResult = await analyzeBimi(domain, dmarcPolicy, bimiDns);
      Sentry.addBreadcrumb({
        category: "analyzer.complete",
        message: `bimi: ${bimiResult.status}`,
        data: { protocol: "bimi", status: bimiResult.status },
        level: "info",
      });
      return bimiResult;
    },
  );

  const [
    dmarcResult,
    spfResult,
    dkimResult,
    mtaStsResult,
    bimiResult,
    mxResult,
  ] = await Promise.all([
    dmarcPromise,
    spfPromise,
    dkimPromise,
    mtaStsPromise,
    bimiPromise,
    mxPromise,
  ]);

  Sentry.addBreadcrumb({
    category: "analyzer.complete",
    message: `dmarc: ${dmarcResult.status}`,
    data: { protocol: "dmarc", status: dmarcResult.status },
    level: "info",
  });
  Sentry.addBreadcrumb({
    category: "analyzer.complete",
    message: `spf: ${spfResult.status}`,
    data: { protocol: "spf", status: spfResult.status },
    level: "info",
  });
  Sentry.addBreadcrumb({
    category: "analyzer.complete",
    message: `dkim: ${dkimResult.status}`,
    data: { protocol: "dkim", status: dkimResult.status },
    level: "info",
  });
  Sentry.addBreadcrumb({
    category: "analyzer.complete",
    message: `mta_sts: ${mtaStsResult.status}`,
    data: { protocol: "mta_sts", status: mtaStsResult.status },
    level: "info",
  });

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
  const bimiDnsPromise = prefetchBimiDns(domain);
  const mxPromise = analyzeMx(domain);

  mxPromise.then((mxResult) => {
    Sentry.addBreadcrumb({
      category: "analyzer.complete",
      message: `mx: ${mxResult.status}`,
      data: { protocol: "mx", status: mxResult.status },
      level: "info",
    });
    onResult("mx", mxResult);
  });

  // Start DKIM query after MX resolution provides email provider names
  const dkimPromise = mxPromise.then((mxResult) => {
    const providerNames = mxResult.providers.map((p) => p.name);
    return analyzeDkim(domain, customSelectors, providerNames);
  });

  spfPromise.then((r) => {
    Sentry.addBreadcrumb({
      category: "analyzer.complete",
      message: `spf: ${r.status}`,
      data: { protocol: "spf", status: r.status },
      level: "info",
    });
    onResult("spf", r);
  });
  dkimPromise.then((r) => {
    Sentry.addBreadcrumb({
      category: "analyzer.complete",
      message: `dkim: ${r.status}`,
      data: { protocol: "dkim", status: r.status },
      level: "info",
    });
    onResult("dkim", r);
  });
  mtaStsPromise.then((r) => {
    Sentry.addBreadcrumb({
      category: "analyzer.complete",
      message: `mta_sts: ${r.status}`,
      data: { protocol: "mta_sts", status: r.status },
      level: "info",
    });
    onResult("mta_sts", r);
  });

  dmarcPromise.then((r) => {
    Sentry.addBreadcrumb({
      category: "analyzer.complete",
      message: `dmarc: ${r.status}`,
      data: { protocol: "dmarc", status: r.status },
      level: "info",
    });
    onResult("dmarc", r);
  });

  // Optimize: Chain BIMI off DMARC and prefetch so it streams independently
  const bimiPromise = Promise.all([dmarcPromise, bimiDnsPromise]).then(
    async ([dmarcResult, bimiDns]) => {
      const dmarcPolicy = dmarcResult.tags?.p?.toLowerCase() ?? null;
      const bimiResult = await analyzeBimi(domain, dmarcPolicy, bimiDns);
      Sentry.addBreadcrumb({
        category: "analyzer.complete",
        message: `bimi: ${bimiResult.status}`,
        data: { protocol: "bimi", status: bimiResult.status },
        level: "info",
      });
      onResult("bimi", bimiResult);
      return bimiResult;
    },
  );

  const [
    dmarcResult,
    spfResult,
    dkimResult,
    mtaStsResult,
    bimiResult,
    mxResult,
  ] = await Promise.all([
    dmarcPromise,
    spfPromise,
    dkimPromise,
    mtaStsPromise,
    bimiPromise,
    mxPromise,
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
