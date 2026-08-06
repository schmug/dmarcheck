#!/usr/bin/env bash
# Create the factory's label state machine. Idempotent — safe to re-run.
# Source: shipofclaudius .factory/templates/setup-labels.sh
#
#   ./.factory/setup-labels.sh [owner/repo]
#
# The label set IS the state machine (design spec §5). The driver is stateless: each run reads
# labels, advances at most one transition, and writes them back — which is what makes the loop
# restartable, inspectable, and interruptible at every transition.
set -euo pipefail

REPO="${1:-}"
ARGS=()
[ -n "$REPO" ] && ARGS=(--repo "$REPO")

# name|colour|description
LABELS=(
  "factory|0e8a16|Opted into the autonomous factory pipeline"
  "needs-repro|fbca04|Factory: awaiting a reproduction"
  "repro-ok|c2e0c6|Factory: reproduced — a fixture fails on the base"
  "repro-failed|d93f0b|Factory: could NOT reproduce; needs a human"
  "diagnosed|1d76db|Factory: root cause identified and independently verified"
  "not-a-bug|ededed|Factory: verified as intended behaviour, not a defect"
  "fix-proposed|5319e7|Factory: a draft PR with a fix is open"
  "fix-verified|0e8a16|TRUST TOKEN — a human confirmed the fix. The ONLY thing that unlocks the merge gate"
  "needs-you|b60205|Escalated: the factory will not touch this"
  "pipeline-paused|000000|KILL SWITCH — pauses the entire factory, checked first on every run"
)

for entry in "${LABELS[@]}"; do
  IFS='|' read -r name colour desc <<< "$entry"
  if gh label create "$name" --color "$colour" --description "$desc" "${ARGS[@]+"${ARGS[@]}"}" 2>/dev/null; then
    echo "created  $name"
  else
    gh label edit "$name" --color "$colour" --description "$desc" "${ARGS[@]+"${ARGS[@]}"}" >/dev/null
    echo "updated  $name"
  fi
done

echo
echo "Done. Two labels are load-bearing and human-only:"
echo "  fix-verified     — the trust token. Apply it ONLY after reviewing the draft PR and its preview."
echo "  pipeline-paused  — the kill switch. Apply it to any open issue to halt the whole factory."
