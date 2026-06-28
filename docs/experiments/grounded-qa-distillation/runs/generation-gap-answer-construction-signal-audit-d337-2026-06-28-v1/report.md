# Generation-Gap Answer-Construction Signal Audit

Status: `answer_construction_signal_gap_identified`

This run makes no OpenAI calls and launches no Prime job.

## Summary

- Eval examples: 10
- Answerable eval examples: 7
- D336 answerable span-recoverable examples: 3
- D336 answerable span-nonrecoverable examples: 4
- Final target forms: {"yes_no_polarity":3,"multi_citation_synthesis":3,"abstention":3,"list_or_structured_answer":1}
- Nonrecoverable target forms: {"yes_no_polarity":3,"multi_citation_synthesis":1}
- Missing training signals: yes_no_polarity_preferences, multi_citation_synthesis_preferences, question_target_hard_negative_preferences

## D329 Signals

- DPO rows inspected: 1248
- Has short-answer negative: yes
- Has overcitation negative: yes
- Has yes/no polarity signal: no
- Has multi-citation synthesis signal: no
- Has question-target hard-negative signal: no

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Materialize a generation-gap answer-construction packet with explicit yes/no polarity, multi-citation synthesis, and question-target hard-negative preferences before any new Prime run.
- Reason: D329 contains broad short-answer and overcitation negatives, but D336 failures need form-specific construction signals that are absent from the existing packet.
