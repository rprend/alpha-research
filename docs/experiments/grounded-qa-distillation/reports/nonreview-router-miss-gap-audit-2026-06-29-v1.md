# Non-Review Router Miss Gap Audit

Generated: 2026-06-29T19:22:00.608Z

Status: `all_remaining_misses_are_citation_planning`

This zero-spend audit decomposes the remaining D448 coverage-router misses before buying labels or renting Prime GPU.

## Result

- Router misses: 22
- Citation-only misses: 22
- Answer-type misses: 0
- Evidence-first invalid: 0
- Miss families: {"wrong_singleton":8,"partial_multicitation":9,"mixed_wrong_and_missing":2,"overcitation_extra":3}
- Target citation counts: {"1":11,"2":5,"3":3,"4":3}
- Same section-root overlap: 12
- Numeric/table signal: 21
- Subset/group source oracle correct among router misses: 2

## Source Comparison

- Router correct: 42/64
- Subset selector correct: 40/64
- Group scaffold correct: 39/64
- Subset/group union correct: 44/64

## Decision

- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Broaden student training now: no
- Build support-plan packet next: yes
- Reason: 22/22 remaining router misses are citation-set misses with correct answer type and valid evidence-first shape; the gap is evidence planning, not schema, answerability, or raw model scale.
- Next step: Construct a train-only support-plan packet over analogous non-final examples, then retest the router against a strict acceptance criterion above the 47/64 structured-group baseline before spending on Prime or broader OpenAI labels.
- Acceptance criterion: A support-planning scaffold should exceed 47/64 fresh non-review contract correctness and improve multi-citation exactness beyond 3/14 before any GPU rental.
- Spend guardrail: Keep total OpenAI plus Prime/external compute under $100; this audit spent $0.
