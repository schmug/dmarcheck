import dns from "node:dns";
import * as Sentry from "@sentry/cloudflare";
import type { MxRecord, TxtRecord } from "./types.js";

const resolver = new dns.promises.Resolver();
const DNS_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("DNS timeout")), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

export async function queryTxt(name: string): Promise<TxtRecord | null> {
  Sentry.addBreadcrumb({
    category: "dns.query",
    message: `TXT ${name}`,
    data: { type: "TXT", hostname: name },
    level: "info",
  });
  try {
    const records = await withTimeout(
      resolver.resolveTxt(name),
      DNS_TIMEOUT_MS,
    );
    // workerd's node:dns polyfill may join multi-part TXT chunks with literal
    // quote characters (e.g. 'part1" "part2') instead of splitting properly.
    // Strip these artifacts so downstream parsing sees a clean record.
    const entries = records.map((chunks) =>
      chunks.join("").replace(/"\s*"/g, ""),
    );
    return { entries, raw: entries.join(" ") };
  } catch (err: unknown) {
    if (isDnsNotFound(err)) return null;
    throw err;
  }
}

export async function queryMx(name: string): Promise<MxRecord[] | null> {
  Sentry.addBreadcrumb({
    category: "dns.query",
    message: `MX ${name}`,
    data: { type: "MX", hostname: name },
    level: "info",
  });
  try {
    const records = await withTimeout(resolver.resolveMx(name), DNS_TIMEOUT_MS);
    return records.map((r) => ({ priority: r.priority, exchange: r.exchange }));
  } catch (err: unknown) {
    if (isDnsNotFound(err)) return null;
    throw err;
  }
}

function isDnsNotFound(err: unknown): boolean {
  if (err instanceof Error && err.message === "DNS timeout") return true;
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: string }).code;
    return code === "ENOTFOUND" || code === "ENODATA" || code === "ESERVFAIL";
  }
  return false;
}
