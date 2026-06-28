# Local Qwen 3B Citation-Repair Control

Run: `joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13-citation-repair`

Source run: `joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13`

This is a deterministic, zero-call syntax repair over the local Qwen 3B base-control outputs. It is not trained-student evidence.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source base-control | 69 | 52 | 59.4% | 56.0% | 44.9% | 35.7% | 3.8% |
| repaired syntax control | 69 | 52 | 59.4% | 60.8% | 44.9% | 36.5% | 67.3% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 33 | 51 | 51 |

## Interpretation

- A local syntax repair can force cited ids into the answer text, but it does not change answer content, cited evidence ids, answer type, or grounded support.
- Citation formatting metrics must be reported separately from answer support and grounded correctness; this repaired base-control is still not trained-student evidence.

No OpenAI calls, no paid GPU jobs, and no new spend.
