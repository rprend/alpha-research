# Qwen 3B Failure-Driven Curriculum Packet

Source packet: `joint-action-gpu-prep-qwen3b-failure-driven-curriculum-v3`

Failure audit: `support-failure-analysis-qwen7b-v4-smoke-citation-repair-2026-06-27-v1`

This packet keeps the same final eval prompts and does not train on final-window labels. It hardens the instruction contract and adds synthetic DPO hard negatives from train/validation rows.

## Added Pressure

- Synthetic DPO train rows added: 696
- No-citation answer hard negatives: 208
- Spurious insufficient-evidence answer hard negatives: 36

## Failure Signal

```json
{
  "counterfactual_answered": 3,
  "partial_support": 3,
  "unsupported_comparison_or_baseline": 3,
  "unsupported_context_or_annotation": 4,
  "unsupported_task_or_experiment": 4,
  "too_short_or_yes_no": 1,
  "missing_direct_evidence": 5,
  "invalid_citation_id": 1
}
```

## Support-Aware v4 Additions

- Support-aware DPO train rows added: 244
- Support-aware DPO validation rows added: 59
- Train overclaim hard negatives: 208
- Train insufficient-evidence hard negatives: 36

## Coverage-Aware v5 Additions

- Coverage-aware DPO train rows added: 208
- Coverage-aware DPO validation rows added: 53
- Train answer-over-abstain preferences: 208
