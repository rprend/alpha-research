# Generation-Gap Form-Specific Construction Packet

Status: `ready_for_local_dataset_validation`

This packet makes no OpenAI calls and launches no Prime job.

## Source Signal

- D337 status: `answer_construction_signal_gap_identified`
- Missing signals: yes_no_polarity_preferences, multi_citation_synthesis_preferences, question_target_hard_negative_preferences
- Nonrecoverable target forms: {"yes_no_polarity":3,"multi_citation_synthesis":1}

## Examples

- SFT train: 240
- SFT validation: 75
- DPO train: 1156
- DPO validation: 348
- Added DPO train: 205
- Added DPO validation: 51

## Added Preference Types

- prefer_answer_target_over_supported_but_wrong_target_fact: 143
- prefer_correct_yes_no_polarity_over_flipped_polarity: 27
- prefer_multi_citation_synthesis_over_single_evidence_fragment: 86

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Next step: Run the local dataset validator and a launch preflight for D338. If both pass under the $100 cap, use Prime for a bounded smoke rather than rerunning D329.
- Reason: This packet directly targets the D336/D337 failure forms, but this step only materializes and validates zero-cost training data.
