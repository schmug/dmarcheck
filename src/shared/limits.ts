import type { PlanTier } from "../db/subscriptions.js";

// Domain caps for the watchlist. The free cap is set low enough to drive
// the upgrade path while still letting a new user feel out the dashboard
// with real data; the Pro cap matches the figure advertised on /pricing
// and in the README.
//
// Existing accounts that already exceed the cap (legacy power users from
// before enforcement landed) are grandfathered — they keep their domains
// but can't add new ones. The cap only constrains net-new additions.
export const FREE_WATCHLIST_CAP = 3;
export const PRO_WATCHLIST_CAP = 25;

export function watchlistCapForPlan(plan: PlanTier): number {
  return plan === "pro" ? PRO_WATCHLIST_CAP : FREE_WATCHLIST_CAP;
}
