# Hard Grounded Research Paper Claim Ledger

This generated ledger maps paper claims to current evidence and release gates. It is designed to prevent the manuscript from implying completion while human review, category scale, or final novelty gates remain blocked.

## Summary

- Claim ledger ready: true
- Completion claim allowed: false
- Claims: 8
- Allowed claims: 4
- Diagnostic-only claims: 2
- Prohibited claims: 2
- Blocked claims: 0

## Claim Status

| Claim id | Status | Claim | Blocked by |
| --- | --- | --- | --- |
| taxonomy_scope_claim | allowed | The benchmark operationalizes 10 hard-grounded research categories beyond simple fact lookup. | none |
| hf_grounding_claim | allowed | The benchmark is grounded in Hugging Face datasets and fetched source rows rather than only hand-written toy examples. | none |
| large_corpus_design_claim | diagnostic_only | The current artifacts define a large-corpus source-diversity target and executable acquisition substrate. | source acquisition reviews are not complete |
| baseline_diagnostic_claim | diagnostic_only | Pilot baselines expose qualitative failure modes that motivate the hard-grounded taxonomy. | pilot-only baselines are diagnostic until rerun on the HF-derived scale suite |
| category_effect_claim | prohibited_until_gates_pass | Category-level differences identify which grounded-research tasks are hardest. | none |
| publishable_gold_claim | allowed | The benchmark has HF-derived labels for paper-scale evaluation. | none |
| annotation_quality_claim | allowed | The annotation workflow has pre-registered quality-control rules for reviewer eligibility and label admissibility. | none |
| novelty_completion_claim | prohibited_until_gates_pass | The benchmark is genuinely novel as of June 2026 and ready for completion/submission. | novelty_audit_final |
