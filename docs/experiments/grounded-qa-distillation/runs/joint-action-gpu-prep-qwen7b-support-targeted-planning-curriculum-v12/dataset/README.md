# Support-Targeted Planning Launch Packet

Run: `joint-action-gpu-prep-qwen7b-support-targeted-planning-curriculum-v12`

This merges v11 mixed-metric labels with flattened v12 support-targeted planning labels. Final eval prompts remain the unchanged 69-example final window.

Final eval labels are not used for training.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | 387 | 888 |
| Validation | 216 | 431 |
| Eval prompts | 69 | n/a |
