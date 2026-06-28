# Clean Validation Slice Audit

Generated: 2026-06-28T12:09:56.481Z

This is a zero-call non-final validation audit. It uses no final-window labels for training, tuning, or evaluation.

## Summary

- Validation examples: 9
- Validation pairwise rows: 24
- Clean eval examples: 7
- Ambiguity-risk examples: 2
- Clean eval ids: 2004.01980:41d3750ae666ea5a9cea498ddfb973a8366cccd6, 2004.02334:9aa751aebf6a449d95fb04ceec71688f2ed2cea2:counterfactual-insufficient, 2004.04124:935873b97872820b7b6100d6a785fba286b94900, 1912.02866:20632fc4d2b693b5aabfbbc99ee5c1e9fc485dea, 2004.01820:42eb7c5311fc1ac0344f0b38d3184ccd4faad3be:counterfactual-insufficient, 2004.01820:235c7c7ca719068136928b18e19f9661e0f72806, 2004.01820:c87966e7f497975b76a60f6be50c33d296a4a4e7

## Pair Accuracy

- clean_eval:d262_pool_pairwise: 15/19 correct, accuracy 0.789474, mean abs margin 0.127889
- clean_eval:d262_constrained: 14/19 correct, accuracy 0.736842, mean abs margin 0.355417
- clean_eval:boundary_only: 11/19 correct, accuracy 0.578947, mean abs margin 0.307211
- clean_eval:selected_hybrid: 15/19 correct, accuracy 0.789474, mean abs margin 0.35533
- ambiguity_risk:d262_pool_pairwise: 5/5 correct, accuracy 1, mean abs margin 0.275856
- ambiguity_risk:d262_constrained: 5/5 correct, accuracy 1, mean abs margin 1.192637
- ambiguity_risk:boundary_only: 5/5 correct, accuracy 1, mean abs margin 0.21127
- ambiguity_risk:selected_hybrid: 5/5 correct, accuracy 1, mean abs margin 1.256017

## Tournament Selection

- clean_eval:d262_pool_pairwise: 5/7 selected supported
- clean_eval:d262_constrained: 5/7 selected supported
- clean_eval:boundary_only: 5/7 selected supported
- clean_eval:selected_hybrid: 6/7 selected supported
- ambiguity_risk:d262_pool_pairwise: 2/2 selected supported
- ambiguity_risk:d262_constrained: 2/2 selected supported
- ambiguity_risk:boundary_only: 2/2 selected supported
- ambiguity_risk:selected_hybrid: 2/2 selected supported

## Examples

- 2004.01980:41d3750ae666ea5a9cea498ddfb973a8366cccd6: clean=true, risk=false, pairs=2, candidates=3, difficulty=numeric,list_or_multi_part,unsupported_distractor
- 2004.02214:2df3cd12937591481e85cf78c96a24190ad69e50: clean=false, risk=true, pairs=2, candidates=3, difficulty=numeric,list_or_multi_part,unsupported_distractor
- 2004.02334:9aa751aebf6a449d95fb04ceec71688f2ed2cea2:counterfactual-insufficient: clean=true, risk=false, pairs=2, candidates=3, difficulty=abstention,unsupported_distractor
- 2004.04124:935873b97872820b7b6100d6a785fba286b94900: clean=true, risk=false, pairs=3, candidates=4, difficulty=numeric,list_or_multi_part,unsupported_distractor,near_miss_unsupported
- 1912.02866:20632fc4d2b693b5aabfbbc99ee5c1e9fc485dea: clean=true, risk=false, pairs=3, candidates=4, difficulty=numeric,list_or_multi_part,unsupported_distractor
- 1912.02866:a57e266c936e438aeeab5e8d20d9edd1c15a32ee: clean=false, risk=true, pairs=3, candidates=4, difficulty=numeric,unsupported_distractor
- 2004.01820:42eb7c5311fc1ac0344f0b38d3184ccd4faad3be:counterfactual-insufficient: clean=true, risk=false, pairs=2, candidates=3, difficulty=abstention,unsupported_distractor
- 2004.01820:235c7c7ca719068136928b18e19f9661e0f72806: clean=true, risk=false, pairs=3, candidates=4, difficulty=numeric,list_or_multi_part,unsupported_distractor
- 2004.01820:c87966e7f497975b76a60f6be50c33d296a4a4e7: clean=true, risk=false, pairs=4, candidates=4, difficulty=numeric,list_or_multi_part,unsupported_distractor

## Diagnosis

- Primary finding: clean_nonfinal_validation_slice_is_available
- Interpretation: The clean non-final validation slice does not support promoting boundary-only scoring over D262; it should replace the noisy final diagnostic for immediate selector decisions.

## Decision

- Promote clean validation slice as replacement final eval now: yes
- Integrate boundary selector now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Next step: Use the clean non-final validation slice as the immediate selector diagnostic, then mine or curate more clean held-out examples before any new paid label or GPU run.
