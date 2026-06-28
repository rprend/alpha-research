# Combined Target Text Verifier Audit

Generated: 2026-06-28T16:57:13.778Z

Status: `combined_text_verifier_not_promotable`

This audit trains local TF-IDF/logistic models from already-paid D309 and D313 target-completeness labels. It makes no OpenAI calls and launches no GPU jobs.

## Selected Combined Verifier

- Policy: combined_candidate_tfidf_logreg_c_10p0
- LOO balanced accuracy: 0.588
- Final pair transfer: 598/865 (69.1%)

## Delta From D311

- LOO balanced accuracy delta: 8.7%
- Final pair transfer delta: 0.8%

## Decision

- Promote text verifier now: no
- Train question-target verifier on GPU now: no
- Buy more OpenAI labels now: no
- Launch GPU now: no
- Reason: The selected combined verifier reaches 58.8% balanced LOO and 69.1% final transfer, below the promotion threshold.
- Next step: Do not train a student yet; inspect combined-label disagreement and consider whether target-completeness requires a stronger judge/model class.
