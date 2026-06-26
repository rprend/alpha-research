# Hard Grounded Research Difficulty Mechanism Ledger

This generated ledger connects each benchmark category to the hypothesized mechanism that makes grounded research hard, observed failure signals from current baselines, and the claim blockers that prevent overclaiming.

## Summary

- Ledger ready: true
- Version: difficulty-mechanism-ledger-v1
- Categories: 10
- Mechanisms: 20
- Observed failure cases: 116
- Reviewed item deficit: 300
- Blocked claim categories: 10
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_constructs_have_mechanisms | true | 10/10 categories mapped |
| failure_atlas_linked | true | 116 failure cases; 8 failure modes |
| scale_deficits_linked | true | 300 reviewed items still needed |
| paper_claims_still_blocked | true | 3 prohibited claims; release=blocked |

## Category Mechanisms

| Category | Mechanisms | Target metrics | Failure cases | Observed modes | Reviewed deficit | Claim status |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | requires evidence composition across separate facts<br>distractors can support one hop without supporting the final answer | answer_correct<br>evidence_recall<br>citation_precision | 10 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | requires rejecting plausible stale evidence<br>requires selecting the controlling current document snapshot | answer_correct<br>citation_faithfulness<br>conclusion_support | 12 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | requires tracking document state after appendices or errata<br>requires recognizing when later appended material supersedes body text | answer_correct<br>conclusion_support<br>citation_faithfulness | 8 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| table + text reasoning | requires joining structured table cells with textual qualifiers<br>requires numeric or tabular grounding plus prose interpretation | answer_correct<br>evidence_recall<br>conclusion_support | 12 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| source authority conflicts | requires resolving evidence by authority hierarchy<br>requires ignoring lower-authority evidence that is locally plausible | answer_correct<br>conclusion_support<br>abstention_quality | 11 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | requires distinguishing relevant context from sufficient evidence<br>requires abstaining when citations are near misses | abstention_quality<br>answer_correct<br>citation_faithfulness | 12 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | requires checking whether cited facts license the final conclusion<br>requires detecting conclusion overreach despite faithful subfact citation | conclusion_support<br>citation_faithfulness<br>citation_precision | 15 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| entity disambiguation | requires binding evidence to the intended referent<br>requires resisting same-name or near-name distractors | answer_correct<br>evidence_recall<br>citation_faithfulness | 12 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | requires answering relative to an explicit date<br>requires excluding evidence outside the requested temporal snapshot | answer_correct<br>citation_faithfulness<br>conclusion_support | 12 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |
| cross-document contradiction | requires reporting conflict or applying a control rule<br>requires avoiding synthesis across incompatible documents | abstention_quality<br>conclusion_support<br>answer_correct | 12 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer | 30 | blocked_until_review_scale_and_novelty_clear |

## Blocking Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| category_scale_ready | false | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| novelty_audit_final | false | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
| review_merge_ready | false | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
