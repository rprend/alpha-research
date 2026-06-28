# Local Qwen 3B Citation-Repair Control

Run: `joint-action-qwen7b-support-targeted-planning-smoke-eval-v12-citation-repair`

Source run: `joint-action-qwen7b-support-targeted-planning-smoke-eval-v12`

This is a deterministic, zero-call syntax repair over the local Qwen 3B base-control outputs. It is not trained-student evidence.

| System | Examples | Answered | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source base-control | 69 | 41 | 55.1% | 48.6% | 22.7% | 29.3% | 2.4% |
| repaired syntax control | 69 | 41 | 55.1% | 50.8% | 22.7% | 29.5% | 53.7% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 21 | 30 | 30 |

## Interpretation

- A local syntax repair can force cited ids into the answer text, but it does not change answer content, cited evidence ids, answer type, or grounded support.
- Citation formatting metrics must be reported separately from answer support and grounded correctness; this repaired base-control is still not trained-student evidence.

No OpenAI calls, no paid GPU jobs, and no new spend.
