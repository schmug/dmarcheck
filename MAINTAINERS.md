# Maintainers

This file lists the people responsible for dmarcheck and the policy for how
that responsibility is granted and removed. It satisfies the project-governance
expectations of the OSPS Baseline (GV-01, GV-04).

## Current maintainers

| Handle | Role | Scope | Contact |
|--------|------|-------|---------|
| [@schmug](https://github.com/schmug) | Maintainer | Full: write access, releases, secrets, security disclosures | via [GitHub profile](https://github.com/schmug) / [SECURITY.md](SECURITY.md) |

dmarcheck is currently maintained by a single person in their spare time.

## Roles

- **Maintainer** — write access to the repository, authority to merge and
  release, holds deployment/billing secrets, and is the named code owner in
  [`.github/CODEOWNERS`](.github/CODEOWNERS). Maintainers are the approvers for
  security-sensitive PRs.
- **Triager** *(none today; defined for future growth)* — triage access:
  label, assign, and close issues/PRs, but no merge or release authority.

## Automation identity

Autonomous [Claude Code Routines](docs/routine-pipeline.md) open and merge
routine PRs unattended. Today those commits are authored by **@schmug** because
the routines run with the maintainer's credentials. The
[`CODEOWNERS`](.github/CODEOWNERS) human-review gate is already **enforcing**,
not advisory: the `main-protection` ruleset (ID
[14716629](https://github.com/schmug/dmarcheck/rulesets/14716629)) has
`enforcement: active`, `require_code_owner_review: true`, and an empty
`bypass_actors` list, so there is no admin bypass. What
[#299](https://github.com/schmug/dmarcheck/issues/299) tracks is splitting
routine commits onto a dedicated non-admin `dmarcheck-bot` identity to close a
*self-approval* gap, not an enforcement gap: GitHub forbids self-approval, so
a gated PR authored as **@schmug** still needs a genuinely different code
owner to approve it by hand before it can merge. See
[docs/OSPS-DEVIATIONS.md](docs/OSPS-DEVIATIONS.md) for the full rationale and
compensating controls.

## Becoming a maintainer

There is no formal nomination process yet given the project's size. A
contributor with a sustained track record of quality PRs and issue triage may
be invited by an existing maintainer to take a Triager or Maintainer role.
Maintainership requires the ability to be reached for security disclosures.

## Removing a maintainer

A maintainer may step down at any time by opening a PR removing themselves from
this file. A maintainer may be removed by consensus of the remaining
maintainers for inactivity (no activity for ~6 months) or for conduct that
undermines the project. When a maintainer is removed, their write access,
secret access, and CODEOWNERS entries are revoked in the same change.

## Security and review policy

- Vulnerability reports follow [SECURITY.md](SECURITY.md) (private disclosure).
- The human-review gate for security-sensitive paths is defined in
  [`.github/CODEOWNERS`](.github/CODEOWNERS) and enforced by the
  `main-protection` ruleset.
- The contribution workflow is in [CONTRIBUTING.md](CONTRIBUTING.md).
