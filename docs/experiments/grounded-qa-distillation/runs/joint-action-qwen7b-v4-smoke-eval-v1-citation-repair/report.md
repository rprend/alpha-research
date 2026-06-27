# Local Qwen 3B Citation-Repair Control

Run: `joint-action-qwen7b-v4-smoke-eval-v1-citation-repair`

Source run: `joint-action-qwen7b-v4-smoke-eval-v1`

This is a deterministic, zero-call syntax repair over the local Qwen 3B base-control outputs. It is not trained-student evidence.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source base-control | 69 | 35 | 66.7% | 70.1% | 47.3% | 26.3% | 34.3% |
| repaired syntax control | 69 | 35 | 66.7% | 73.0% | 49.6% | 27.6% | 97.1% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 22 | 36 | 36 |

## Interpretation

- A local syntax repair can force cited ids into the answer text, but it does not change answer content, cited evidence ids, answer type, or grounded support.
- Citation formatting metrics must be reported separately from answer support and grounded correctness; this repaired base-control is still not trained-student evidence.

No OpenAI calls, no paid GPU jobs, and no new spend.
