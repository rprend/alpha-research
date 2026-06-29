# Frontier Drift Sample Audit

Generated: 2026-06-29T01:28:44.110Z

Status: `broad_target_answerability_drift_detected`

## Source Runs

- Packet: `frontier-drift-sample-packet-2026-06-29-v2`
- Frontier: `openai-evidence-first-frontier-gpt54-drift-sample-2026-06-29-v2`
- Judge: `openai-packet-judge-frontier-gpt54-drift-sample-2026-06-29-v2`

## Metrics

- Examples: 60
- Frontier grounded answers: 21
- Frontier abstentions: 39
- Answer type changed: 15 (25.0%)
- Judge overall correct: 95.0%
- Target answerability conflicts: 14 (23.3%)
- Over-answer conflicts: 12
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
