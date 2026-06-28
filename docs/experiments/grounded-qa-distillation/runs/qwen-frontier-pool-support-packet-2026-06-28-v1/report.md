# Qwen Frontier Pool Support Packet

Generated: 2026-06-28T09:42:59.568Z

This packet makes no new API calls and launches no compute. It reuses `joint-action-qwen7b-nonfinal-frontier-pool-v2-citation-repair` and `openai-judge-gpt4o-joint-action-qwen7b-nonfinal-frontier-pool-v2-citation-repair`.

| Item | Count |
| --- | ---: |
| Predictions | 240 |
| Support labels | 240 |
| Supported answers | 46 |
| Unsupported answers | 127 |
| Supported abstentions | 66 |
| Roots with generated supported and unsupported answers | 20 |
| Generated candidate contrast pairs | 32 |
| Reference fallback contrast pairs | 52 |
| Train pairs | 63 |
| Validation pairs | 21 |

## Decision

- Train verifier now: yes
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The judged pool contains enough within-Qwen generated supported-vs-unsupported contrasts to test a zero-cost verifier before more paid generation.
- Next step: Train a pool-contrast verifier and require held-out non-final plus final diagnostic gains before launching another GPU run.

## Budget

Total tracked spend remains $13.352158100000022. This script adds $0.
