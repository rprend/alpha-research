# OpenAI Packet Judge

Generated: 2026-06-29T01:19:17.770Z

Status: `packet_judgments_ready`

Model: `gpt-4o-mini`

Packet: `frontier-drift-sample-packet-2026-06-29-v1`

Prediction run: `openai-evidence-first-frontier-gpt54-drift-sample-2026-06-29-v1`

## Budget

- Calls made: 24
- Estimated cost: $0.010144
- Run cost: $0.003242
- Total tracked spend: $14.472442 / $100
- Remaining total budget: $85.527558

## Metrics

- Examples judged: 24
- Answer support: 90.0%
- Abstention support: 100.0%
- Overall judged correct: 95.8%

## Decision

- Run drift audit next: yes
- Launch Prime now: no
- Reason: Packet-local judging uses each sampled evidence pack directly, so mixed train/validation drift samples are not dropped by split lookup.
