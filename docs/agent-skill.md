# Agent Skill (`skills/second-opinion/SKILL.md`)

The rules name Agent Skills as an Alexa+ deliverable. Resources reference the open Agent Skills standard. Exact Alexa+ packaging is [UNKNOWN] — verify on the Resources page ("Build with Agent Skills") before finalising.

## Status: shipped
The skill lives at [`skills/second-opinion/SKILL.md`](../skills/second-opinion/SKILL.md). It follows the open Agent Skills layout (folder name = `name`, front matter with `name` and `description`). Exact Alexa+ packaging is [UNKNOWN]: verify on the Resources page before submitting.

What it encodes: check first; read both `verdict` and `decision.outcome`; hold + ask family on `hold` / `require_approval`; never run a blocked or held action; never resolve an approval; fail closed on any error.

## Tests
`apps/mcp-server/test/skill.test.ts`: front matter is valid, every tool named in the skill exists on the server (so the skill cannot drift from the tools), and the safety rules are present.

## Not done
The simulator's rule-based classifier does not read this file; a model-driven agent (optional Bedrock layer) would load it as its system prompt.
