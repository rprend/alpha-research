# Low-Prior Candidate Signal Audit

Generated: 2026-06-28T15:19:57.710Z

Status: `candidate_internal_signal_available_for_guarded_selector`

This audit checks candidate-internal support features on the D300 low-prior rescue slice and the D299 final diagnostic analogs. Final rows are reporting-only.

## Packet Context

- Non-final low-prior rescue rows: 23
- Qwen rejected rows: 19
- Final misses: 5
- Final misses with supported candidate: 5

## Selected Signal

- Feature: nli_entailment_min
- Non-final correctness: 19/23
- Final diagnostic correctness: 5/5

## Decision

- Build candidate-internal low-prior selector next: yes
- Promote selector now: no
- Buy OpenAI labels now: no
- Launch GPU now: no
- Next step: Build a guarded low-prior selector using nli_entailment_min as a candidate-internal support signal, with non-final regression controls before final reporting.
- Reason: nli_entailment_min identifies the supported side on 19/23 non-final low-prior rows and 5/5 final diagnostic analogs, but final analogs remain reporting-only.
