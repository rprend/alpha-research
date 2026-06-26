# Support-Contrast Prep

## Setup

- Run id: `support-contrast-prep-judge-support-direct-repair-0-320-to-321-389-v1`
- Label prefix: `judge-support-direct-repair-future-holdout-0-320-v1`
- Split: `extended_temporal_future_holdout`
- Train windows: 0-240
- Validation windows: 240-320
- Eval window: 320-389 zero-based offsets (321-389 in one-based example numbering)
- OpenAI calls: 0
- OpenAI cost: $0.0000000

## Outputs

| Artifact | Rows |
| --- | ---: |
| SFT train | 126 |
| SFT validation | 38 |
| Preference train | 59 |
| Preference validation | 21 |
| Eval prompts | 69 |

## Leakage Checks

| Check | Count |
| --- | ---: |
| Eval papers | 12 |
| Train candidate rows sharing eval papers | 0 |
| Validation candidate rows sharing eval papers | 5 |

This packet converts prior-window judged support failures into preference rows: the rejected response is the unsupported answered candidate, while the chosen response is an abstention. It is a training artifact for support-aware SFT/DPO/ORPO-style experiments, not a model result.
