# Minimal Span Overexpansion Packet

Generated: 2026-06-28T11:01:55.612Z

This packet makes no OpenAI calls and launches no compute. It uses non-final judged Qwen pool artifacts only.

| Item | Count |
| --- | ---: |
| Roots with pairs | 30 |
| All pairs | 53 |
| Generated candidate pairs | 20 |
| Reference fallback pairs | 33 |
| Train pairs | 40 |
| Validation pairs | 13 |
| Same-citation pairs | 17 |
| Numeric/list scope pairs | 33 |

## Pair Tags

| Tag | Count |
| --- | ---: |
| `unsupported_judge_claim_available` | 53 |
| `numeric_or_list_scope_overclaim` | 33 |
| `minimal_supported_span` | 24 |
| `same_citation_surface` | 17 |
| `entity_scope_expansion` | 8 |
| `longer_unsupported_expansion` | 3 |

## Decision

- Train selector now: yes
- Launch GPU now: no
- Buy more OpenAI labels now: no
- Reason: The packet contains enough generated-vs-generated non-final overexpansion contrasts to test a selector before more paid labels.
- Next step: Train a zero-cost overexpansion-aware selector and require final diagnostic gains over D262 before any paid batch.
