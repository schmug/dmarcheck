import { queryTxt } from "../dns/client.js";
import type { SpfIncludeNode, SpfResult, Validation } from "./types.js";

const MAX_LOOKUPS = 10;

export async function analyzeSpf(domain: string): Promise<SpfResult> {
  const ctx: ResolutionContext = { lookups: 0 };
  const tree = await resolveSpfTree(domain, ctx, 0);

  if (!tree?.record) {
    return {
      status: "fail",
      record: null,
      lookups_used: 0,
      lookup_limit: MAX_LOOKUPS,
      include_tree: null,
      validations: [{ status: "fail", message: "No SPF record found" }],
    };
  }

  const validations: Validation[] = [];
  validations.push({ status: "pass", message: "SPF record found" });

  // Lookup limit check
  if (ctx.lookups <= MAX_LOOKUPS) {
    validations.push({
      status: "pass",
      message: `Within 10-lookup limit (${ctx.lookups} used)`,
    });
  } else {
    validations.push({
      status: "fail",
      message: `Exceeds 10-lookup limit (${ctx.lookups} used) — SPF will permerror`,
    });
  }

  // all mechanism check
  const allMech = tree.mechanisms.find((m) => m.endsWith("all"));
  if (allMech) {
    if (allMech === "-all") {
      validations.push({
        status: "pass",
        message: "Uses -all (hardfail) for strict enforcement",
      });
    } else if (allMech === "~all") {
      validations.push({
        status: "warn",
        message: "Uses ~all (softfail) — consider -all for strict enforcement",
      });
    } else if (allMech === "+all" || allMech === "all") {
      validations.push({
        status: "fail",
        message: "Uses +all — allows any sender, effectively no protection",
      });
    } else if (allMech === "?all") {
      validations.push({
        status: "warn",
        message: "Uses ?all (neutral) — provides no guidance to receivers",
      });
    }
  }

  // Deprecated ptr check
  const hasPtr = tree.mechanisms.some(
    (m) => m === "ptr" || m.startsWith("ptr:"),
  );
  if (hasPtr) {
    validations.push({
      status: "warn",
      message: "Uses deprecated ptr mechanism (RFC 7208 recommends against it)",
    });
  } else {
    validations.push({
      status: "pass",
      message: "No deprecated ptr mechanism",
    });
  }

  const hasFailure = validations.some((v) => v.status === "fail");
  const hasWarn = validations.some((v) => v.status === "warn");
  const status = hasFailure ? "fail" : hasWarn ? "warn" : "pass";

  return {
    status,
    record: tree.record,
    lookups_used: ctx.lookups,
    lookup_limit: MAX_LOOKUPS,
    include_tree: tree,
    validations,
  };
}

interface ResolutionContext {
  lookups: number;
}

async function resolveSpfTree(
  domain: string,
  ctx: ResolutionContext,
  depth: number,
): Promise<SpfIncludeNode | null> {
  if (depth > 10) return null; // Prevent infinite recursion

  const txt = await queryTxt(domain);
  if (!txt) return null;

  const spfRecord = txt.entries.find(
    (e) => e.trimStart().startsWith("v=spf1 ") || e.trim() === "v=spf1",
  );
  if (!spfRecord) return null;

  const mechanisms = parseSpfMechanisms(spfRecord);
  const includes: SpfIncludeNode[] = [];

  // Find include targets and redirect
  const includeTargets: string[] = [];
  let redirect: string | null = null;

  for (const mech of mechanisms) {
    const bare = mech.replace(/^[+\-~?]/, "");
    if (bare.startsWith("include:")) {
      ctx.lookups++;
      includeTargets.push(bare.slice("include:".length));
    } else if (bare.startsWith("redirect=")) {
      ctx.lookups++;
      redirect = bare.slice("redirect=".length);
    } else if (bare.startsWith("a:") || bare === "a") {
      ctx.lookups++;
    } else if (bare.startsWith("mx:") || bare === "mx") {
      ctx.lookups++;
    } else if (bare.startsWith("ptr:") || bare === "ptr") {
      ctx.lookups++;
    } else if (bare.startsWith("exists:")) {
      ctx.lookups++;
    }
  }

  // Resolve includes in parallel
  const resolved = await Promise.allSettled(
    includeTargets.map((target) => resolveSpfTree(target, ctx, depth + 1)),
  );

  for (const result of resolved) {
    if (result.status === "fulfilled" && result.value) {
      includes.push(result.value);
    }
  }

  // Handle redirect (processed after all mechanisms)
  if (redirect) {
    const redirectNode = await resolveSpfTree(redirect, ctx, depth + 1);
    if (redirectNode) {
      includes.push(redirectNode);
    }
  }

  return { domain, record: spfRecord, mechanisms, includes };
}

function parseSpfMechanisms(record: string): string[] {
  return record
    .replace(/^v=spf1\s*/, "")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}
