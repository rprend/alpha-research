# Multi-Citation Target Audit

Generated: 2026-06-29T18:57:18.519Z

Status: `multi_citation_targets_look_required`

This local audit checks whether the D437 multi-citation targets require every exact oracle citation or whether some target citations look redundant or weakly linked to the target answer. It makes no API calls and launches no compute.

## Target Roles

- Examples: 15
- Target citation distribution: {"2":8,"3":3,"4":4}
- Role families: {"mixed_unique_and_redundant":6,"all_unique_required":8,"no_unique_required_detected":1}
- Rows with weak/redundant target citation: 7/15
- Mean target citations: 2.73
- Mean uniquely required citations: 2.13
- Mean weak/redundant citations: 0.60

## Existing Probe Predictions

| Prediction run | Strict exact | Relaxed coverage correct | Unique required covered | Omitted only weak/redundant | Strict subset predictions |
| --- | ---: | ---: | ---: | ---: | ---: |
| `openai-multicitation-composition-probe-2026-06-29-v1` | 1/15 | 3/15 | 3/15 | 2 | 13 |
| `openai-multicitation-citation-set-probe-2026-06-29-v1` | 2/15 | 4/15 | 4/15 | 1 | 9 |

## Decision

- Revise primary metric now: no
- Train on current exact multi-citation targets now: no
- Buy more OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: 7/15 multi-citation targets contain at least one weak/redundant citation by local audit; best relaxed coverage is 4/15 for openai-multicitation-citation-set-probe-2026-06-29-v1, versus strict exact 2/15.
- Next step: Keep exact citation-set scoring as the primary target and focus on stronger evidence selection.
