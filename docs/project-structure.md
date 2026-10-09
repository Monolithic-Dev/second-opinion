# Project structure (v2 — platform layout)

**Repo layout:** one TypeScript monorepo (npm workspaces: `packages/*`, `apps/*`, `examples/*`) so shared types, the engine, the policy engine and the Guard SDK are versioned together. The benchmark dataset lives in a **separate** repo, `scam-script-bench`, to keep the held-out test split independent.
Tiers (see `expansion-scope.md`): **[T0]** core, **[T1]** depth, **[T2]** stretch.

```
second-opinion/
├─ README.md  LICENSE  package.json  tsconfig.base.json  .env.example  .gitignore  .editorconfig  .nvmrc
├─ .github/
│  ├─ workflows/ci.yml                 # typecheck, lint, test, eval(cache), e2e, audit, docker build
│  ├─ workflows/codeql.yml  [T1]
│  └─ dependabot.yml  [T1]
├─ docs/                               # specs, phases, expansion phases
│  ├─ phases/phase-1..6-*.md
│  └─ phases/expansion/x1..x5-*.md
├─ packages/
│  ├─ shared/            [T0]          # zod schemas, SignalId/Verdict/ErrorCode, ids, clock, i18n keys
│  │  └─ src/{schemas.ts,ids.ts,clock.ts,errors.ts,i18n/{en,es,hi}.json}
│  ├─ engine/            [T0→T1]       # pure detection; layered pipeline
│  │  ├─ src/{index.ts,types.ts,normalize.ts,explain.ts,fingerprint.ts}
│  │  ├─ src/layers/{rules.ts,playbooks.ts,behavior.ts,llm.ts,fusion.ts}
│  │  ├─ src/playbooks/*.json   [T1]   # ~20 scam playbooks (knowledge base)
│  │  └─ test/{rules,playbooks,behavior,fusion,properties}.test.ts
│  ├─ policy/            [T1]          # household policy evaluation + approval state machine
│  │  └─ src/{policy.ts,decision.ts,quorum.ts,escalation.ts} test/
│  ├─ store/             [T0→T1]       # SQLite repos + versioned migrations
│  │  ├─ migrations/{001_init.sql,002_policy_approvals.sql,003_notifications.sql}
│  │  └─ src/{db.ts,migrate.ts,repos/*.ts,seed.ts} test/
│  ├─ notify/            [T1]          # notification adapters + templates
│  │  └─ src/{outbox.ts,adapters/{console,db,emailHtml}.ts,templates/{hold,digest}.ts} test/
│  └─ guard-sdk/         [T1]          # publishable library: protect any MCP tool
│     └─ src/{index.ts,guard.ts,client.ts,types.ts} test/ README.md
├─ apps/
│  ├─ mcp-server/        [T0]          # the product: tools, resources, prompts, HTTP, auth
│  │  ├─ src/{index.ts,server.ts,config.ts,auth.ts,logging.ts,metrics.ts}
│  │  ├─ src/tools/{checkMessage,placeHold,requestFamilyApproval,resolveApproval,trustedPayees,listHolds}.ts [T0]
│  │  ├─ src/tools/{getPolicy,setPolicy,householdInsights}.ts [T1]
│  │  ├─ src/resources/{playbooks.ts,householdSummary.ts} [T1]
│  │  ├─ src/prompts/guardInstructions.ts [T1]
│  │  ├─ src/jobs/{escalation.ts,expiry.ts,digest.ts} [T1]
│  │  └─ test/{tools,resources,prompts,contract}.test.ts
│  ├─ simulator/         [T0]          # BFF: Alexa+ stand-in agent + HTTP/SSE API for the web app
│  │  ├─ src/{server.ts,config.ts,mcpClient.ts,events.ts,session.ts}
│  │  ├─ src/agent/{intent.ts,router.ts,bedrock.ts} 
│  │  ├─ src/routes/{utter,family,auth,insights,digest}.ts
│  │  ├─ public/ (lite static UI, fallback) [T0]
│  │  └─ test/
│  ├─ web/               [T1]          # React + Vite + TypeScript SPA
│  │  └─ src/{main.tsx,routes/{Demo,Dashboard,Holds,HoldDetail,Circle,Policy,Insights,Digest,Audit}.tsx,
│  │         components/*,hooks/{useEvents,useApi}.ts,styles/tokens.css}
│  └─ admin-cli/         [T1]          # `so` CLI: seed, reset, export, replay, simulate, bench
│     └─ src/{index.ts,commands/*.ts}
├─ examples/
│  └─ freshmart-mcp/     [T1]          # merchant MCP server protected by the Guard SDK
│     └─ src/{index.ts,tools/placeOrder.ts}
├─ skills/second-opinion/SKILL.md  [T0]
├─ eval/                 [T0→T1]       # runner, ablations, cache, results
│  └─ {run.ts,ai.ts,ablation.ts,cache/,results/}
├─ e2e/                  [T1]          # Playwright: hero flow, family approve, policy quorum
├─ infra/
│  ├─ docker/{Dockerfile.mcp,Dockerfile.sim}  docker-compose.yml  [T1]
│  └─ ec2/user-data.sh  [T2]
├─ scripts/{demo.ts,seed.ts,reset.ts,load-test.mjs}
└─ data/                 (gitignored sqlite files)
```

## Package boundaries (dependency rule)
`shared` ← `engine`, `policy`, `store`, `notify` ← `apps/mcp-server` ← (HTTP/MCP only) ← `apps/simulator`, `guard-sdk`, `admin-cli` ← `apps/web` (HTTP only). **Apps never import another app.** `engine` and `policy` are pure (no I/O). `guard-sdk` depends only on the MCP SDK + `shared`.

## Naming conventions
- Packages: `@second-opinion/<name>`. Files: `camelCase.ts`; React components `PascalCase.tsx`.
- MCP names: tools `snake_case`; resources `so://…`; prompts `snake_case`.
- Signal IDs `UPPER_SNAKE`; DB tables/columns `snake_case`; ids prefixed (`hh_ p_ chk_ hold_ pay_ evt_ appr_ ntf_ pol_`).
- Migrations `NNN_description.sql`, forward-only.
- Commits: `feat(engine): …`, `fix(policy): …`, `docs: …`, `test: …`, `chore: …`.

## Where do I start (day one)
1. `npm install && cp .env.example .env`.
2. Read `expansion-scope.md` (tiers/gates) then `architecture.md`, `api-spec.md`.
3. Build bottom-up: `shared` → `engine` (L1) → `store` → `mcp-server` tools → `simulator` → (Tier 1) `engine` layers, `policy`, `web`, `guard-sdk`.
4. Follow `docs/phases/` (Tier 0) and `docs/phases/expansion/` (Tier 1) in the order given in `roadmap.md`.
