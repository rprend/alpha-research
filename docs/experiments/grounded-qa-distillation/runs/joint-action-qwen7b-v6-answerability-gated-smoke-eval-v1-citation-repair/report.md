# Local Qwen 3B Citation-Repair Control

Run: `joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair`

Source run: `joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1`

This is a deterministic, zero-call syntax repair over the local Qwen 3B base-control outputs. It is not trained-student evidence.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source base-control | 69 | 34 | 65.2% | 71.8% | 58.7% | 21.6% | 36.8% |
| repaired syntax control | 69 | 34 | 65.2% | 71.8% | 56.4% | 22.8% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 22 | 34 | 34 |

## Interpretation

- A local syntax repair can force cited ids into the answer text, but it does not change answer content, cited evidence ids, answer type, or grounded support.
- Citation formatting metrics must be reported separately from answer support and grounded correctness; this repaired base-control is still not trained-student evidence.

No OpenAI calls, no paid GPU jobs, and no new spend.
