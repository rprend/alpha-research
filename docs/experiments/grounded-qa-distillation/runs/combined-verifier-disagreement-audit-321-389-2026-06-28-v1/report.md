# Combined Verifier Disagreement Audit

Generated: 2026-06-28T17:03:41.360Z

Status: `target_completeness_needs_structural_verifier`

This audit makes no API calls. It explains D314 final-window errors before deciding whether to train a student or spend on stronger verifier classes.

## Errors

- Final pairs: 865
- Correct: 598
- Errors: 267
- Near-miss errors: 89
- Confident errors: 20

## Overrepresented Error Tags

- chosen_lower_question_overlap: 77 errors, lift 1.94
- overexpanded_or_equal_rejected: 133 errors, lift 1.54
- unsupported_claim_available: 52 errors, lift 1.39
- chosen_fewer_citations: 72 errors, lift 1.32
- similar_answer_length: 93 errors, lift 1.27
- similar_claim_count: 201 errors, lift 1.13
- list_or_entity_scope: 230 errors, lift 1.07
- similar_citation_count: 234 errors, lift 0.98

## Decision

- Promote combined text verifier now: no
- Buy more same-style labels now: no
- Launch GPU now: no
- Reason: D314 leaves 267 final errors, with 89 near-miss errors and overrepresentation of chosen_lower_question_overlap and qwen7b->other; the failure mode is structural target matching rather than lack of same-style labels.
- Next step: Prototype a structural target-completeness verifier using parsed question requirements, answer slot coverage, and citation-supported slot extraction; do not train a student yet.
