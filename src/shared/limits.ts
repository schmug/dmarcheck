// Watchlist (domain monitoring) caps per plan tier. Keep these in sync with
// the public copy on /pricing and the README — the original launch bug was
// that we advertised "up to 25 domains" but the code never enforced it.
//
// Existing accounts already over the cap are grandfathered: their rows
// remain, but POST /domain/add and processBulkScan refuse net-new adds when
// the user's current count is already >= cap.

import type { PlanTier } from "../db/subscriptions.js";

export const FREE_WATCHLIST_CAP = 3;
export const PRO_WATCHLIST_CAP = 25;

export function getWatchlistCap(plan: PlanTier): number {
  return plan === "pro" ? PRO_WATCHLIST_CAP : FREE_WATCHLIST_CAP;
}
