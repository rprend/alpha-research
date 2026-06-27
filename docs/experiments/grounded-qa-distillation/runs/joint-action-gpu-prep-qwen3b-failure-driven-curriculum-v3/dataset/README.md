# Qwen 3B Failure-Driven Curriculum Packet

Source packet: `joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2`

Failure audit: `support-failure-analysis-qwen3b-smoke-citation-repair-2026-06-27-v1`

This packet keeps the same final eval prompts and does not train on final-window labels. It hardens the instruction contract and adds synthetic DPO hard negatives from train/validation rows.

## Added Pressure

- Synthetic DPO train rows added: 244
- No-citation answer hard negatives: 208
- Spurious insufficient-evidence answer hard negatives: 36

## Failure Signal

```json
{
  "invalid_citation_id": 23,
  "unsupported_task_or_experiment": 33,
  "too_short_or_yes_no": 38,
  "counterfactual_answered": 16,
  "unsupported_context_or_annotation": 9,
  "unsupported_comparison_or_baseline": 3,
  "missing_direct_evidence": 23,
  "partial_support": 5
}
```
