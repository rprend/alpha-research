# Grounded QA Joint-Action Curriculum Packet

This packet is generated from `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1` and keeps the same final eval prompts.

The only change is train-time oversampling:

- Supported-answer SFT rows: 1x
- Repair SFT rows: 3x
- Abstention SFT rows: 3x
- Repair DPO rows: 3x
- Abstention DPO rows: 3x

Rationale: Final-window unsupported direct answers are mostly answer repair/regeneration or abstention cases, not citation-only repair. Oversample those action rows before the bounded Qwen 3B smoke.
