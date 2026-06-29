# Joint-Action Script Contract Audit

Generated: 2026-06-29T08:06:57.906Z

Status: `script_contract_ready_for_paid_smoke`

## Local Commands

| Command | Status |
| --- | ---: |
| `python3 -m py_compile docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/train_joint_action_lora_uv.py` | 0 |
| `python3 -m py_compile docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/eval_joint_action_adapter_uv.py` | 0 |
| `python3 docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/validate_joint_action_dataset_uv.py` | 0 |
| `bash -n docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/run_joint_action_smoke.sh` | 0 |

## Checks

- PASS python_train_compiles: Passed: python3 -m py_compile docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/train_joint_action_lora_uv.py
- PASS python_eval_compiles: Passed: python3 -m py_compile docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/eval_joint_action_adapter_uv.py
- PASS dataset_validator_passes: Passed: python3 docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/validate_joint_action_dataset_uv.py
- PASS runner_bash_syntax_passes: Passed: bash -n docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/run_joint_action_smoke.sh
- PASS trainer_has_bounded_step_hooks: Trainer exposes bounded SFT/DPO step caps.
- PASS trainer_has_no_required_hub_push: Trainer can run with PUSH_TO_HUB=false.
- PASS trainer_saves_dpo_adapter_locally: Trainer saves final DPO adapter for offline eval.
- PASS eval_writes_judge_ready_artifacts: Evaluator writes predictions, summary result, report, and judge next-step.
- PASS eval_makes_no_openai_calls: Evaluator has no OpenAI API import, key, or call site.
- PASS runner_executes_validate_train_eval_manifest: Runner performs validate -> train -> eval -> manifest.
- PASS runner_defaults_are_bounded_and_side_effect_free: Runner defaults to bounded smoke settings and no reporting/hub push.
- PASS runner_points_to_expected_prediction_run: Runner can be invoked for prediction run numeric-teacher-candidate-qwen3b-smoke-v1 through RUN_ID.

## Bounded Smoke Command

```bash
RUN_ID=numeric-teacher-candidate-qwen3b-smoke-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/numeric-teacher-candidate-packet-frontier-repaired-length-reduced-v1/run_joint_action_smoke.sh
```

## Boundary

- This audit does not train Qwen 3B and does not evaluate model quality.
- This audit proves the next paid smoke path is locally coherent and should emit the artifacts required by the integrity and judge gates.
- The paper-readiness blockers remain the actual Qwen 3B predictions and the paid grounded-correctness judge over those predictions.

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
