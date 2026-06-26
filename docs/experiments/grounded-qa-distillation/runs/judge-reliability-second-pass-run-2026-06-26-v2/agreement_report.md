# Judge Reliability Second-Pass Run

Generated: 2026-06-26T19:40:49.797Z

Status: `second_pass_complete`

Model: `gpt-4o-mini`

| Planned calls | Calls made | Run cost | Ledger before | Ledger after |
| ---: | ---: | ---: | ---: | ---: |
| 42 | 42 | $0.007244 | $5.885856 | $5.893100 |

## Agreement

- Compared cases: 42
- Exact agreements: 32
- Exact agreement rate: 76.2%
- Schema-incompatible verdicts: 0

## Agreement By Audit Type

| Audit type | Cases | Exact agreement | Exact agreement rate |
| --- | ---: | ---: | ---: |
| unsupported_answer | 8 | 7 | 87.5% |
| questionable_abstention | 6 | 0 | 0.0% |
| correct_abstention_sanity_check | 4 | 4 | 100.0% |
| cross_policy_disagreement | 24 | 21 | 87.5% |

## Sample Disagreements

- `adjudication-004-case-01` (unsupported_answer, direct_mini_repair): original=unsupported, second_pass=supported; The prediction correctly identifies that the criterion for selecting the lemmata was inclusivity, which is explicitly stated in E3. The claim is directly supported by the cited evidence.
- `adjudication-009-case-01` (questionable_abstention, balanced_risk_gate): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack does not provide sufficient information to directly answer the question about the distinctive characteristics of how Arabic speakers use offensive language. While there are examples of offensive language usage, the evidence does not comprehensively cover the characteristics needed to fully address the question.
- `adjudication-010-case-01` (questionable_abstention, claim_entailment_guard): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack provides various examples of offensive language used by Arabic speakers, but it does not comprehensively cover the distinctive characteristics of how they use such language. Therefore, the prediction to abstain is justified as the evidence is insufficient to fully answer the question.
- `adjudication-011-case-01` (questionable_abstention, balanced_risk_gate): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack does provide information about the datasets used, specifically mentioning the Europarl v9 parallel dataset and the NewsTest2013 and NewsTest2014 datasets. Therefore, the claim that the evidence is insufficient to answer the question is incorrect, leading to a correct abstention verdict.
- `adjudication-012-case-01` (questionable_abstention, claim_entailment_guard): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack provides information about the datasets used, specifically mentioning the Europarl v9 parallel dataset and the NewsTest2013 and NewsTest2014 datasets. However, the prediction correctly identifies that the evidence does not sufficiently cover all aspects of the question regarding datasets used in the paper, leading to a valid abstention.
- `adjudication-013-case-01` (questionable_abstention, balanced_risk_gate): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack does not provide direct support for the question regarding the use of crowdsourcing to collect human judgments. The only relevant evidence (E2) mentions collecting human judgments via Amazon Mechanical Turk, which implies crowdsourcing, but does not explicitly confirm it. Therefore, the evidence is insufficient to definitively answer the question.
- `adjudication-014-case-01` (questionable_abstention, claim_entailment_guard): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack does not provide sufficient information to determine whether crowdsourcing is used to collect human judgments. The only relevant evidence (E2) mentions collecting human judgments via Amazon Mechanical Turk, which implies crowdsourcing, but does not explicitly confirm it. Therefore, the prediction to abstain is justified.
- `adjudication-023-case-01` (cross_policy_disagreement, balanced_risk_gate): original=partial, second_pass=supported; All claims made in the prediction are directly supported by the cited evidence E4, which describes the evaluation process for the attraction score.
- `adjudication-023-case-03` (cross_policy_disagreement, direct_mini_repair): original=partial, second_pass=supported; All claims made in the prediction are directly supported by the cited evidence E4. The evidence clearly states that human raters evaluate the attractiveness of headlines, that this evaluation is done on a Likert scale from 1 to 10, and that the final score is obtained by averaging the scores given by the annotators.
- `adjudication-025-case-03` (cross_policy_disagreement, direct_mini_repair): original=unsupported, second_pass=supported; The prediction correctly identifies that the criterion for selecting the lemmata was inclusivity, which is directly supported by evidence E3. The claim about inclusivity being applicable to first person plural verbs and distinguishing between inclusive and exclusive forms is also directly supported by E3.
