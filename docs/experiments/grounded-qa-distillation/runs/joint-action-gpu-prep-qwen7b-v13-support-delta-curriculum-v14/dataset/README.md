# V13 Support-Delta Launch Packet

Run: `joint-action-gpu-prep-qwen7b-v13-support-delta-curriculum-v14`

This merges the v12 support-targeted packet with v14 support-delta supervision. The failed v13 broad coverage-gap labels are not carried forward. Final eval prompts remain the unchanged 69-example final window.

Final eval labels are not used for training. V13 diagnostic rows from the support-delta packet are diagnostic-only and are not merged into train or validation.

## Counts

| Split | SFT | DPO |
| --- | ---: | ---: |
| Train | 547 | 1480 |
| Validation | 371 | 1005 |
| Eval prompts | 69 | n/a |
