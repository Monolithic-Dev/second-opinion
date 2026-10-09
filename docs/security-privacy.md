# Security & privacy

## Sensitive data in this project
- Message text that may describe finances (synthetic in all demos/tests).
- Household/people names and "contact labels" (fictional).
- AWS credentials (only if Bedrock mode used).
**Rule: no real personal data, ever.** README states this; seed data is fictional; benchmark scripts are written, not scraped.

## AuthN / AuthZ
- MCP server: bearer token (`MCP_AUTH_TOKEN`); reject without it when set. Local default `dev-token`.
- Authorization inside tools: only `people.can_approve=1` may `resolve_approval` and modify `trusted_payees`; elder cannot approve their own holds (`FORBIDDEN`).
- Simulator → MCP uses the same token from env; the browser never sees it.

## Data protection
- Transit: localhost HTTP for the demo; TLS (reverse proxy/ALB) required for any hosted deploy.
- At rest: SQLite file in `data/` (gitignored); note that production would need disk encryption + per-household keys.
- Retention: `reset` wipes demo data; production would define a short retention for message text.

## Secrets
`.env` gitignored; `.env.example` has placeholders only; CI uses no AWS secrets (eval uses committed cache). Pre-commit check: `git secrets`-style grep in CI for `AKIA[0-9A-Z]{16}`.

## Top threats and mitigations
| # | Threat | Mitigation |
|---|---|---|
| 1 | **Prompt injection** via message text steering the Bedrock agent/phrasing | Rules decide verdict; model output limited to enum signals + phrasing; strip tool-call attempts; hold auto-placed in code |
| 2 | **Approver impersonation** (elder approves own hold) | Role check in `resolve_approval`; `resolvedBy` must be `can_approve` and ≠ elder |
| 3 | **Fail-open** on error/timeouts | All failures leave action blocked; tested (`edge-cases.md`) |
| 4 | **Injection / oversized input** | zod validation, length caps, parameterised SQL only |
| 5 | **Credential leak** | gitignore, CI grep, no keys in repo, least-privilege IAM (bedrock:InvokeModel only) |
| 6 | **Misuse as scam-writing aid** | Benchmark scripts are generic templates, no real brands' phone numbers/URLs; README states defensive purpose |

## Responsible-tech notes
Decision support, not a guarantee. Language is respectful: never "you were fooled"; always "this matches a common scam". Elder retains agency: family can approve; the system does not lock the person out of their money permanently. Bias: patterns reflect English-language US scam scripts; limitation documented in benchmark README.

## Compliance
Not a regulated product in the hackathon. A real deployment touching payments/PII would need review under GLBA/PCI scope boundaries, elder-protection (EFTA, state laws), and consent/retention rules. No dedicated compliance doc is warranted now.
