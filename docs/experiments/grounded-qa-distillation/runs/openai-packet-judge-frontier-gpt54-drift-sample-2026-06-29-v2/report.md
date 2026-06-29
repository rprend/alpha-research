# OpenAI Packet Judge

Generated: 2026-06-29T01:28:16.656Z

Status: `packet_judgments_ready`

Model: `gpt-4o-mini`

Packet: `frontier-drift-sample-packet-2026-06-29-v2`

Prediction run: `openai-evidence-first-frontier-gpt54-drift-sample-2026-06-29-v2`

## Budget

- Calls made: 60
- Estimated cost: $0.025070
- Run cost: $0.007880
- Total tracked spend: $14.810993 / $100
- Remaining total budget: $85.189007

## Metrics

- Examples judged: 60
- Answer support: 85.7%
- Abstention support: 100.0%
- Overall judged correct: 95.0%

## Decision

- Run drift audit next: yes
- Launch Prime now: no
- Reason: Packet-local judging uses each sampled evidence pack directly, so mixed train/validation drift samples are not dropped by split lookup.
