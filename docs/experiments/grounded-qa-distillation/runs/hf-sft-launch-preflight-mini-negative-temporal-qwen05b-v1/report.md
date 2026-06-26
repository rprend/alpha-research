# HF SFT Launch Preflight

## Scope

SFT prep run: `hf-sft-temporal-prep-mini-negative-161-320-to-321-389-qwen05b-v1`

This preflight checks whether the leakage-safe temporal SFT packet can be launched now.

## Packet

| Item | Value |
| --- | --- |
| Teacher labels | `teacher-mini-negative-future-holdout-160-389-v1` |
| Train windows | `161-240, 241-320` |
| Eval window | `321-389` |
| Train rows | 113 |
| Validation rows | 19 |
| Eval prompts | 69 |
| Base model | `Qwen/Qwen2.5-0.5B-Instruct` |
| Hub model | `rprendergast/grounded-qa-qasper-mini-negative-temporal-qwen05b-lora-v1` |
| Estimated HF cost | $0.5625 |

## Checks

| Check | Result |
| --- | --- |
| Dataset validator | passed |
| Training script compile | passed |
| HF Jobs preflight | blocked |

## Local Dependencies

| Module | State |
| --- | --- |
| torch | present |
| transformers | present |
| datasets | missing |
| accelerate | missing |
| peft | missing |
| trl | missing |
| trackio | missing |

## Conclusion

Status: `blocked_by_hf_jobs_credits`

Next step: Add prepaid Hugging Face Jobs credits or run the packet on another backend with TRL/PEFT dependencies.
