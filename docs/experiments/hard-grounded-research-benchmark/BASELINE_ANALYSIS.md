# Hard Grounded Research Baseline Analysis

This report is generated from checked-in run artifacts. It is a pilot result summary, not a paper claim over gold data.

## Readiness

- Gold ready: false
- Valid reviewed items: 0/30
- Unreviewed items: 30
- OpenAI prompt packet rows: 30
- OpenAI scored report present: false

## Macro Results

| System | Tasks | Answer correct | Evidence recall | Citation faithfulness | Abstention quality |
| --- | --- | --- | --- | --- | --- |
| local-rule-agent-v1 | 30 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| lexical-evidence-baseline-v1 | 30 | 0.2333 | 0.6979 | 0.6167 | 0.7000 |

## Lexical Baseline Weakest Categories

| Category | Answer correct | Evidence recall | Citation faithfulness | Abstention quality |
| --- | --- | --- | --- | --- |
| cross-document contradiction | 0.0000 | 0.3952 | 0.5000 | 1.0000 |
| evidence insufficiency / abstention | 0.0000 | 1.0000 | 0.5000 | 0.0000 |
| table + text reasoning | 0.0000 | 1.0000 | 0.5000 | 1.0000 |
| citation supports fact but not conclusion | 0.3333 | 0.3952 | 0.6667 | 1.0000 |
| entity disambiguation | 0.3333 | 0.5000 | 0.6667 | 1.0000 |

## Headline Contrast

- Lexical answer-correct gap vs oracle sanity runner: 0.7667
- Lexical citation-faithfulness gap vs oracle sanity runner: 0.3833
- Lexical evidence-recall gap vs oracle sanity runner: 0.3021

## Interpretation

The lexical baseline is intentionally non-oracle: it does not read native answers or gold citation ids. Its weakest categories are a first operational signal for the paper question: hard grounded research failures are not just lookup misses; they include answer selection under insufficiency, table/text interpretation, contradiction handling, and citation support for conclusions.

This report remains preliminary until the adjudication queue is reviewed and at least one API or open-model baseline has a scored report.
