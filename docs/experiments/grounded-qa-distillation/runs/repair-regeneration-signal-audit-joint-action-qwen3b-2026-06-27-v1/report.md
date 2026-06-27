# Repair/Regeneration Signal Audit

Generated: 2026-06-27T02:49:44.777Z

Status: `repair_regeneration_signal_present_but_untested`

This zero-cost audit checks whether the Qwen 3B joint-action packet has explicit repair/regeneration supervision, not just abstention or selection pressure.

## Oracle Gap

The candidate-pool oracle found 34 of 69 final-window examples with no supported-answer candidate. Selection-only routing is therefore marked sufficient: `false`.

## Signal Summary

| Split | Rows | Repair chosen | Abstain chosen | Grounded missing inline citations | Invalid citations |
| --- | ---: | ---: | ---: | ---: | ---: |
| DPO train | 59 | 41 | 18 | 0 | 0 |
| DPO validation | 21 | 15 | 6 | 0 | 0 |

| Split | Rows | Supported-answer SFT | Repair SFT | Abstain SFT | Invalid citations |
| --- | ---: | ---: | ---: | ---: | ---: |
| SFT train | 185 | 126 | 41 | 18 | 0 |
| SFT validation | 59 | 38 | 15 | 6 | 0 |

Train repair rows cover oracle gap: `true` (41 train repair rows vs. 34 missing-supported-candidate examples).

## Unsupported Direct Answer Repairability

| Unsupported direct answers | Citation-repair candidates | Answer repair/regeneration needed | Should abstain |
| ---: | ---: | ---: | ---: |
| 19 | 1 | 12 | 6 |

Keep the Qwen joint-action packet focused on answer repair/regeneration plus abstention; citation repair alone explains only a minority of unsupported final-window direct answers.


## Checks

- PASS packet_is_joint_action_qwen3b: Packet objective includes repair/regeneration action.
- PASS oracle_requires_repair_regeneration: Candidate-pool oracle reports 34 examples with no supported-answer candidate.
- PASS unsupported_answers_need_repair_regeneration: 12 unsupported direct answers need answer repair/regeneration versus 1 citation-repair candidates.
- PASS dpo_has_repair_contrasts: 41 train repair DPO rows versus 34 oracle missing-supported-candidate examples.
- PASS dpo_has_abstention_contrasts: 18 train and 6 validation abstention DPO rows.
- PASS grounded_chosen_outputs_are_cited: Every grounded DPO chosen output has non-empty citations and inline citation markers.
- PASS grounded_chosen_citations_in_evidence_pack: Every grounded DPO chosen citation id appears in its evidence pack.
- PASS repair_contrasts_are_not_identical_selection: No repair-labeled DPO row has identical chosen and rejected answer text.
- PASS sft_contains_joint_actions: 126 supported-answer, 41 repair, and 18 abstention SFT train rows.
- PASS eval_is_disjoint_from_train_validation_papers: Eval prompts are paper-disjoint from train and validation rows.

## Interpretation

This audit checks label signal, final-window repairability pressure, and split integrity only. It does not prove that Qwen 3B will learn repair/regeneration or preserve grounded correctness after LoRA training.

Next step: When remote auth is repaired, run the bounded Qwen 3B smoke and the paid grounded-correctness judge; do not spend budget adding selection-only routing data first.

This audit makes no OpenAI calls, launches no GPU jobs, and records no new spend.
