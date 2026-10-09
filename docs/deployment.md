# Deployment & distribution

**Primary distribution = this GitHub repo + a demo video.** The rules require the project be testable via repo and video; a hosted URL is optional. Local-first removes cost and failure risk. (Rule text: project must be available for evaluation; judges may judge from video alone.)

## Local (required path)
```
git clone https://github.com/Monolithic-Dev/second-opinion && cd second-opinion
npm install
cp .env.example .env
npm run demo        # starts mcp-server :3001 and simulator :3000, seeds hh_demo
open http://localhost:3000
```
`.env.example`:
```
MCP_PORT=3001
SIM_PORT=3000
MCP_URL=http://localhost:3001/mcp
MCP_AUTH_TOKEN=dev-token
DB_PATH=./data/second-opinion.db
AGENT_MODE=router            # router | bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=            # set only if using bedrock
LLM_CACHE_DIR=./.cache/llm
BENCH_PATH=../scam-script-bench
```

## Docker (shipped, smoke-tested)
```
export MCP_AUTH_TOKEN=<24+ chars> SESSION_SECRET=<long random> FAMILY_PINS=p_priya:4821,p_arjun:7390
docker compose up --build        # console + demo on http://localhost:3000, MCP on http://localhost:3001/mcp
```
One image, two services (`mcp`, `sim`); production mode refuses default secrets. SQLite lives in the `so-data` volume. Ports bind to 127.0.0.1 only; put a TLS proxy (Caddy) in front for anything public.

## Metrics
`GET /metrics` (bearer-protected, Prometheus text): `so_tool_calls_total{tool,outcome}`, `so_tool_duration_ms` histogram, and gauges `so_checks{verdict}`, `so_holds{status}`, `so_notifications{status}` read from the database. Counts only: never message text or ids (tested).

## CI (GitHub Actions `ci.yml`)
Stages: checkout → Node 22 → `npm ci` → `npm run typecheck` → `npm test` → `npm run eval -- --split dev --cache-only`. No secrets. Badge in README.

## Optional AWS deployment (only if time remains; documents "AWS Builder" story)
Free-tier-safe suggestion, **not required**:
- One small EC2 (t3.micro/t4g.micro, free-plan eligible [UNVERIFIED]) running both Node processes under `systemd` or Docker Compose, Caddy for TLS, SQLite on EBS.
- Why not Lambda: SQLite needs a persistent disk; DynamoDB rewrite not worth the time.
- Bedrock IAM policy: `bedrock:InvokeModel` on one model ARN, nothing else.
- Billing: AWS Budgets alarm at $5 before first Bedrock call.
Rollback: keep the previous commit tag; `git checkout <tag> && docker compose up -d --build`. Last-minute rule: **no deploy changes in the last 12 hours**; the video is recorded from the local run.

## AWS Builder mini-challenge evidence (if we enter)
Needs "documented integrations". Minimum honest set: Bedrock (phrasing + signal suggestion, cached) documented in `ai` section of Product Feedback; optional EC2 host. Kiro Crew as a dev tool also qualifies on its own per rules — use it for scaffolding and log it.

## Cost estimate
Local: $0. Eval with Bedrock: ~120 short calls ≈ cents–$1 (cached after first run). Optional EC2: free plan or ≈ $0.01/hr.

## Monitoring
Local: console logs with request ids; `/healthz` on both; audit_events table; developer trace drawer in the UI.
