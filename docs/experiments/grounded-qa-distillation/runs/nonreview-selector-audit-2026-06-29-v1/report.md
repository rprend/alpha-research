# Non-Review Selector Audit

Generated: 2026-06-29T17:39:35.225Z

Status: `nonreview_oracle_headroom_not_selected`

This audit excludes calibrated review-deferred rows from selector selection/evaluation and checks whether a local selector can beat the structured-group source on the cleaner fresh-validation slice.

## Selected Policy

- Policy: `family-always_source__source-structured_group`
- Train-heldout non-review: 49/80 (61.3%)
- Fresh non-review: 47/64 (73.4%)
- Fresh all: 47/75 (62.7%)

## Source Comparison On Fresh Non-Review

- Pattern: 22/64
- Learned: 27/64
- Teacher: 44/64
- Structured group: 47/64
- Oracle: 57/64

## Decision

- Promote non-review selector: no
- Buy more OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Selected policy scored 47/64 on non-review fresh rows; best single source scored 47/64; oracle scored 57/64.
- Next step: Stop selector-only variants on this pool and focus on constructing easier-to-select candidates or a new non-review training packet.
