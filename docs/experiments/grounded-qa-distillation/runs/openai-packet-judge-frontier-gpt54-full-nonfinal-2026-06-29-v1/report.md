# OpenAI Packet Judge

Generated: 2026-06-29T01:55:24.273Z

Status: `packet_judgments_ready`

Model: `gpt-4o-mini`

Packet: `frontier-full-nonfinal-packet-2026-06-29-v1`

Prediction run: `openai-evidence-first-frontier-gpt54-full-nonfinal-2026-06-29-v1`

## Budget

- Calls made: 315
- Estimated cost: $0.131372
- Run cost: $0.040254
- Total tracked spend: $16.781189 / $100
- Remaining total budget: $83.218811

## Metrics

- Examples judged: 315
- Answer support: 85.9%
- Abstention support: 100.0%
- Overall judged correct: 93.0%

## Decision

- Run drift audit next: yes
- Launch Prime now: no
- Reason: Packet-local judging uses each sampled evidence pack directly, so mixed train/validation drift samples are not dropped by split lookup.
