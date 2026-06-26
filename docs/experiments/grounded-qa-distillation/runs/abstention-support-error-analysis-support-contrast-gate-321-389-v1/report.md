# Abstention-Support Error Analysis

## Setup

- Gate run: `support-contrast-gate-direct-repair-0-240-val-240-320-to-321-389-v1`
- Source run: `citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1`
- Judge run: `openai-judge-gpt4o-citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1`
- Eval window: 320-389 zero-based offsets
- OpenAI calls: 0
- OpenAI cost: $0.0000000

## Counts

| Category | Count |
| --- | ---: |
| Source answered | 53 |
| Source supported answers | 34 |
| Source unsupported answers | 19 |
| Gate answered | 42 |
| Gate abstained | 27 |
| Useful suppressions on unanswerable rows | 3 |
| Suppressed unsupported answers on answerable rows | 3 |
| Harmful suppressions | 5 |
| Retained unsupported answers | 13 |
| Source abstentions on answerable rows | 2 |

## Rates

| Metric | Value |
| --- | ---: |
| Source answer support | 64.2% |
| Gate retained-answer support | 69.0% |
| Gate abstention support | 63.0% |
| Inherited overall correct | 66.7% |

## Interpretation

The support-contrast gate has three distinct failure families:

1. Retained unsupported answers: 13
2. Suppressed unsupported answers on answerable rows: 3
3. Harmful suppressions of supported answers: 5
4. Source abstentions on answerable rows: 2

This means the next system should not be another one-dimensional support threshold. It needs a joint action policy: keep supported answers, repair unsupported answers when evidence is sufficient, and abstain only when the evidence pack is insufficient.
