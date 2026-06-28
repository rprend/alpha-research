# Support Verifier Readiness Audit

This audit reconciles existing verifier and selector artifacts before spending on another label batch or GPU run.

## Readiness

- Status: balanced_support_verifier_packet_needed
- Qwen-frontier selected support: 62.5%
- Qwen-frontier oracle support: 100.0%
- Claim verifier final selection: 37.5%
- Claim-NLI verifier final selection: 37.5%
- Boundary signal agreement: 66.7%
- Launch GPU now: no
- Buy OpenAI labels now: no

## Evidence

| Source | Finding | Metric | Value |
| --- | --- | --- | --- |
| final-selector-ceiling-audit-2026-06-28-v1 | cheap_frontier_selector_ceiling_gap | best_qwen_frontier_selection_vs_oracle | 0.625/1 |
| claim-support-verifier-qwen-frontier-pool-2026-06-28-v1 | lexical_claim_verifier_anti_transfer | final_diagnostic_selection | 3/8 |
| claim-nli-support-verifier-qwen-frontier-pool-2026-06-28-v1 | local_nli_claim_verifier_anti_transfer | final_diagnostic_selection | 3/8 |
| targeted-boundary-adjudication-run-gpt4o-qwen-frontier-pool-2026-06-28-v1 | boundary_label_disagreement | existing_signal_exact_agreement_rate | 0.6666666666666666 |
| targeted-packet-learner-transfer-audit-0-160-to-240-320-to-321-389-2026-06-28-v1 | targeted_packet_needs_broad_preservation | status | targeted_learner_unstable_final_neutral_not_promoted |
| final-miss-repairability-audit-321-389-2026-06-28-v1 | final_misses_are_recoverable_selector_gap | misses_with_supported_candidate | 5/5 |

## Decision

The cheap frontier pool has supported candidates, but existing lexical/NLI verifier targets anti-transfer and targeted boundary labels show disagreement; the next target needs balanced preservation plus final-like hard negatives before any GPU run.

Next step: Materialize a zero-cost balanced support-verifier packet that mixes broad preservation examples with targeted overexpansion/same-citation hard negatives, then run a transfer probe.
