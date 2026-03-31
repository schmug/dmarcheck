import dns from "node:dns";
import type { TxtRecord, MxRecord } from "./types.js";

const resolver = new dns.promises.Resolver();

export async function queryTxt(name: string): Promise<TxtRecord | null> {
  try {
    const records = await resolver.resolveTxt(name);
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
  try {
    const records = await resolver.resolveMx(name);
    return records.map((r) => ({ priority: r.priority, exchange: r.exchange }));
  } catch (err: unknown) {
    if (isDnsNotFound(err)) return null;
    throw err;
  }
}

function isDnsNotFound(err: unknown): boolean {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: string }).code;
    return code === "ENOTFOUND" || code === "ENODATA" || code === "ESERVFAIL";
  }
  return false;
}
