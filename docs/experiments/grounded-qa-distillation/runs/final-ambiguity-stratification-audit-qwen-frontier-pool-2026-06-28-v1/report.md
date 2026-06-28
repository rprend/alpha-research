# Final Ambiguity Stratification Audit

Generated: 2026-06-28T12:03:16.557Z

This is a zero-call final diagnostic stratification audit. It uses final-window labels only as forbidden diagnostics and makes no training or tuning decision from them.

## Summary

- Final examples: 8
- Final pairwise rows: 61
- Ambiguity-risk examples: 3
- Clean examples: 5
- Ambiguity-risk ids: 2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137, 2004.03744:f33236ebd6f5a9ccb9b9dbf05ac17c3724f93f91, 2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a

## Selector Support By Stratum

- clean:d262: 3/5 selected supported, mean reference overlap 0.8
- clean:boundary_only: 3/5 selected supported, mean reference overlap 0.8
- clean:selected_hybrid: 3/5 selected supported, mean reference overlap 0.8
- ambiguity_risk:d262: 1/3 selected supported, mean reference overlap 0.190476
- ambiguity_risk:boundary_only: 2/3 selected supported, mean reference overlap 0.190476
- ambiguity_risk:selected_hybrid: 1/3 selected supported, mean reference overlap 0.190476

## Example Audit

- 2004.03034:6cdd61ebf84aa742155f4554456cc3233b6ae2bf: risk=false, tags=zero_question_reference_overlap, D262=true, boundary=true, hybrid=true
- 2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137: risk=true, tags=zero_question_reference_overlap,supported_candidates_low_reference_alignment,supported_candidates_low_question_alignment,question_entity_reference_mismatch, D262=false, boundary=true, hybrid=false
- 2004.03744:66bf0d61ffc321f15e7347aaed191223f4ce4b4a: risk=false, tags=zero_question_reference_overlap,supported_candidates_low_question_alignment, D262=false, boundary=false, hybrid=false
- 2004.03744:a08b5018943d4428f067c08077bfff1af3de9703: risk=false, tags=none, D262=false, boundary=false, hybrid=false
- 2004.03744:f33236ebd6f5a9ccb9b9dbf05ac17c3724f93f91: risk=true, tags=zero_question_reference_overlap,supported_candidates_low_reference_alignment,question_scope_metric_mismatch_risk, D262=false, boundary=false, hybrid=false
- 2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a: risk=true, tags=zero_question_reference_overlap,low_reference_cited_coverage,supported_candidates_low_reference_alignment,supported_candidates_low_question_alignment,reference_numeric_format_risk, D262=true, boundary=true, hybrid=true
- 2004.04228:e09dcb6fc163bba7d704178e7edba2e630b573c2: risk=false, tags=none, D262=true, boundary=true, hybrid=true
- 2004.04721:bfc1de5fa4da2f0e301fd22aea19cf01e2bb5b31: risk=false, tags=zero_question_reference_overlap,supported_candidates_low_question_alignment, D262=true, boundary=true, hybrid=true

## Diagnosis

- Primary finding: final_window_contains_ambiguity_risk_rows
- Interpretation: The final-window support metric is partly driven by rows with question/reference or reference/candidate ambiguity, so final selection should be reported with a clean stratum before using it to justify new labels or GPU training.

## Decision

- Integrate boundary selector now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Use ambiguity-risk rows for training: no
- Next step: Treat final-window selector selection as clean-stratified plus ambiguity-risk diagnostic. Use non-final data or curated replacement final rows before buying more labels or launching GPU jobs for this failure mode.
