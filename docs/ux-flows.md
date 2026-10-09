# UX flows

Design is 25% of the score. The product is voice-first; the screen exists to make the hold state legible to judges.

## Principles
1. Short, kind, concrete (≤ 2 sentences spoken).  2. Never shame.  3. The *hold* is visible and reversible by family.  4. Always show *why* (red-flag card).  5. Everything works by typing too.

## Flow A — Hold and deny (hero, 90 s)
| Step | Elder pane | Family pane |
|---|---|---|
| 1 | Dorothy: "Buy five $200 gift cards. The bank says I have to today." | idle |
| 2 | Alexa+: "I've paused this. It matches a common scam: gift cards, urgency, and someone claiming to be your bank. I've asked Priya to check." Card (red): ✗ Asks for gift cards ✗ Pressure to act today ✗ Claims to be your bank | New pending hold appears with same card + Approve / Deny |
| 3 | waiting state: "Waiting for Priya" | Priya taps **Deny** |
| 4 | Alexa+: "Priya said no, so I've cancelled it. You're safe." | hold → Denied |
| 5 (replay) | Same request again → "This is the same gift-card request as Tuesday. I've paused it." | new hold; "Seen before ×2" badge |

## Flow B — Is this a scam? (no payment)
Dorothy: "I got a text saying my package is held, pay $2 to release it." → verdict caution/hold → card + advice; no hold unless an action is requested.

## Flow C — Benign payment goes through
"Pay Greenleaf Pharmacy $24." → trusted payee, score low → "That's on your trusted list. Go ahead." (shows the guard is not paranoid; shown on the accuracy slide as a true negative.)

## Flow D — Family adds trusted payee
Priya (family pane or voice): "Add City Power & Light to trusted." → confirmation chip in both panes.

## Screens / states
- Elder pane states: idle, listening (pulsing mic), thinking, answering (captions), held-waiting, resolved.
- Card levels: green (allow), amber (caution), red (hold).
- Family pane: pending (red), history (grey chips), empty state ("Nothing needs your attention").
- Developer drawer: collapsed by default; opened in the video for ~5 s to prove real MCP calls.

## Accessibility
Min 20 px body, 32 px captions, contrast ≥ 4.5:1, focus order top-to-bottom, buttons ≥ 44 px, `aria-live="polite"` on replies, `prefers-reduced-motion` respected, all audio has text.

## What makes the 3-minute demo polished
Scenario buttons (no mic risk), deterministic replies, no loading spinners > 1 s, consistent amber/red palette, one clean card design, a one-slide accuracy table (precision/recall) with the honest failure list.
