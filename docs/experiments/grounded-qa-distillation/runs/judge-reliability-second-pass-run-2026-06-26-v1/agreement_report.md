# Judge Reliability Second-Pass Run

Generated: 2026-06-26T19:38:15.770Z

Status: `second_pass_complete`

Model: `gpt-4o-mini`

| Planned calls | Calls made | Run cost | Ledger before | Ledger after |
| ---: | ---: | ---: | ---: | ---: |
| 42 | 42 | $0.007532 | $5.878324 | $5.885856 |

## Agreement

- Compared cases: 42
- Exact agreements: 27
- Exact agreement rate: 64.3%

## Agreement By Audit Type

| Audit type | Cases | Exact agreement | Exact agreement rate |
| --- | ---: | ---: | ---: |
| unsupported_answer | 8 | 6 | 75.0% |
| questionable_abstention | 6 | 0 | 0.0% |
| correct_abstention_sanity_check | 4 | 4 | 100.0% |
| cross_policy_disagreement | 24 | 17 | 70.8% |

## Sample Disagreements

- `adjudication-002-case-01` (unsupported_answer, direct_mini_repair): original=unsupported, second_pass=incorrect_abstention; The prediction claims that professional translations made 31.7% fewer errors compared to machine translations, citing evidence [E2]. However, the evidence does not directly support the claim about the percentage of fewer errors made by professional translations. Therefore, the abstention is incorrect as the evidence pack does not provide sufficient support for the claim made in the prediction.
- `adjudication-003-case-01` (unsupported_answer, direct_mini_repair): original=unsupported, second_pass=incorrect_abstention; The prediction claims that the CORD-19 dataset includes 3000 negative samples, which is supported by evidence E1. However, the reference answer states that the evidence pack does not contain enough support to answer the question, which is incorrect because E1 does provide relevant information about the CORD-19 dataset. Therefore, the prediction is valid, and the reference answer's abstention is incorrect.
- `adjudication-009-case-01` (questionable_abstention, balanced_risk_gate): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack contains relevant information about the characteristics of how Arabic speakers use offensive language, but it does not comprehensively cover all the distinctive characteristics listed in the reference answer. Therefore, the evidence is insufficient to fully support the claims made in the reference answer.
- `adjudication-010-case-01` (questionable_abstention, claim_entailment_guard): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack contains relevant information about the characteristics of how Arabic speakers use offensive language, but it does not comprehensively cover all the distinctive characteristics listed in the reference answer. Therefore, the evidence is insufficient to fully support the claims made in the reference answer.
- `adjudication-011-case-01` (questionable_abstention, balanced_risk_gate): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack contains information about the datasets used, specifically mentioning Europarl v9, NewsTest2013, and NewsTest2014. However, the prediction states that the evidence pack does not contain enough support to answer the question, which is incorrect because the evidence does support the claim about the datasets. Therefore, the prediction is a correct abstention based on the support-risk score, but the evidence does provide sufficient information to answer the question.
- `adjudication-012-case-01` (questionable_abstention, claim_entailment_guard): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack contains sufficient information to identify the datasets used in the paper, specifically Europarl v9, NewsTest2013, and NewsTest2014, as stated in the reference answer. However, the prediction indicates an abstention due to a support-risk score below the threshold, which is not justified since the evidence does support the claim. Therefore, the prediction is correct in abstaining, but the reasoning for the abstention is flawed.
- `adjudication-013-case-01` (questionable_abstention, balanced_risk_gate): original=incorrect_abstention, second_pass=correct_abstention; The evidence pack contains a citation (E2) that explicitly states that human judgments are collected via crowdsourcing on Amazon Mechanical Turk, which directly supports the claim that they use crowdsourcing to collect human judgments. Therefore, the prediction of abstaining is incorrect, as there is sufficient evidence to answer the question affirmatively.
- `adjudication-014-case-01` (questionable_abstention, claim_entailment_guard): original=incorrect_abstention, second_pass=correct_abstention; The prediction correctly identifies that the evidence pack does not provide sufficient support to answer the question about the use of crowdsourcing for collecting human judgments. While evidence E2 mentions collecting human judgments via Amazon Mechanical Turk, it does not explicitly confirm that crowdsourcing is used in the context of the question. Therefore, the abstention is justified.
- `adjudication-020-case-03` (cross_policy_disagreement, direct_mini_repair): original=unsupported, second_pass=incorrect_abstention; The prediction claims that professional translations made 31.7% fewer errors compared to machine translations, citing evidence [E2]. However, the evidence does not directly support the claim about the percentage of fewer errors made by professional translations. Therefore, the abstention is incorrect as the evidence pack does not contain enough support to answer the question.
- `adjudication-021-case-03` (cross_policy_disagreement, direct_mini_repair): original=unsupported, second_pass=incorrect_abstention; The prediction claims that the CORD-19 dataset includes 3000 negative samples, which is supported by evidence E1. However, the reference answer states that the evidence pack does not contain enough support to answer the question, which is incorrect because E1 does provide relevant information about the CORD-19 dataset. Therefore, the correct verdict should not be abstention.
- `adjudication-022-case-03` (cross_policy_disagreement, direct_mini_repair): original=supported, second_pass=correct_abstention; The reference answer correctly abstains from answering the question because the evidence pack does not provide specific details about the text classification datasets evaluated. Although the prediction claims that they evaluate on 7 text classification datasets and cites E3, the evidence in E3 does not specify what those datasets are, thus making the claim unsupported.
- `adjudication-023-case-01` (cross_policy_disagreement, balanced_risk_gate): original=partial, second_pass=correct_abstention; The prediction provides a detailed answer about how attraction score is measured, supported by evidence E4. Each claim made in the prediction is directly supported by the cited evidence, which discusses the evaluation process by human raters and the use of a Likert scale. Therefore, the prediction is valid and correctly answers the question without needing to abstain.
