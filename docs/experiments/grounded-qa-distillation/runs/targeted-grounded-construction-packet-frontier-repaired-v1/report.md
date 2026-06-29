# Targeted Grounded Construction Packet

Generated: 2026-06-29T04:36:18.423Z

Status: `targeted_grounded_construction_packet_ready_for_preflight`

This packet makes no OpenAI calls and launches no Prime job. It adds numeric/metric exactness and multi-citation synthesis DPO contrasts from repaired train/validation rows only.

## Source Motivation

- D392 status: `grounded_gap_candidate_absence_dominates`
- Candidate-absence grounded rows: 12
- Numeric/metric grounded targets: 20
- Multi-citation grounded targets: 11

## Packet

- SFT train: 223
- SFT validation: 70
- DPO train: 392
- DPO validation: 132
- Added DPO train: 169
- Added DPO validation: 62
- Added preference types: {"prefer_exact_numeric_answer_over_vague_metric_answer":53,"prefer_target_metric_over_nearby_supported_number":52,"prefer_multi_citation_synthesis_over_single_fragment":63,"prefer_exact_citation_set_over_missing_synthesis_citation":63}
- Added target forms: {"numeric_or_metric":105,"multi_citation_synthesis":126}

## Validation

- Errors: 0
- Added targeted train rows: 169
- Added targeted validation rows: 62

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Run launch preflight next: yes
- Reason: The packet directly targets D392 numeric/metric and multi-citation candidate-absence failures using only repaired train/validation rows.
- Next step: Run a launch preflight for this packet; only consider a bounded Prime smoke if the preflight passes under the $100 cap.
