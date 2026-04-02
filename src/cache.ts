import type { ScanResult } from "./analyzers/types.js";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const GRADE_CACHE_TTL_SECONDS = 3600; // 1 hour

const ALL_GRADES = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
] as const;

export interface GradeExample {
  domain: string;
  timestamp: string;
}

function gradeKey(grade: string): Request {
  return new Request(
    `https://dmarc-mx-cache.internal/_grade/${encodeURIComponent(grade)}`,
  );
}

function cacheKey(domain: string, selectors: string[]): Request {
  const sorted = [...selectors].sort().join(",");
  const url = `https://dmarc-mx-cache.internal/${domain}?s=${sorted}`;
  return new Request(url);
}

export async function getCachedScan(
  domain: string,
  selectors: string[],
): Promise<ScanResult | null> {
  try {
    if (typeof caches === "undefined" || !caches.default) return null;
    const cache = caches.default;
    const resp = await cache.match(cacheKey(domain, selectors));
    if (!resp) return null;
    return (await resp.json()) as ScanResult;
  } catch {
    return null;
  }
}

export async function setCachedScan(
  domain: string,
  selectors: string[],
  result: ScanResult,
): Promise<void> {
  try {
    if (typeof caches === "undefined" || !caches.default) return;
    const cache = caches.default;
    const resp = new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=${CACHE_TTL_SECONDS}`,
      },
    });
    await cache.put(cacheKey(domain, selectors), resp);
    // Fire-and-forget: track last domain per grade
    setLastDomainForGrade(result.grade, domain);
  } catch {
    // Cache write failure is non-fatal
  }
}

async function setLastDomainForGrade(
  grade: string,
  domain: string,
): Promise<void> {
  try {
    if (typeof caches === "undefined" || !caches.default) return;
    const cache = caches.default;
    const body: GradeExample = {
      domain,
      timestamp: new Date().toISOString(),
    };
    const resp = new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=${GRADE_CACHE_TTL_SECONDS}`,
      },
    });
    await cache.put(gradeKey(grade), resp);
  } catch {
    // Non-fatal
  }
}

export async function getAllGradeExamples(): Promise<
  Record<string, GradeExample | null>
> {
  const result: Record<string, GradeExample | null> = {};
  try {
    if (typeof caches === "undefined" || !caches.default) {
      for (const g of ALL_GRADES) result[g] = null;
      return result;
    }
    const cache = caches.default;
    const entries = await Promise.all(
      ALL_GRADES.map(async (grade) => {
        const resp = await cache.match(gradeKey(grade));
        if (!resp) return [grade, null] as const;
        const data = (await resp.json()) as GradeExample;
        return [grade, data] as const;
      }),
    );
    for (const [grade, data] of entries) {
      result[grade] = data;
    }
  } catch {
    for (const g of ALL_GRADES) result[g] = null;
  }
  return result;
}
