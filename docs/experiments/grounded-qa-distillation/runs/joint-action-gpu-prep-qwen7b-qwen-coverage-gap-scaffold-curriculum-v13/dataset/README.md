# Qwen Coverage-Gap Scaffold Launch Packet

Run: `joint-action-gpu-prep-qwen7b-qwen-coverage-gap-scaffold-curriculum-v13`

This merges the v12 support-targeted packet with v13 Qwen coverage-gap scaffold labels. Final eval prompts remain the unchanged 69-example final window.

Final eval labels are not used for training. The 9 Qwen-miss prompts from the scaffold packet are diagnostic-only and are not merged into train or validation.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | 534 | 1145 |
| Validation | 358 | 670 |
| Eval prompts | 69 | n/a |
