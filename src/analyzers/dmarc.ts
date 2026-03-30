import { queryTxt } from "../dns/client.js";
import type { DmarcResult, Validation } from "./types.js";

export async function analyzeDmarc(domain: string): Promise<DmarcResult> {
  const txt = await queryTxt(`_dmarc.${domain}`);
  if (!txt) {
    return {
      status: "fail",
      record: null,
      tags: null,
      validations: [{ status: "fail", message: "No DMARC record found" }],
    };
  }

  const dmarcRecord = txt.entries.find((e) =>
    e.trimStart().startsWith("v=DMARC1"),
  );
  if (!dmarcRecord) {
    return {
      status: "fail",
      record: txt.raw,
      tags: null,
      validations: [
        { status: "fail", message: "TXT record exists but is not a valid DMARC record" },
      ],
    };
  }

  const tags = parseTags(dmarcRecord);
  const validations: Validation[] = [];

  // v= check
  if (tags.v === "DMARC1") {
    validations.push({ status: "pass", message: "DMARC record found" });
  } else {
    validations.push({ status: "fail", message: "Invalid version tag" });
  }

  // p= check
  const policy = tags.p?.toLowerCase();
  if (!policy) {
    validations.push({ status: "fail", message: "Missing policy tag (p=)" });
  } else if (policy === "reject") {
    validations.push({
      status: "pass",
      message: "Policy is set to reject (strongest enforcement)",
    });
  } else if (policy === "quarantine") {
    validations.push({
      status: "warn",
      message: "Policy is set to quarantine (medium enforcement)",
    });
  } else if (policy === "none") {
    validations.push({
      status: "fail",
      message: "Policy is set to none (monitoring only, no enforcement)",
    });
  }

  // sp= check
  if (tags.sp) {
    validations.push({
      status: "pass",
      message: "Subdomain policy explicitly set",
    });
  }

  // rua= check
  if (tags.rua) {
    validations.push({
      status: "pass",
      message: "Aggregate reporting (rua) configured",
    });
  } else {
    validations.push({
      status: "warn",
      message: "No aggregate reporting URI (rua) configured",
    });
  }

  // ruf= check
  if (tags.ruf) {
    validations.push({
      status: "pass",
      message: "Forensic reporting (ruf) configured",
    });
  }

  // pct check
  if (tags.pct && parseInt(tags.pct, 10) < 100) {
    validations.push({
      status: "warn",
      message: `Only ${tags.pct}% of messages are subject to the policy`,
    });
  }

  const hasFailure = validations.some((v) => v.status === "fail");
  const hasWarn = validations.some((v) => v.status === "warn");
  const status = hasFailure ? "fail" : hasWarn ? "warn" : "pass";

  return { status, record: dmarcRecord, tags, validations };
}

function parseTags(record: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of record.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim().toLowerCase();
    const value = trimmed.slice(eqIdx + 1).trim();
    tags[key] = value;
  }
  return tags;
}
