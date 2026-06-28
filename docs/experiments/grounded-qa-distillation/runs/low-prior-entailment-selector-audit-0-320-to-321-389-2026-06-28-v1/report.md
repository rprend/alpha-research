# Low-Prior Entailment Selector Audit

Generated: 2026-06-28T15:29:12.195Z

Status: `entailment_selector_not_promoted`

This audit tests whether the D302 `nli_entailment_min` signal can safely override source-prior rankings. Thresholds are selected only on non-final chronological transfer.

## Non-Final Selection

- Low-prior rescue rows: 23
- Latest-window rescue rows: 19
- Selected entailment delta: 999
- Selected entailment floor: 999
- Latest baseline accuracy: 5.0%
- Latest selected accuracy: 5.0%
- Latest baseline low-prior correct: 0
- Latest selected low-prior correct: 0

## Final Reporting

- Baseline source-prefix selector: 44/49
- Selected entailment override: 44/49
- Diagnostic best final thresholds: 44/49
- Diagnostic best non-baseline final thresholds: 31/49
- Switches at selected thresholds: 0
- Rescues at selected thresholds: 0
- Regressions at selected thresholds: 0

## Decision

- Promote entailment selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Do not promote the current entailment override; inspect failure rows and either strengthen candidate verification or expand non-final supervision before GPU spend.
- Reason: The non-final-selected thresholds do not produce a regression-free final improvement over 44/49; the D302 pairwise signal is useful but not yet a deployable listwise selector.
