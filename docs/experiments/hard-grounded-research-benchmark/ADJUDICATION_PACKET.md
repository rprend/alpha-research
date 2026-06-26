# Hard Grounded Research Adjudication Packet

This packet is generated from `generated/pilot-suite.json` and is not gold data. It is a reviewer work queue for turning machine-seeded items into defensible benchmark items.

## Summary

- Items: 30
- Needs review: 30
- Reviewed: 0
- Gold ready: false

## Reviewer Instructions

For each item, decide whether the candidate answer is supported by the evidence under the category rubric. Fill the JSONL reviewer fields with:

- `final_label`: one of `SUPPORTED`, `REFUTED`, `INSUFFICIENT`, `CONFLICT`, or `INVALID_ITEM`.
- `final_answer`: the adjudicated answer, or `ABSTAIN` / `CONFLICT`.
- `required_citation_ids`: minimal evidence ids that directly support the final answer.
- `insufficient_or_conflicting_evidence`: true when the item should abstain or report conflict.
- `notes`: short rationale, including any item-repair needed.

## Sample Queue Items

### hgr_multi_hop_001_pilot_001

- Category: multi-hop synthesis
- Construction: reuse_native_labels
- Transform: native_row
- Candidate answer: yes
- Required dimensions: hop_coverage, bridge_entity_resolution, minimal_citation_set
- Review status: needs_review
- Evidence:
    - 5a8b57f25542995d1e6f1371:support:0: Scott Derrickson (born July 16, 1966) is an American director, screenwriter and producer. He lives in Los Angeles, California. He is best known for directing horror films such as…
    - 5a8b57f25542995d1e6f1371:support:1: Edward Davis Wood Jr. (October 10, 1924 – December 10, 1978) was an American filmmaker, actor, writer, producer, and director.

### hgr_multi_hop_001_pilot_002

- Category: multi-hop synthesis
- Construction: reuse_native_labels
- Transform: native_row
- Candidate answer: Chief of Protocol
- Required dimensions: hop_coverage, bridge_entity_resolution, minimal_citation_set
- Review status: needs_review
- Evidence:
    - 5a8c7595554299585d9e36b6:support:0: Kiss and Tell is a 1945 American comedy film starring then 17-year-old Shirley Temple as Corliss Archer. In the film, two teenage girls cause their respective parents much concern…
    - 5a8c7595554299585d9e36b6:support:1: Shirley Temple Black (April 23, 1928 – February 10, 2014) was an American actress, singer, dancer, businesswoman, and diplomat who was Hollywood's number one box-office draw as a…

### hgr_multi_hop_001_pilot_003

- Category: multi-hop synthesis
- Construction: reuse_native_labels
- Transform: native_row
- Candidate answer: Animorphs
- Required dimensions: hop_coverage, bridge_entity_resolution, minimal_citation_set
- Review status: needs_review
- Evidence:
    - 5a85ea095542994775f606a8:support:0: The Hork-Bajir Chronicles is the second companion book to the "Animorphs" series, written by K. A. Applegate. With respect to continuity within the series, it takes place before b…
    - 5a85ea095542994775f606a8:support:1: The Hork-Bajir Chronicles is the second companion book to the "Animorphs" series, written by K. A. Applegate. With respect to continuity within the series, it takes place before b…

### hgr_stale_current_001_pilot_001

- Category: stale-vs-current document conflicts
- Construction: composed_corpus_suite
- Transform: adversarial_wrapper
- Candidate answer: SUPPORTS
- Required dimensions: document_date_identification, stale_evidence_rejection, current_state_grounding
- Review status: needs_review
- Evidence:
    - Extinction risk from global warming:170: "Recent Research Shows Human Activity Driving Earth Towards Global Extinction Event".
    - 5a8b57f25542995d1e6f1371:support:0: Scott Derrickson (born July 16, 1966) is an American director, screenwriter and producer. He lives in Los Angeles, California. He is best known for directing horror films such as…

### hgr_stale_current_001_pilot_002

- Category: stale-vs-current document conflicts
- Construction: composed_corpus_suite
- Transform: adversarial_wrapper
- Candidate answer: SUPPORTS
- Required dimensions: document_date_identification, stale_evidence_rejection, current_state_grounding
- Review status: needs_review
- Evidence:
    - Famine:386: The current consensus of the scientific community is that the aerosols and dust released into the upper atmosphere causes cooler temperatures by preventing the sun's energy from r…
    - 5a8c7595554299585d9e36b6:support:0: Kiss and Tell is a 1945 American comedy film starring then 17-year-old Shirley Temple as Corliss Archer. In the film, two teenage girls cause their respective parents much concern…

### hgr_stale_current_001_pilot_003

- Category: stale-vs-current document conflicts
- Construction: composed_corpus_suite
- Transform: adversarial_wrapper
- Candidate answer: REFUTES
- Required dimensions: document_date_identification, stale_evidence_rejection, current_state_grounding
- Review status: needs_review
- Evidence:
    - Polar bear:1332: "Ask the experts: Are polar bear populations increasing?".
    - 5a85ea095542994775f606a8:support:0: The Hork-Bajir Chronicles is the second companion book to the "Animorphs" series, written by K. A. Applegate. With respect to continuity within the series, it takes place before b…

### hgr_appendix_lifecycle_001_pilot_001

- Category: appended document lifecycle changes
- Construction: reuse_native_labels
- Transform: adversarial_wrapper
- Candidate answer: BIBREF19
- Required dimensions: section_provenance, supersession_detection, original_vs_appended_scope
- Review status: needs_review
- Evidence:
    - 1912.01214:b6f15fb6279b82e34a5bf4828b7b5ddabfdf1d54:evidence:0: We compare our approaches with related approaches of pivoting, multilingual NMT (MNMT) BIBREF19, and cross-lingual transfer without pretraining BIBREF16.

### hgr_appendix_lifecycle_001_pilot_002

- Category: appended document lifecycle changes
- Construction: reuse_native_labels
- Transform: adversarial_wrapper
- Candidate answer: Stanford NER
- Required dimensions: section_provenance, supersession_detection, original_vs_appended_scope
- Review status: needs_review
- Evidence:
    - 1810.08699:18c5d366b1da8447b5404eab71f4cc658ba12e6f:evidence:0: In this section we describe a number of experiments targeted to compare the performance of popular named entity recognition algorithms on our data. We trained and evaluated Stanfo…

### hgr_appendix_lifecycle_001_pilot_003

- Category: appended document lifecycle changes
- Construction: reuse_native_labels
- Transform: adversarial_wrapper
- Candidate answer: politics, business, science, and AskReddit, and 1000 additional posts from the Reddit frontpage.
- Required dimensions: section_provenance, supersession_detection, original_vs_appended_scope
- Review status: needs_review
- Evidence:
    - 1609.00425:b6ae8e10c6a0d34c834f18f66ab730b670fb528c:evidence:0: To collect a diverse training dataset, we have randomly sampled 1000 posts each from the subreddits politics, business, science, and AskReddit, and 1000 additional posts from the…

### hgr_table_text_001_pilot_001

- Category: table + text reasoning
- Construction: composed_corpus_suite
- Transform: native_row
- Candidate answer: 36755
- Required dimensions: table_denotation, calculation_trace, textual_interpretation_support
- Review status: needs_review
- Evidence:
    - nt-0:table: header: Year | Division | League | Regular Season | Playoffs | Open Cup | Avg. Attendance / row: 2001 | 2 | USL A-League | 4th, Western | Quarterfinals | Did not qualify | 7,169 /…
    - 1912.01214:b6f15fb6279b82e34a5bf4828b7b5ddabfdf1d54:evidence:0: We compare our approaches with related approaches of pivoting, multilingual NMT (MNMT) BIBREF19, and cross-lingual transfer without pretraining BIBREF16.

