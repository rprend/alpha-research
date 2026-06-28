# Low-Prior Rescue Selector Audit

Generated: 2026-06-28T15:13:38.560Z

Status: `qwen_boost_anti_transfer_not_promoted`

This audit tests the obvious family-level rescue suggested by the final misses: boost Qwen-family candidates. The boost is selected only from non-final chronological transfer.

## Non-Final Selection

- Low-prior rescue rows: 23
- Latest-window rescue rows: 19
- Selected Qwen boost: 0
- Latest baseline accuracy: 5.0%
- Latest selected accuracy: 5.0%

## Final Reporting

- Baseline source-prefix selector: 44/49
- Selected boost selector: 44/49
- Diagnostic best final boost: 44/49
- Switches at selected boost: 0
- Regressions at selected boost: 0

## Decision

- Promote low-prior rescue selector now: no
- Keep low-prior packet for diagnostics: yes
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Do not use family-level Qwen rescue. Mine deployable candidate-internal signals that distinguish supported low-prior candidates from unsupported Qwen overclaims.
- Reason: The obvious Qwen-family rescue rule anti-transfers on the latest non-final window where Qwen is usually the unsupported side, so final Qwen-supported misses require candidate-internal support features rather than a family prior override.
