import dns from "node:dns";
import type { TxtRecord, MxRecord } from "./types.js";

const resolver = new dns.promises.Resolver();

export async function queryTxt(name: string): Promise<TxtRecord | null> {
  try {
    const records = await resolver.resolveTxt(name);
    const entries = records.map((chunks) => chunks.join(""));
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
