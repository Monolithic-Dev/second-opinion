# Demo script & video plan

Rules: video **< 3:00**, public on YouTube/Vimeo, English, footage of the project running, no third-party trademarks or copyrighted music, judges need not watch past 3:00 → **best moment in the first 20 seconds**.

## 90-second hero beat sheet
| t | Screen | Voice-over / on-screen |
|---|---|---|
| 0:00–0:08 | Elder pane, Dorothy (name card) | "Every year older adults lose billions to scams that say: pay now." (verify number before using) |
| 0:08–0:20 | Click scenario "Gift cards": Dorothy speaks | "Buy five $200 gift cards. The bank says I have to today." Alexa+: "I've paused this… I've asked Priya." Red card appears |
| 0:20–0:35 | Family pane lights up | Priya sees the same flags. Taps **Deny** |
| 0:35–0:45 | Elder pane | "Priya said no, so I've cancelled it." |
| 0:45–1:00 | Replay same request | "This is the same gift-card request as Tuesday." → memory across sessions |
| 1:00–1:15 | Benign: "Pay Greenleaf Pharmacy $24" | Goes through (trusted) → not paranoid |
| 1:15–1:30 | Dev drawer 5 s | Real MCP calls: `check_message` → `place_hold` → `request_family_approval` → `resolve_approval` |

## Full 3:00 outline
0:00 hook (hero) → 0:35 what it is + honesty ("simulated Alexa+, MCP server is real") → 1:00 architecture slide (one diagram) → 1:20 accuracy slide: table recall/precision on held-out test split + two real failures shown → 2:00 Agent Skill + open-source benchmark repo → 2:20 AWS: Bedrock phrasing + cached eval (if implemented) → 2:40 impact + what we'd do next → 2:55 end card (repo URL).

## Slides (max 3)
1. Architecture (from `architecture.md` mermaid).
2. Accuracy table (`eval/results/latest.md`) with failure list.
3. Rules-fit slide: "Creative examples we hit": state across sessions · purchasing guard · cross-service actions · cards · Agent Skill.

## Recording checklist
Record at 1080p from the local run; use Scenario buttons (no live mic risk) but show one live voice turn if reliable; captions on; mute notifications; hide `.env`; no Amazon/Alexa logos beyond text; narration clear and unhurried; export, upload as **public** (unlisted fails the rule), paste link in the form.
