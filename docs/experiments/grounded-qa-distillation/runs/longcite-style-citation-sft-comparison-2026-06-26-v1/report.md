# LongCite-Style Citation SFT Comparison

This compares citation-syntax metrics against grounded support metrics using existing runs. It is a LongCite-style framing check, not a reproduction of LongCite.

## Systems

| System | Answered | Inline citation rate | Citation precision vs reference evidence | Answer support | Overall judged correctness |
| --- | ---: | ---: | ---: | ---: | ---: |
| direct_mini_citation_repair | 53 | 100.0% | 68.2% | 64.2% | 72.5% |
| local_qwen05b_answer_repeat2_citation_repair | 40 | 97.5% | 33.1% | 5.0% | 42.0% |
| local_qwen05b_answered_only_citation_repair | 36 | 100.0% | 21.8% | n/a | n/a |

## Syntax-Support Gap

- direct_mini_citation_repair: inline citation 100.0% vs answer support 64.2%; gap 35.8%
- local_qwen05b_answer_repeat2_citation_repair: inline citation 97.5% vs answer support 5.0%; gap 92.5%

## Interpretation

Citation syntax compliance is not a proxy for grounded answer support.

- The local answer-repeat student reaches 97.5% inline citation compliance after zero-call citation repair, but only 5.0% of answered predictions are judged supported.
- The direct-mini citation-repair run reaches 100.0% inline citation compliance and 64.2% answer support, showing support depends on answer/evidence selection rather than bracket syntax alone.
- A citation-SFT comparison for this paper must report answer support, abstention support, and overall judged correctness, not only citation formatting metrics.

## Budget

No new OpenAI calls, no GPU jobs, and no new spend.
