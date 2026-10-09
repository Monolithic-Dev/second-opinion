# Agent Skill (`skills/second-opinion/SKILL.md`)

The rules name Agent Skills as an Alexa+ deliverable. Resources reference the open Agent Skills standard. Exact Alexa+ packaging is [UNKNOWN] — verify on the Resources page ("Build with Agent Skills") before finalising.

## Plan
A `SKILL.md` with YAML front matter (`name`, `description`) and instructions telling an agent **when** to invoke the guard and **how** to use the MCP tools.

```markdown
---
name: second-opinion
description: Guard payments and purchases for older adults. Use whenever a user asks to buy, pay, send money, or wire funds, or asks whether a call/text/email is a scam. Calls the Second Opinion MCP server to check risk, hold risky actions, and ask a trusted family member to approve.
---
# Second Opinion
1. Before executing any purchase/payment/transfer, call `check_message` with the user's words and `context.actionType`, `amountCents`, `payee`.
2. If `verdict` is `hold`: call `place_hold`, then `request_family_approval`. Tell the user (≤2 sentences, kind, no blame) what was paused and why. Do NOT execute the action.
3. If `caution`: read `spokenSummary`, ask the user to confirm, offer to hold.
4. If `allow`: proceed.
5. Never override the verdict. Never release a hold yourself; only `resolve_approval` by an approver releases it.
6. If any tool errors or is unreachable: do not execute the action; say you couldn't verify it.
```

## Acceptance
File validates (front matter present), referenced in README, and the simulator's `bedrock` mode loads it as its system prompt so the skill is exercised at runtime, not just shipped.
