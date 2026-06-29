# Frontier Drift Sample Audit

Generated: 2026-06-29T01:55:40.324Z

Status: `broad_target_answerability_drift_detected`

## Source Runs

- Packet: `frontier-full-nonfinal-packet-2026-06-29-v1`
- Frontier: `openai-evidence-first-frontier-gpt54-full-nonfinal-2026-06-29-v1`
- Judge: `openai-packet-judge-frontier-gpt54-full-nonfinal-2026-06-29-v1`

## Metrics

- Examples: 315
- Frontier grounded answers: 145
- Frontier abstentions: 159
- Answer type changed: 96 (30.5%)
- Judge overall correct: 93.0%
- Target answerability conflicts: 82 (26.0%)
- Over-answer conflicts: 68
- Under-answer conflicts: 14

## Interpretation

Existing SFT targets over-answer on a nontrivial subset when compared with frontier abstentions independently judged correct against the compact evidence pack.

Do not launch another Prime student run against unrepaired labels when target conflicts exceed the drift threshold.

## Decision

- Repair train/validation targets next: yes
- Promote existing targets without repair: no
- Launch Prime now: no
- Buy more OpenAI judgments now: no
- Reason: A larger train/validation target repair is required before another student run.
