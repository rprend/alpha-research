# Hard Grounded Research Failure Atlas

This generated atlas turns pilot scoring reports into qualitative failure evidence. It is diagnostic only: these cases are machine-seeded and remain blocked from paper claims until human review, scale, and final novelty gates pass.

## Summary

- Failure atlas ready: true
- Scored systems: 5
- Failure cases: 116
- Failure modes: 8
- Categories covered: 10
- Release gate status: blocked
- Completion claim allowed: false

## Failure Modes

| Failure mode | Cases | Systems | Categories | Challenge types |
| --- | --- | --- | --- | --- |
| missing_required_evidence | 95 | 4 | 10 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| citation_does_not_support_conclusion | 93 | 5 | 10 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| citation_not_faithful_to_answer | 86 | 4 | 10 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| wrong_answer | 86 | 4 | 10 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>document_lifecycle_appendix<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| bad_abstention_or_conflict_behavior | 50 | 4 | 7 | as_of_date_constraint<br>authority_conflict<br>citation_overreach_probe<br>cross_document_contradiction<br>insufficiency_probe<br>native_row<br>stale_current_conflict |
| contradiction_resolution_failure | 12 | 4 | 1 | cross_document_contradiction |
| authority_resolution_failure | 10 | 4 | 1 | authority_conflict |
| temporal_scope_failure | 10 | 4 | 1 | as_of_date_constraint |

## Category Atlas

| Category | Failure cases | Systems with failures | Top failure modes |
| --- | --- | --- | --- |
| multi-hop synthesis | 10 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| stale-vs-current document conflicts | 12 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| appended document lifecycle changes | 8 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| table + text reasoning | 12 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| source authority conflicts | 11 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| evidence insufficiency / abstention | 12 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| citation supports fact but not conclusion | 15 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>local-rule-agent-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| entity disambiguation | 12 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| temporal questions: as of date X | 12 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |
| cross-document contradiction | 12 | anthropic-grounded-baseline-v1<br>citation-aware-verifier-v1<br>lexical-evidence-baseline-v1<br>openai-grounded-baseline-v1 | missing_required_evidence<br>citation_does_not_support_conclusion<br>citation_not_faithful_to_answer |

## Representative Cases

| System | Category | Challenge | Failure modes | Metrics | Designed failure |
| --- | --- | --- | --- | --- | --- |
| anthropic-grounded-baseline-v1 | cross-document contradiction | cross_document_contradiction | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>contradiction_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent averages or paraphrases conflicting evidence into a false consensus. |
| anthropic-grounded-baseline-v1 | cross-document contradiction | cross_document_contradiction | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>contradiction_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent averages or paraphrases conflicting evidence into a false consensus. |
| anthropic-grounded-baseline-v1 | cross-document contradiction | cross_document_contradiction | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>contradiction_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent averages or paraphrases conflicting evidence into a false consensus. |
| anthropic-grounded-baseline-v1 | evidence insufficiency / abstention | insufficiency_probe | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent supplies a plausible answer despite unanswerable or not-enough-info labels. |
| anthropic-grounded-baseline-v1 | evidence insufficiency / abstention | insufficiency_probe | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent supplies a plausible answer despite unanswerable or not-enough-info labels. |
| anthropic-grounded-baseline-v1 | evidence insufficiency / abstention | insufficiency_probe | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent supplies a plausible answer despite unanswerable or not-enough-info labels. |
| anthropic-grounded-baseline-v1 | source authority conflicts | authority_conflict | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>authority_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent quotes the clearest prose rather than the most authoritative source. |
| anthropic-grounded-baseline-v1 | source authority conflicts | authority_conflict | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>authority_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent quotes the clearest prose rather than the most authoritative source. |
| anthropic-grounded-baseline-v1 | source authority conflicts | authority_conflict | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior<br>authority_resolution_failure | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent quotes the clearest prose rather than the most authoritative source. |
| anthropic-grounded-baseline-v1 | stale-vs-current document conflicts | stale_current_conflict | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent treats stale evidence as current or blends incompatible snapshots. |
| anthropic-grounded-baseline-v1 | stale-vs-current document conflicts | stale_current_conflict | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent treats stale evidence as current or blends incompatible snapshots. |
| anthropic-grounded-baseline-v1 | stale-vs-current document conflicts | stale_current_conflict | wrong_answer<br>missing_required_evidence<br>citation_not_faithful_to_answer<br>citation_does_not_support_conclusion<br>bad_abstention_or_conflict_behavior | answer=0.0000; evidence=0.0000; conclusion=0.0000 | The agent treats stale evidence as current or blends incompatible snapshots. |
