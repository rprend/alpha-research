# Local Qwen 3B Base-Control Eval

Run: `local-qwen3b-base-control-joint-action-12-v1`

This is a no-training base-model control on the joint-action future-window prompt. It is not a substitute for the missing trained Qwen 3B smoke.

| Model | Examples | Answered | Abstained | Valid JSON | Answer type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Seconds/example |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Qwen/Qwen2.5-3B-Instruct` | 12 | 10 | 2 | 83.3% | 75.0% | 40.0% | 71.4% | 20.6% | 15.0% | 12.51 |

## Interpretation

- This run tests whether the 3B base model can follow the evidence/JSON/citation contract before LoRA training.
- It makes no OpenAI API calls and creates no paid GPU job.
- The paper-critical blocker remains the trained joint-action Qwen 3B smoke plus grounded-correctness judge.
