# Security Policy

Last updated: 2025-11-04

## Supported Versions

This project is currently in pre-1.0 development. Only the `main` branch (the latest code) receives security updates. We generally do not backport fixes to older tags unless a maintainer explicitly designates a maintenance branch.

| Release/Branch | Status |
|----------------|--------|
| `main` (0.x, unreleased) | Supported ✅ |
| Older tags/releases | Not supported 🚫 |

Rationale: until 1.0, the codebase evolves quickly and fixes are forward-ported to `main`.

## How to report a vulnerability

Please use coordinated disclosure and do not file public issues or pull requests that describe the vulnerability.

Preferred channels (pick one):

1) GitHub Private Vulnerability Report (PVR)
   - Go to the repository’s Security tab → “Report a vulnerability”.
   - If PVR is not enabled for this repository, use option 2 below.

2) GitHub Security Advisory (draft)
   - Create a draft advisory via the Security tab → “Advisories” → “New draft advisory”.
   - This keeps details private while we triage.

When reporting, please include:
- A clear description of the issue and its impact
- Affected commit/branch or version
- Steps to reproduce and a minimal proof of concept (PoC)
- Environment details (OS, Node.js version, browser, configuration)
- Any suggested mitigations or patches

If you are unable to use GitHub’s private channels, you may contact the maintainers privately (for example via an organizational security email). If you need a private contact method configured, please open a brief issue requesting “security contact details” without sharing any sensitive information; we will respond with a private channel.

## Our commitment and timelines

We aim to follow these targets (best effort):
- Acknowledgement: within 2 business days
- Initial triage / severity assignment: within 7 days
- Status updates: at least weekly until resolution
- Fix/mitigation targets (from acknowledgement):
  - Critical: 14 days
  - High: 30 days
  - Medium: 60 days
  - Low: 90 days

If more time is required (e.g., complex dependencies), we will communicate new timelines and interim mitigations when possible.

## Scope

In scope (examples, non-exhaustive):
- Authentication, authorization, and session management issues (login, user flows)
- Injection issues (SQL/NoSQL/Mongo, template injection, command injection)
- Cross-Site Scripting (XSS) with meaningful impact
- Cross-Site Request Forgery (CSRF) leading to state change
- Server-Side Request Forgery (SSRF), path traversal, local file disclosure
- Sensitive information exposure (tokens, keys, credentials, PII)
- Business logic/IDOR issues allowing unauthorized access to data or actions
- Misconfigurations (CORS, headers) that materially reduce security

Out of scope (unless shown to cause meaningful security impact):
- Denial of Service (volumetric) without a practical, sustainable exploit
- Clickjacking on non-sensitive pages
- Self-XSS that requires victim-author input only
- Missing rate limits alone
- Best-practice recommendations without a concrete vulnerability
- Vulnerabilities exclusively in third-party dependencies without a working exploit path in this project

## Handling of secrets and sensitive data

- Do not commit real secrets to the repository. Use environment files like `.env` locally and `.env.example` for placeholders.
- If a credential or API key is exposed, please report privately and follow this rotation playbook:
  1) Revoke/disable the exposed secret immediately
  2) Rotate the secret and redeploy affected services
  3) Invalidate user sessions/tokens if applicable
  4) Purge the secret from repository history (e.g., `git filter-repo`) and force-push if appropriate
  5) Document the incident and preventive controls (secret scanning, pre-commit hooks)

## Automated security checks

This repository uses automated checks to reduce risk:
- Super Linter (GitHub Actions) to lint across multiple languages: `.github/workflows/super-linter.yml`
- JetBrains Qodana configuration: `qodana.yaml`

We recommend enabling Dependabot alerts and updates, and (optionally) CodeQL code scanning for JavaScript/TypeScript.

## Safe Harbor for good-faith research

We support responsible security research. As long as you make a good-faith effort to avoid privacy violations, destruction of data, and service degradation, we will not initiate legal action against you for your research. Please:
- Only test against your own accounts/data
- Do not exfiltrate data
- Do not run attacks that degrade service for other users
- Follow the reporting process above

## Privacy & data

By default, the demo application stores minimal user account data in MongoDB and writes local server logs. If your finding involves personal data exposure or regulatory obligations (e.g., FERPA, GDPR), please indicate that in your report so we can prioritize appropriately.

## Credit and recognition

With permission, we are happy to thank reporters in release notes or a Hall of Fame once a fix ships. If you prefer to remain anonymous, let us know in your report.
