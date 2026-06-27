# Local Qwen 3B Citation-Repair Control

Run: `joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair`

Source run: `joint-action-qwen7b-v5-coverage-smoke-eval-v1`

This is a deterministic, zero-call syntax repair over the local Qwen 3B base-control outputs. It is not trained-student evidence.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source base-control | 69 | 44 | 59.4% | 61.6% | 61.0% | 22.8% | 22.7% |
| repaired syntax control | 69 | 44 | 59.4% | 63.1% | 61.0% | 24.0% | 95.5% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 32 | 48 | 48 |

## Interpretation

- A local syntax repair can force cited ids into the answer text, but it does not change answer content, cited evidence ids, answer type, or grounded support.
- Citation formatting metrics must be reported separately from answer support and grounded correctness; this repaired base-control is still not trained-student evidence.

No OpenAI calls, no paid GPU jobs, and no new spend.
