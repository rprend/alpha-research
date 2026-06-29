# Targeted Disagreement Repair Packet

Generated: 2026-06-29T16:24:07.476Z

Status: `targeted_repair_packet_ready`

## Counts

- Selector pairs: 50
- Selector train pairs: 35
- Construction repairs: 101
- Construction train repairs: 85
- Abstention-boundary repairs: 234
- Abstention-boundary train repairs: 183

## Breakdowns

- Selector chosen source: {"pattern":10,"learned":40}
- Construction repair type: {"single_citation_grounded_construction_repair":33,"multi_citation_grounded_construction_repair":65,"abstention_false_answer_repair":3}
- Train construction repair type: {"single_citation_grounded_construction_repair":29,"multi_citation_grounded_construction_repair":53,"abstention_false_answer_repair":3}
- Boundary target type: {"grounded_answer":125,"abstain":109}

## Decision

- Train selector next: yes
- Train constructor next: yes
- Buy OpenAI labels now: no
- Rent Prime GPU now: no
- Reason: Mined 35 train selector pairs and 85 train construction repairs from existing artifacts.
- Next step: Train or audit a targeted construction repair scaffold on no-source-correct train rows before spending on new labels.
