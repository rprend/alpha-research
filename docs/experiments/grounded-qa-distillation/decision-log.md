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
