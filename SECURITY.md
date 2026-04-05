# Security Policy

Thanks for helping keep dmarcheck safe for everyone who uses it.

## Reporting a vulnerability

**Please do not open public GitHub issues for security problems.**

Report suspected vulnerabilities privately via
[GitHub's private vulnerability reporting](https://github.com/schmug/dmarcheck/security/advisories/new).
That creates a confidential advisory only the maintainer can see.

If you cannot use GitHub's private reporting, email the maintainer via the
contact listed on the [GitHub profile](https://github.com/schmug).

Please include:

- A clear description of the issue
- Steps to reproduce (a proof-of-concept URL or payload is ideal)
- The impact you believe the issue has
- Any suggested remediation, if you have one in mind

You can expect an initial acknowledgement within a few days. dmarcheck is
maintained by a single person in their spare time, so fix timelines depend on
severity and complexity — critical issues affecting the live service at
[dmarc.mx](https://dmarc.mx) are prioritised.

## Scope

In scope:

- The live service at [dmarc.mx](https://dmarc.mx) and its API
- The [mta-sts.dmarc.mx](https://mta-sts.dmarc.mx) helper worker
- The source code in this repository, including CI/CD workflows

Out of scope:

- Denial-of-service attacks against the live service (Cloudflare's edge
  handles this — reports about generic DoS will be closed)
- Findings that require the reporter to control DNS records for an
  arbitrary third-party domain they do not own
- Reports generated solely by automated scanners without a working
  proof-of-concept
- Vulnerabilities in third-party dependencies that are already tracked by
  Dependabot unless you have a working exploit chain

## Supported versions

dmarcheck is a rolling release deployed continuously from `main`. There are
no long-lived branches or LTS versions. The only supported version is the
current contents of `main` / the deployed Worker.

## Safe harbour

Security research conducted in good faith against the scope above — including
automated scanning at reasonable rates, and testing with domains you own — is
welcome. Please avoid:

- Testing against third parties' domains you do not control
- Automated scanning that hammers `dmarc.mx` at high volume
- Actions that could degrade service for other users
- Accessing, modifying, or exfiltrating data that is not yours

Reports that follow this policy will not result in legal action from the
maintainer.
