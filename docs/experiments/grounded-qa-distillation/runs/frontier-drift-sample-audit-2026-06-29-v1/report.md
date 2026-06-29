# Frontier Drift Sample Audit

Generated: 2026-06-29T01:19:30.478Z

Status: `broad_target_answerability_drift_detected`

## Source Runs

- Packet: `frontier-drift-sample-packet-2026-06-29-v1`
- Frontier: `openai-evidence-first-frontier-gpt54-drift-sample-2026-06-29-v1`
- Judge: `openai-packet-judge-frontier-gpt54-drift-sample-2026-06-29-v1`

## Metrics

- Examples: 24
- Frontier grounded answers: 10
- Frontier abstentions: 14
- Answer type changed: 6 (25.0%)
- Judge overall correct: 95.8%
- Target answerability conflicts: 6 (25.0%)
- Over-answer conflicts: 4
- Under-answer conflicts: 2

## Interpretation

Existing SFT targets over-answer on a nontrivial subset when compared with frontier abstentions independently judged correct against the compact evidence pack.

Do not launch another Prime student run against unrepaired labels when target conflicts exceed the drift threshold.

## Decision

- Repair train/validation targets next: yes
- Promote existing targets without repair: no
- Launch Prime now: no
- Buy more OpenAI judgments now: no
- Reason: A larger train/validation target repair is required before another student run.
