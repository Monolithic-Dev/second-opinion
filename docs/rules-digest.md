# Rules digest (source: official rules + Resources pages, read Oct 8 2026)

Always re-read the live Rules tab before submitting; rules can change.

## Dates
Submission: Aug 31 – **Oct 23 2026 12:00 PM PT** · Judging: Nov 9–20 · Winners ≈ Dec 3.

## Eligibility
Age of majority; teams allowed (one appointed Representative submits); not for sanctioned/excluded regions or conflicted parties; one person may be on multiple teams.

## Alexa+ track requirement (verbatim intent)
"Working Agent Skill or self-hosted MCP server, MCP spec 2025-11-25 or later, over Streamable HTTP." **Alternative:** simulated Alexa+ in a web app; repo must include simulation source and the video must show it working; exempt from the runtime-tech-hook rule. For the non-simulated path, the repo must import and actually call MCP at runtime (not just mention it).
**We do both:** real MCP server + Agent Skill + simulator client.

## Submission contents
1. Text description (features + how it works).  2. GitHub repo: public with visible OSS license **or** private shared with testing@devpost.com + Amazon reviewers (knmeiss, giolaq, anishamalde, mosesroth, emersonsklar, chris-trag).  3. Demo video < 3 min, public YouTube/Vimeo, English, shows project running on the target platform.  4. Product feedback for every tool/API/SDK used.  5. Track + mini challenges declared.  6. If pre-existing: what changed during the window (ours is new).  Optional: feature requests, friction log (**up to +10%**).

## Judging
Stage 1 pass/fail (fits theme, applies required tech). Stage 2: four **equal** criteria — Tech Implementation, Design, Potential Impact, Quality of the Idea. Judging may use experts, peer review and **automated AI analysis**. Ties broken by criteria in listed order.
Alexa+ "obvious": single-turn Q&A, basic MCP wrapper. "Creative": orchestration across services, **state across sessions**, **purchasing**, **cards/carousels**, **MCP Apps**, **Agent Skills**.
AWS Builder "creative": multi-service pipeline (Bedrock + AgentCore + Strands), agent orchestration. Open Source "obvious": README/typo; "creative": meaningful feature with tests, new integration pattern.

## Prizes (relevant)
Alexa+ 1st $25k+$15k credits+meeting · 2nd $15k+$5k · 3rd $4k+$1k. AWS Builder $5k+$5k credits · Open Source $5k+$5k credits. A project can win **one track prize and one mini-challenge prize**.

## Other
IP stays ours; Amazon/Devpost may promote the submission; third-party SDK terms must be respected; credits: AWS credit codes exhausted Oct 7; project available free for evaluation through judging; English materials; winners need tax forms (W-8BEN for non-US).
