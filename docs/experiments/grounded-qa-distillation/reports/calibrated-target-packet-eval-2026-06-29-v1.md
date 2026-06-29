# Calibrated Target Packet Eval

Generated: 2026-06-29T17:32:44.988Z

Status: `calibrated_gate_does_not_change_selected_reporting`

This run creates a conservative calibrated target overlay and evaluates existing routed predictions under both the strict citation-exact gate and the calibrated support-citation gate. It makes no API calls and launches no compute.

## Target Overlay

- Examples: 315
- Review-deferred rows: 11
- Rows with extra acceptable support ids: 86

## Fresh Validation Scores

| Prediction run | Strict | Calibrated | Citation acceptable | Review deferred |
| --- | ---: | ---: | ---: | ---: |
| `four-source-router-audit-2026-06-29-v1` | 47/75 | 46/75 | 70/75 | 11 |
| `targeted-paid-repair-adjudication-2026-06-29-v1` | 47/75 | 45/75 | 69/75 | 11 |

## Decision

- Promote calibrated gate as primary: no
- Use calibrated gate as secondary metric: yes
- Buy more OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Best fresh calibrated score is 46/75 for four-source-router-audit-2026-06-29-v1, versus strict 47/75; 11 rows are review-deferred.
- Next step: Use the calibrated gate as a secondary diagnostic only, and build the next candidate/selector against non-review rows before any more paid calls.
