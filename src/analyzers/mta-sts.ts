import { queryTxt } from "../dns/client.js";
import type { MtaStsResult, MtaStsPolicy, Validation } from "./types.js";

export async function analyzeMtaSts(domain: string): Promise<MtaStsResult> {
  const [dnsResult, policyResult] = await Promise.allSettled([
    queryTxt(`_mta-sts.${domain}`),
    fetchPolicy(domain),
  ]);

  const txt =
    dnsResult.status === "fulfilled" ? dnsResult.value : null;
  const policy =
    policyResult.status === "fulfilled" ? policyResult.value : null;

  const validations: Validation[] = [];

  // DNS record check
  let dnsRecord: string | null = null;
  if (txt) {
    const stsRecord = txt.entries.find((e) => e.includes("v=STSv1"));
    if (stsRecord) {
      dnsRecord = stsRecord;
      validations.push({
        status: "pass",
        message: "MTA-STS DNS record found (v=STSv1)",
      });
    } else {
      validations.push({
        status: "fail",
        message: "TXT record exists but missing v=STSv1",
      });
    }
  } else {
    validations.push({
      status: "fail",
      message: `No _mta-sts TXT record found`,
    });
  }

  // Policy file check
  if (policy) {
    validations.push({
      status: "pass",
      message: `Policy file fetched from https://mta-sts.${domain}/.well-known/mta-sts.txt`,
    });

    if (policy.mode === "enforce") {
      validations.push({
        status: "pass",
        message: "Policy mode is enforce (full protection)",
      });
    } else if (policy.mode === "testing") {
      validations.push({
        status: "warn",
        message: "Policy mode is testing (reports only, not enforced)",
      });
    } else if (policy.mode === "none") {
      validations.push({
        status: "warn",
        message: "Policy mode is none (MTA-STS effectively disabled)",
      });
    }

    if (policy.max_age < 86400) {
      validations.push({
        status: "warn",
        message: `max_age is ${policy.max_age}s (less than 1 day) — consider increasing`,
      });
    }

    if (policy.mx.length === 0) {
      validations.push({
        status: "warn",
        message: "No MX patterns specified in policy",
      });
    }
  } else {
    validations.push({
      status: "fail",
      message: `Policy file not accessible at https://mta-sts.${domain}/.well-known/mta-sts.txt`,
    });
  }

  const hasFailure = validations.some((v) => v.status === "fail");
  const hasWarn = validations.some((v) => v.status === "warn");
  const status = hasFailure ? "fail" : hasWarn ? "warn" : "pass";

  return { status, dns_record: dnsRecord, policy, validations };
}

async function fetchPolicy(domain: string): Promise<MtaStsPolicy | null> {
  try {
    const url = `https://mta-sts.${domain}/.well-known/mta-sts.txt`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "dmarcheck/1.0" },
      redirect: "follow",
    });

    if (!resp.ok) return null;

    const text = await resp.text();
    return parsePolicy(text);
  } catch {
    return null;
  }
}

function parsePolicy(text: string): MtaStsPolicy {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let version = "";
  let mode = "";
  const mx: string[] = [];
  let maxAge = 0;

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case "version":
        version = value;
        break;
      case "mode":
        mode = value;
        break;
      case "mx":
        mx.push(value);
        break;
      case "max_age":
        maxAge = parseInt(value, 10) || 0;
        break;
    }
  }

  return { version, mode, mx, max_age: maxAge };
}
