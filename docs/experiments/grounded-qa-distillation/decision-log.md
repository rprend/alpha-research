# Grounded QA Distillation Decision Log

This log records decision points that affect spend, labels, GPU usage, or paper-claim direction. Detailed artifacts remain under `docs/experiments/grounded-qa-distillation/runs/`.

## 2026-06-28: D309 Target-Completeness Labels

- Artifact: `question-target-label-batch-run-gpt4o-mini-2026-06-28-v1`
- Decision: use the saved OpenAI key and run the prepared 87-call D308 target-completeness batch; do not use Prime Intellect or GPU.
- Spend: 87 OpenAI calls, `$0.01607055`; total tracked spend moved from `$13.5076056` to `$13.52367615` out of the `$100` cap.
- Result: 79/79 primary chosen candidates were judged question-target complete; 8/79 rejected candidates were also complete; 76/79 primary preferences favored the chosen candidate. Duplicate calibration preference matched 8/8, exact schema matched 6/8.
- Interpretation: the missing signal is real enough to integrate as supervision, but only through a transfer-tested verifier/scaffold.

## 2026-06-28: D310 Target-Selector Transfer Audit

- Artifact: `question-target-selector-transfer-audit-0-320-to-321-389-2026-06-28-v1`
- Decision: reject a scalar surface-feature selector, do not buy more labels, and do not launch GPU.
- Result: the best policy selected by non-final D309 labels reached 70/77 train-correct decisions (90.9%) but only 387/838 correct final heldout pair decisions (46.2%).
- Interpretation: the D309 labels are useful supervision, but simple proxies such as citation count, answer length, and claim count anti-transfer. The next aligned step is a richer text-pair question-target verifier target, not Prime/GPU training.

## 2026-06-28: D311 Local Text-Verifier Audit

- Artifact: `question-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1`
- Decision: reject the local TF-IDF/logistic text verifier, do not train on GPU, do not buy more labels immediately, and do not use Prime Intellect.
- Result: the best local text verifier reached 591/865 final heldout pair decisions (68.3%), better than the D310 scalar-selected policy, but only 50.1% balanced leave-one-out accuracy on the D309 non-final labels.
- Interpretation: the verifier target is directionally useful but the D309 label distribution is too narrow and unstable for a deployable verifier. The next batch should be harder and more final-like rather than larger for its own sake.

## 2026-06-28: D312 Hard Target Label Batch Plan

- Artifact: `hard-target-label-batch-plan-2026-06-28-v1`
- Decision: prepare a harder 108-request target-completeness label batch, but do not run labels or GPU in the planning step.
- Spend: zero new calls; estimated OpenAI spend is `$0.054255`, or `$0.10851` with a 2x safety margin.
- Result: the planner found 96 primary leakage-safe non-final rows, plus 12 calibration duplicates, selected to resemble D311 final-error strata. The batch emphasizes numeric targets, list/entity scope, similar citation/claim counts, overexpanded rejected answers, and unsupported-claim availability.
- Interpretation: this is the right next paid step before any Prime/GPU work. If the harder batch improves local verifier reliability, then verifier/scaffold integration is justified; otherwise the paper should report the negative target-completeness transfer result rather than train a larger student prematurely.

## 2026-06-28: D313 Hard Target Label Batch Run

- Artifact: `hard-target-label-batch-run-gpt4o-mini-2026-06-28-v1`
- Decision: run the 108-request hard target-completeness batch with the saved OpenAI key, but do not use Prime Intellect or GPU.
- Spend: 108 OpenAI calls, `$0.0216522`; total tracked spend moved from `$13.52367615` to `$13.54532835` out of the `$100` cap.
- Result: 91/96 primary chosen candidates were target-complete, 8/96 rejected candidates were also complete, and 84/96 primary preferences favored the chosen candidate. Duplicate calibration preference matched 12/12 and exact schema matched 11/12.
- Interpretation: the harder batch is stable and gives useful additional supervision, but it must improve verifier reliability before any student/GPU training is justified.

## 2026-06-28: D314 Combined Target Text-Verifier Audit

- Artifact: `combined-target-text-verifier-audit-0-320-to-321-389-2026-06-28-v1`
- Decision: reject the combined local TF-IDF/logistic verifier for promotion, do not buy more labels immediately, and do not launch GPU.
- Result: adding D313 to D309 increased balanced leave-one-out accuracy from 50.1% to 58.8% and final pair transfer from 68.3% to 69.1%, but still missed the 65% reliability / 70% transfer promotion threshold.
- Interpretation: harder labels helped, but target-completeness is not yet captured by the local text verifier. The next step is disagreement analysis or a stronger verifier class, not Qwen student training.

## 2026-06-28: D315 Combined Verifier Disagreement Audit

- Artifact: `combined-verifier-disagreement-audit-321-389-2026-06-28-v1`
- Decision: reject immediate combined-verifier promotion, reject more same-style labels, and do not launch Prime/GPU for student training yet.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: D314 left 267/865 final heldout pair errors. Of those, 89 were near misses with absolute margin below 0.02 and 20 were confident errors with absolute margin at least 0.10. Overrepresented error signals were chosen-lower-question-overlap, overexpanded/equal rejected answers, unsupported-claim availability, and qwen7b-family comparison pairs.
- Interpretation: the remaining failure mode is structural target completeness, not simply a shortage of labels or GPU scale. The next step is a structural verifier that parses question requirements, checks answer slot coverage, and verifies citation-supported slot extraction before any student training run.

## 2026-06-28: D316 Structural Target Verifier Audit

- Artifact: `structural-target-verifier-audit-0-320-to-321-389-2026-06-28-v1`
- Decision: promote the structural target-completeness verifier as a scaffold component, but do not train a student, buy more labels, or launch Prime/GPU yet.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: the leakage-safe selected policy `strict_citation_slots_t_0p66` reached 78.1% balanced accuracy on the D309+D313 non-final labels and 728/865 final heldout pair transfer accuracy (84.2%). Relative to D314, it improved final transfer by 15.0 percentage points, rescued 213 D314 errors, and lost 83 D314-correct pairs.
- Interpretation: D315's structural-target hypothesis is confirmed strongly enough for scaffold integration. The next run should integrate this structural verifier into the answer-selection scaffold and rerun final system evaluation before any GPU student training.

## 2026-06-28: D317 Structural Verifier Selector Integration

- Artifact: `structural-verifier-selector-integration-final-window-2026-06-28-v1`
- Decision: do not integrate the structural verifier as the deployable selector yet, do not replace the calibrated hybrid, and do not launch Prime/GPU.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: structural abstention switching increased answer rate to 78.3% and supported answers to 36, but answer support fell to 66.7% and overall judged correctness fell to 73.9% versus the calibrated hybrid's 71.0% answer rate, 71.4% answer support, and 79.7% overall correctness. The structural switch made 12 changes from scaffold priority, including 5 supported-answer switches, 7 unsupported-answer switches, and 7 harmful switches from correct baseline rows.
- Interpretation: D316's pairwise verifier signal does not directly solve listwise answer selection. The next step should tune a non-final selector objective that combines structural target score with abstention-preservation/support guards before replacing the calibrated hybrid or training a student.

## 2026-06-28: D318 Structural Cross-Window Selector

- Artifact: `structural-cross-window-selector-240-320-to-321-389-2026-06-28-v1`
- Decision: do not promote the structural cross-window selector, do not replace the calibrated hybrid, and do not launch Prime/GPU.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: no support-plus-structural threshold rule in the 240-320 search grid preserved the 70% answer-rate floor, so the fallback direct rule was selected. On 321-389 it reached 76.8% answer rate, 64.2% answer support, and 72.5% overall correctness, below the calibrated hybrid's 71.0% answer rate, 71.4% answer support, and 79.7% overall correctness.
- Interpretation: structural target score is useful supervision and pairwise evidence, but current threshold-style listwise selectors cannot use it safely. The next selector work should build a larger non-final listwise packet with explicit abstention-preservation and support-boundary labels, or keep the calibrated hybrid while shifting effort back to generation/repair rather than another hand-tuned selector.

## 2026-06-28: D319 Current Readiness Audit

- Artifact: `current-readiness-audit-2026-06-28-v1`
- Decision: the project is not NeurIPS-ready, do not train/rent GPU immediately, do not buy more labels immediately, and keep the calibrated hybrid as the current deployable selector baseline.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: 5/8 current readiness requirements passed. The calibrated hybrid remains the best deployable final-window surface at 71.0% answer rate, 71.4% answer support, and 79.7% overall judged correctness. The structural verifier component is strong at 78.1% non-final balanced accuracy and 84.2% final pair transfer, but selector integrations failed. The best Qwen 3B integration is still negative at 65.2% answer rate, 33.3% answer support, and 56.5% overall correctness; Qwen 7B v14 is also negative at 73.9% answer rate, 39.2% answer support, and 55.1% overall correctness.
- Interpretation: the current blockers are not secret access or GPU availability; they are support-preserving generation/repair quality and judge reliability. The next research step should be either a larger non-final listwise packet with explicit support/abstention-boundary labels or a bounded generation/repair experiment designed to beat the calibrated hybrid, plus adjudication/caveats for model-judged correctness.

## 2026-06-28: D320 Oracle Gap Decomposition

- Artifact: `oracle-gap-decomposition-calibrated-hybrid-final-window-2026-06-28-v1`
- Decision: do not launch Prime/GPU for a selector-only run, do not buy more OpenAI labels now, and keep the calibrated hybrid as the answer-rate baseline while shifting the next packet toward support-preserving candidate generation/repair.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: the qwen-switch oracle improves over the calibrated hybrid by only 3 net judged-correct rows and 4 supported answers on the full 69-example final window. Of the calibrated misses, 4 have a supported answer candidate already present, but 10 are candidate-generation gaps with no supported candidate in the current pool. The local heuristic top candidate is judged correct on only 53.6% of rows and, when supported answer candidates exist, ranks one first 77.8% of the time.
- Interpretation: a selector-only spend path has too little headroom and too much ranking instability to justify Prime now. The next experiment should construct or train candidate generation/repair that creates additional supported answers, then revisit Prime only when that packet can plausibly expand the oracle frontier rather than merely select among the same candidates.

## 2026-06-28: D321 Generation Gap Curriculum Packet

- Artifact: `generation-gap-curriculum-packet-d320-final-gaps-2026-06-28-v1`
- Decision: use the packet for the next bounded generation-gap preflight, but do not launch Prime/GPU or buy OpenAI labels until the eval harness is fixed and the packet passes validation.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: the D320 no-supported-candidate set contains 10 final prompts: 7 answerable rows and 3 abstention rows, including 2 counterfactual insufficiency rows. The packet writes 240 train SFT rows, 397 train DPO rows, 75 validation SFT rows, 124 validation DPO rows, and 10 final diagnostic eval prompts with targets kept diagnostic-only. Validation excludes 5 validation rows that share final-eval paper ids.
- Interpretation: the next model-side run should not be a broad student-training attempt. It should be a small generation/repair preflight that tests whether this packet can create supported candidates for the 7 answerable final gaps while preserving abstention on the 3 insufficiency gaps.

## 2026-06-28: D322 Generation Gap Eval Harness

- Artifact: `generation-gap-eval-harness-d321-fixture-2026-06-28-v1`
- Decision: the fixed evaluation harness is ready for model predictions, but do not launch Prime or buy OpenAI judgments yet.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: the harness scored the 10 D321 final diagnostic prompts in oracle-fixture mode and reached 100% parseable predictions, answer-type accuracy, citation-set exactness, answerable supported-shape rate, abstention-shape rate, and overall shape correctness. It also writes a prediction template and per-example scored rows for future local/Prime model outputs.
- Interpretation: D321's missing harness blocker is cleared. The next run can be a bounded generation preflight that emits predictions in this schema; only if it clears the shape gate should we spend on grounded-correctness judging or a larger Prime run.

## 2026-06-28: D323 Local Extractive Generation-Gap Preflight

- Artifact: `generation-gap-local-extractive-preflight-d321-2026-06-28-v1`
- Decision: reject the zero-spend extractive scaffold for the D320 generation gaps, do not buy OpenAI judgments for it, and do not launch Prime to scale this extractor.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: the extractor produced parseable JSON for all 10 D321 prompts and matched the 7/3 answer/abstain count, but failed the D322 shape gate: 80.0% answer-type accuracy, 0.0% answerable supported-shape rate, 66.7% abstention-shape rate, 20.0% citation-set exactness, 5.3% mean answer token F1, and 20.0% overall shape correctness.
- Interpretation: deterministic extraction is not a sufficient cheap scaffold for the no-supported-candidate gaps. The next model-side step should be a small trained generation/repair preflight using D321's SFT/DPO packet, then the D322 harness before any paid grounded-correctness judging.

## 2026-06-28: D324 Trained Evidence Generation-Gap Preflight

- Artifact: `generation-gap-trained-evidence-preflight-d321-2026-06-28-v1`
- Decision: reject the local trained evidence scorer, do not buy OpenAI judgments for it, and do not launch Prime to scale this scorer.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: the local logistic evidence scorer trained on 240 non-final SFT rows and selected threshold `1` on 75 validation prompts, which maximized the shape proxy by abstaining everywhere. On the 10 final D321 diagnostic prompts it produced 10 abstentions, 0 grounded answers, 30.0% answer-type accuracy, 0.0% answerable supported-shape rate, 100.0% abstention-shape rate, 30.0% citation-set exactness, and 30.0% overall shape correctness. The best non-all-abstain validation threshold (`0.8`) still had only 30.7% shape proxy, so this is not a threshold-selection accident.
- Interpretation: shallow evidence scoring protects insufficiency by collapsing to abstention, but it does not create supported answers for the 7 answerable generation gaps. The next aligned experiment is a bounded small adapter/generator preflight using the D321 SFT/DPO packet, with D322 shape-gate scoring before any paid grounded-correctness judging or larger Prime run.

## 2026-06-28: D325 Local Generative Adapter Probe And Prime Recheck

- Artifacts: `local-generative-sft-generation-gap-qwen05b-24train-1epoch-d321-v1`, `generation-gap-local-generative-sft-qwen05b-24train-d321-2026-06-28-v1-shape-eval`, and `prime-auth-price-gate-generation-gap-qwen3b-2026-06-28-v1`
- Decision: reject the tiny local Qwen 0.5B adapter probe, do not buy OpenAI judgments for it, and do not create a Prime pod until a live GPU resource gate passes for the selected resource type.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.54532835` out of the `$100` cap.
- Result: the local Qwen 0.5B LoRA probe trained 24 materialized rows from the D321 generation-gap packet on MPS for 6 optimizer steps. It generated 10 final diagnostic predictions, answered 0, abstained 10, and produced only 60.0% valid JSON before normalization. The D322 shape harness scored it at 30.0% answer-type accuracy, 0.0% answerable supported-shape rate, 0.0% abstention-shape rate, 30.0% citation-set exactness, and 0.0% overall shape correctness. A read-only Prime recheck showed `whoami`, wallet, and availability commands passing, estimated total spend after a one-hour GPU plus small judge reserve at `$17.79532835` under the `$100` cap, but parsed no available L4 resource.
- Interpretation: the 0.5B local smoke is too small and undertrained to learn the JSON/citation contract, so it should not be judged or used as paper evidence beyond a negative control. The next GPU-worthy path is a full D321 SFT/DPO launch packet on a larger Qwen model, but Prime launch must first rerun the auth/price gate with an available GPU resource type and fail closed under the same budget ledger.

## 2026-06-28: D326 Generation-Gap Qwen 3B Prime Launch Packet

- Artifacts: `generation-gap-qwen3b-sft-dpo-launch-packet-d321-2026-06-28-v1`, `joint-action-launch-preflight-generation-gap-qwen3b-sft-dpo-d321-v1`, `joint-action-launch-plan-prime-generation-gap-qwen3b-sft-dpo-d321-v1`, `prime-auth-price-gate-generation-gap-a6000-2026-06-28-v1`, `prime-auth-price-gate-generation-gap-l40s-2026-06-28-v1`, and `prime-auth-price-gate-generation-gap-rtx4090-2026-06-28-v1`
- Decision: prepare and ledger a bounded Prime Qwen 3B SFT/DPO smoke for the D321 generation-gap packet, but do not create a pod until the packet is committed/pushed and a fresh live resource id is selected immediately before launch.
- Spend: zero new OpenAI calls and zero actual external compute; the spend ledger records a planned `$1.00` Prime smoke estimate with `cost_usd: 0`. Total actual spend remains `$13.54532835` out of the `$100` cap.
- Result: read-only Prime gates pass for valid enum resource types. The cheapest parsed `A6000_48GB` option is `$0.2135/hour`, the cheapest parsed `L40S_48GB` option is `$0.4795/hour`, and both remain under budget with a small judge reserve. The D321 launch packet has 240 SFT train rows, 75 SFT validation rows, 397 DPO train rows, 124 DPO validation rows, and 10 final diagnostic eval prompts. Dataset validation and Python compile checks pass; all SFT/DPO/eval prompt profiles fit the configured 1536/1280 approximate-token limits with zero rows over limit. Local runtime still lacks the remote TRL/PEFT stack, so execution belongs on the Prime GPU environment.
- Interpretation: the path is now operationally ready for a bounded larger-model smoke. The next action should be pod creation on a freshly rechecked 48GB resource, remote execution of `run_joint_action_smoke.sh`, immediate artifact fetch and pod termination, actual spend finalization, then D322 shape scoring before any OpenAI grounded-correctness judging.

## 2026-06-28: D327 Generation-Gap Qwen 3B Prime Smoke Outcome

- Artifacts: `generation-gap-qwen3b-sft-dpo-smoke-d321-v1` and `generation-gap-qwen3b-sft-dpo-smoke-d321-v1-shape-eval`
- Decision: reject the bounded Qwen 3B SFT/DPO smoke for grounded-correctness judging, do not buy OpenAI judgments for it, and do not scale this exact D321 objective without a citation-format/contract repair stage.
- Spend: zero new OpenAI calls. Actual Prime compute spend was `$0.07` for pod `3109f96d8f974bf8b6ccd84fd8a03025`, increasing total tracked spend to `$13.61532835` out of the `$100` cap.
- Result: the Prime smoke trained `Qwen/Qwen2.5-3B-Instruct` with 20 SFT steps and 10 DPO steps on an A6000 48GB pod, fetched artifacts, and terminated the pod. The model produced valid JSON for all 10 final diagnostic prompts and answered all 10. Reference-shape scoring before the D322 harness showed 70.0% answer-type accuracy, 35.0% citation precision, 42.9% citation recall, 28.6% answer token F1, and 0.0% inline citation rate. The D322 shape harness failed it: 100.0% parseable predictions, 70.0% answer-type accuracy, 0.0% answerable supported-shape rate, 0.0% abstention-shape rate, 20.0% citation-set exactness, 0.0 mean answer-token F1, and 0.0% overall shape correctness.
- Interpretation: moving from 0.5B local to 3B GPU training fixes parseability and makes the model answer, but it still does not preserve the inline citation/support contract. The next aligned experiment should not be more unconstrained SFT/DPO steps; it should add a local citation-contract repair/normalization stage or train with stricter answer templates and citation-token loss before any grounded-correctness judging.

## 2026-06-28: D328 Generation-Gap Citation Contract Repair

- Artifacts: `generation-gap-citation-repair-qwen3b-sft-dpo-smoke-d321-v1` and `generation-gap-citation-repair-qwen3b-sft-dpo-smoke-d321-v1-shape-eval`
- Decision: reject the repaired Qwen 3B predictions for paid grounded-correctness judging, do not launch another Prime run for surface formatting alone, and shift the next experiment toward abstention/semantic support repair.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.61532835` out of the `$100` cap.
- Result: local repair normalized citation ids, made all 10 grounded predictions inline-citation complete, and preserved all answer decisions. The D322 shape score improved from 0.0% to 20.0% overall: 100.0% parseable predictions, 70.0% answer-type accuracy, 28.6% answerable supported-shape rate, 0.0% abstention-shape rate, 20.0% citation-set exactness, 28.6% mean answer-token F1, and 20.0% overall shape correctness.
- Interpretation: citation-surface repair rescues the two yes/no rows but does not solve the real blocker. The model over-answers all 3 insufficiency prompts and most answerable rows have wrong answer content or wrong citations. The next aligned step should be a support-risk/abstention gate or training packet that explicitly penalizes over-answering and wrong-citation answers, not a larger paid judge pass on these predictions.

## 2026-06-28: D329 Generation-Gap Support-Risk Gate

- Artifacts: `generation-gap-support-risk-gate-qwen3b-sft-dpo-smoke-d321-v1` and `generation-gap-support-risk-gate-qwen3b-sft-dpo-smoke-d321-v1-shape-eval`
- Decision: reject the gated Qwen 3B predictions for paid grounded-correctness judging, do not launch Prime from this checkpoint, and treat the gate as evidence that abstention control is recoverable while answer construction remains the bottleneck.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.61532835` out of the `$100` cap.
- Result: the local gate used only the repaired predictions and eval prompts/evidence, not final diagnostic targets. It kept 2 low-risk yes/no grounded answers, converted 8 risky answers to abstention, and made 8 answer-decision changes. The D322 shape harness still failed the model predictions, but improved the shape score to 50.0% overall: 100.0% parseable predictions, 50.0% answer-type accuracy, 28.6% answerable supported-shape rate, 100.0% abstention-shape rate, 50.0% citation-set exactness, and 100.0% mean answer-token F1 on kept answers.
- Interpretation: the support-risk scaffold can prevent over-answering the insufficiency rows, but it buys correctness by suppressing 5 of the 7 answerable gaps. The next experiment should mine these suppressed answerable rows into hard-negative/positive training pairs: reward compact answers with exact cited support, penalize generic empty claim tables, one-token non-boolean answers, over-citation, and answers whose cited evidence does not cover the requested target.

## 2026-06-28: D330 Generation-Gap Failure-Driven Packet

- Artifacts: `generation-gap-failure-driven-packet-d329-2026-06-28-v1` and `joint-action-launch-preflight-generation-gap-failure-driven-d329-2048-v1`
- Decision: materialize and validate a D329-driven Qwen 3B training packet, but do not launch Prime until the packet is committed/pushed and a fresh live resource id is selected under the `$100` cap.
- Spend: zero new OpenAI calls and zero new external compute; total tracked spend remains `$13.61532835` out of the `$100` cap.
- Result: the packet keeps the 240 SFT train rows, 75 SFT validation rows, and 10 final diagnostic eval prompts from D321, and expands DPO from 397/124 to 951/297 train/validation rows. The 727 added preferences include 206 answer-over-abstain rows when local answerability hints indicate sufficient evidence, 206 too-short-answer negatives, 206 over-cited generic-claim negatives, and 109 spurious cited-answer negatives for abstention examples. The copied dataset validator passes. A 2048/1536 launch preflight passes dataset validation, Python compile, launch-safety checks, and prompt-length checks with zero rows over limit; local runtime is still missing Transformers/Datasets/PEFT/TRL/Accelerate, so training belongs on Prime or another remote GPU.
- Interpretation: D330 is the first packet that directly targets the D329 failure mode instead of only changing inference-time gates. It is now operationally ready for a bounded Prime smoke, but the smoke should be treated as a cheap falsification run: train for capped steps, fetch predictions, terminate immediately, run the D322 shape harness, and buy no OpenAI judgments unless the shape gate clears.
