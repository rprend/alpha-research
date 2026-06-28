# Question-Target Text Verifier Audit

Generated: 2026-06-28T16:37:12.473Z

Status: `text_verifier_not_promotable`

This audit trains only local TF-IDF/logistic models from the already-paid non-final D309 labels. It makes no OpenAI calls and launches no GPU jobs.

## Selected By Non-Final LOO

- Policy: candidate_tfidf_logreg_c_10p0
- LOO accuracy: 0.500
- LOO balanced accuracy: 0.501
- Final pair transfer: 591/865 (68.3%)

## Diagnostic Best Final Text Verifier

- Policy: candidate_tfidf_logreg_c_10p0
- LOO balanced accuracy: 0.501
- Final pair transfer: 591/865 (68.3%)

## Decision

- Promote text verifier now: no
- Train question-target verifier on GPU now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The best local text verifier selected by non-final leave-one-out reaches 50.1% balanced LOO accuracy and only 68.3% final pair transfer. The label batch is real but too narrow for a deployable verifier.
- Next step: Mine or buy a harder, more diverse non-final target-completeness batch that matches final pair distributions before training a verifier or student.
