import { DurableObject } from "cloudflare:workers";
import type { RateLimitResult } from "./rate-limit.js";

// Atomic per-identity rate-limit counter (GHSA-v7qc-7qh8-h69g).
//
// The previous limiter was a non-atomic read-modify-write on the Cache API
// (`match` → `count++` → `put`). The Cache API has no atomic increment/CAS, so
// a concurrent burst under one identity could all read the same stale count
// and each write `count + 1`, letting the effective ceiling exceed the
// configured limit. A Durable Object's single-threaded execution serializes
// the read-modify-write across isolates and colos, which is the canonical
// Workers primitive for an atomic counter.
//
// One DO instance per identity: callers route with `getByName("ip:<x>")` /
// `getByName("user:<id>")`, so each instance owns exactly one bucket (a single
// row). The whole `increment` body is synchronous SQL — it runs to completion
// without yielding, so overlapping RPCs cannot interleave their read and write.
//
// A singleton instance routed as `getByName("__nonces__")` also hosts the
// consumed-nonce store for account-deletion re-auth proofs (issue #553).
//
// Instances routed by the inbox identity (same `ip:<x>` / `user:<id>` name as
// the rate-limit bucket for that identity) additionally host the per-identity
// inbox live-token cap (`reserveLiveToken`, issue #618) in its own table —
// the prior KV read-modify-write was a TOCTOU: a concurrent burst could each
// read a pre-insert count below the cap and all reserve, exceeding it.
export class RateLimiterDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS bucket (
          id INTEGER PRIMARY KEY,
          count INTEGER NOT NULL,
          reset_at INTEGER NOT NULL
        )`,
      );
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS nonces (
          jti TEXT PRIMARY KEY,
          exp_sec INTEGER NOT NULL
        )`,
      );
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS live_tokens (
          token TEXT PRIMARY KEY,
          exp_ms INTEGER NOT NULL
        )`,
      );
    });
  }

  // Atomically increments this identity's counter for the current window and
  // returns the resulting decision. `limit`/`windowSec` are passed per call so
  // the same DO class serves both tiers (free 10/60, pro 60/3600) — the bucket
  // is keyed entirely by the DO instance (identity), not the window size.
  // `weight` lets a single request charge more than one token (e.g. bulk-scan
  // charging proportional to its in-band scan count, issue #619); defaults to
  // 1 so every other caller is unaffected.
  increment(limit: number, windowSec: number, weight = 1): RateLimitResult {
    const nowSec = Math.floor(Date.now() / 1000);
    const existing = this.ctx.storage.sql
      .exec<{ count: number; reset_at: number }>(
        "SELECT count, reset_at FROM bucket WHERE id = 1",
      )
      .toArray()[0];

    let count: number;
    let resetAt: number;
    if (existing && existing.reset_at > nowSec) {
      count = existing.count + weight;
      resetAt = existing.reset_at;
    } else {
      // Fresh window: no row yet, or the previous window has elapsed.
      count = weight;
      resetAt = nowSec + windowSec;
    }

    this.ctx.storage.sql.exec(
      `INSERT INTO bucket (id, count, reset_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET count = excluded.count, reset_at = excluded.reset_at`,
      count,
      resetAt,
    );

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      windowSec,
      resetAt,
      count,
    };
  }

  // Atomically reserves a live-token slot for the inbox per-identity cap
  // (issue #618). Prune-count-insert runs as one synchronous SQL sequence, so
  // a concurrent burst under one identity can't all observe a stale count
  // below `cap` and over-reserve — the same single-threaded-RPC guarantee
  // `increment` relies on.
  reserveLiveToken(
    token: string,
    ttlMs: number,
    cap: number,
    nowMs: number,
  ): boolean {
    this.ctx.storage.sql.exec(
      "DELETE FROM live_tokens WHERE exp_ms <= ?",
      nowMs,
    );
    const { count } = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) as count FROM live_tokens")
      .toArray()[0];
    if (count >= cap) return false;
    this.ctx.storage.sql.exec(
      "INSERT INTO live_tokens (token, exp_ms) VALUES (?, ?)",
      token,
      nowMs + ttlMs,
    );
    return true;
  }

  // Records a deletion-proof nonce on first presentation. Returns true if newly
  // recorded (first use), false if the jti was already consumed. Expired nonces
  // are pruned opportunistically. Routed via `getByName("__nonces__")` so the
  // single-threaded DO execution serializes concurrent replay attempts.
  consumeNonce(jti: string, expSec: number): boolean {
    const nowSec = Math.floor(Date.now() / 1000);
    this.ctx.storage.sql.exec("DELETE FROM nonces WHERE exp_sec < ?", nowSec);
    const result = this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO nonces (jti, exp_sec) VALUES (?, ?)",
      jti,
      expSec,
    );
    return result.rowsWritten === 1;
  }
}
