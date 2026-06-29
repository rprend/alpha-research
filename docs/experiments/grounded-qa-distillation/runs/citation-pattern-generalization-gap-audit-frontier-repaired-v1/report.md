# Citation Pattern Generalization Gap Audit

Generated: 2026-06-29T14:40:19.840Z

Status: `generalization_gap_thresholding_not_coverage`

This audit makes no OpenAI calls and launches no Prime compute.

## D419 vs D420

- D419 new correct candidates: 12
- D419 combined oracle: 70/70
- D420 new correct candidates: 2
- D420 combined oracle: 60/70
- D420 train-heldout: 19/63

## Rescue Breakdown

- D419 rescue rows inspected: 12
- Recovered by D420: 2
- D420 false abstentions: 8
- D420 partial citation errors: 2
- D420 wrong answers: 0
- Rows with same-intent/same-shape grounded train support: 11
- Rows without same-intent/same-shape grounded train support: 1
- By intent: {"dataset":4,"model_comparison":3,"evaluation_metric":2,"architecture_or_chain":1,"numeric":1,"optimization_effect":1}
- By citation shape: {"single_citation":6,"multi_citation":3,"two_citation":3}
- By analog class: {"weak_train_analog_only":11,"no_close_train_analog":1}
- Failure tags: {"has_weak_train_analog":11,"same_intent_same_shape_train_support":11,"d420_false_abstention":8,"single_citation":6,"dataset":4,"model_comparison":3,"multi_citation":3,"two_citation":3,"d420_partial_citation":2,"evaluation_metric":2,"recovered_by_d420":2,"architecture_or_chain":1,"no_close_train_analog":1,"no_same_intent_same_shape_train_support":1,"numeric":1,"optimization_effect":1}

## Decision

- Use saved OpenAI key now: no
- Buy OpenAI judgments now: no
- Launch Prime now: no
- Reason: 8/12 D419 rescues become D420 false abstentions, while 11/12 have same-intent/same-shape grounded train support. This points first to thresholding/features, not missing training coverage.
- Next step: Run a leakage-safe threshold/feature audit over train-heldout analog classes before creating new paid labels or renting GPUs.
