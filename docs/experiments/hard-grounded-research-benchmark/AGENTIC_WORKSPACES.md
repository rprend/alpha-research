# Agentic Workspaces

These are no-gold workspaces for real tool-using agent runs. Give an agent one workspace directory at a time, or the full `generated/agentic-workspaces` directory, but do not include `generated/agentic-hidden-gold.json`.

## Files

- `task.json`: public task metadata and corpus pointer.
- `corpus.json`: searchable evidence documents with exact `document_id` values.
- `README.md`: natural-language task prompt.
- `answer.schema.json`: required answer shape.
- `answer.json`: file the agent must create during a run.

## Hidden Gold

`generated/agentic-hidden-gold.json` is for deterministic scoring only and must be withheld from agents.

## Workspaces

| Task | Category | Workspace | Corpus docs | Source items |
| --- | --- | --- | ---: | ---: |
| hgr_agentic_001_multi-hop-synthesis_338bb9 | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_001_multi-hop-synthesis_338bb9 | 1000 | 1
| hgr_agentic_002_stale-vs-current-document-conflicts_ef94b3 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_002_stale-vs-current-document-conflicts_ef94b3 | 1000 | 1
| hgr_agentic_003_appended-document-lifecycle-changes_915c34 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_003_appended-document-lifecycle-changes_915c34 | 1000 | 1
| hgr_agentic_004_table-text-reasoning_91498f | table + text reasoning | generated/agentic-workspaces/hgr_agentic_004_table-text-reasoning_91498f | 1000 | 1
| hgr_agentic_005_source-authority-conflicts_460f6b | source authority conflicts | generated/agentic-workspaces/hgr_agentic_005_source-authority-conflicts_460f6b | 1000 | 1
| hgr_agentic_006_evidence-insufficiency-abstention_0c5ede | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_006_evidence-insufficiency-abstention_0c5ede | 1000 | 1
| hgr_agentic_007_citation-supports-fact-but-not-conclusion_bdcc4e | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_007_citation-supports-fact-but-not-conclusion_bdcc4e | 1000 | 1
| hgr_agentic_008_entity-disambiguation_a4a101 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_008_entity-disambiguation_a4a101 | 1000 | 1
| hgr_agentic_009_temporal-questions-as-of-date-x_4d20d7 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_009_temporal-questions-as-of-date-x_4d20d7 | 1000 | 1
| hgr_agentic_010_cross-document-contradiction_345aec | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_010_cross-document-contradiction_345aec | 1000 | 1
| hgr_agentic_011_multi-hop-synthesis_348bbb | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_011_multi-hop-synthesis_348bbb | 1000 | 1
| hgr_agentic_012_stale-vs-current-document-conflicts_f094b5 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_012_stale-vs-current-document-conflicts_f094b5 | 1000 | 1
| hgr_agentic_013_appended-document-lifecycle-changes_945c38 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_013_appended-document-lifecycle-changes_945c38 | 1000 | 1
| hgr_agentic_014_table-text-reasoning_444046 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_014_table-text-reasoning_444046 | 1000 | 1
| hgr_agentic_015_source-authority-conflicts_450f6a | source authority conflicts | generated/agentic-workspaces/hgr_agentic_015_source-authority-conflicts_450f6a | 1000 | 1
| hgr_agentic_016_evidence-insufficiency-abstention_0f5ee3 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_016_evidence-insufficiency-abstention_0f5ee3 | 1000 | 1
| hgr_agentic_017_citation-supports-fact-but-not-conclusion_bacc4a | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_017_citation-supports-fact-but-not-conclusion_bacc4a | 1000 | 1
| hgr_agentic_018_entity-disambiguation_a3a100 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_018_entity-disambiguation_a3a100 | 1000 | 1
| hgr_agentic_019_temporal-questions-as-of-date-x_4e20d9 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_019_temporal-questions-as-of-date-x_4e20d9 | 1000 | 1
| hgr_agentic_020_cross-document-contradiction_315ae7 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_020_cross-document-contradiction_315ae7 | 1000 | 1
| hgr_agentic_021_multi-hop-synthesis_75f99a | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_021_multi-hop-synthesis_75f99a | 1000 | 1
| hgr_agentic_022_stale-vs-current-document-conflicts_f194b6 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_022_stale-vs-current-document-conflicts_f194b6 | 1000 | 1
| hgr_agentic_023_appended-document-lifecycle-changes_935c37 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_023_appended-document-lifecycle-changes_935c37 | 1000 | 1
| hgr_agentic_024_table-text-reasoning_414041 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_024_table-text-reasoning_414041 | 1000 | 1
| hgr_agentic_025_source-authority-conflicts_440f68 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_025_source-authority-conflicts_440f68 | 1000 | 1
| hgr_agentic_026_evidence-insufficiency-abstention_0e5ee2 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_026_evidence-insufficiency-abstention_0e5ee2 | 1000 | 1
| hgr_agentic_027_citation-supports-fact-but-not-conclusion_bbcc4b | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_027_citation-supports-fact-but-not-conclusion_bbcc4b | 1000 | 1
| hgr_agentic_028_entity-disambiguation_100c96 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_028_entity-disambiguation_100c96 | 1000 | 1
| hgr_agentic_029_temporal-questions-as-of-date-x_4f20db | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_029_temporal-questions-as-of-date-x_4f20db | 1000 | 1
| hgr_agentic_030_cross-document-contradiction_325ae9 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_030_cross-document-contradiction_325ae9 | 1000 | 1
| hgr_agentic_031_multi-hop-synthesis_74f999 | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_031_multi-hop-synthesis_74f999 | 1000 | 1
| hgr_agentic_032_stale-vs-current-document-conflicts_8c28ee | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_032_stale-vs-current-document-conflicts_8c28ee | 1000 | 1
| hgr_agentic_033_appended-document-lifecycle-changes_99ac09 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_033_appended-document-lifecycle-changes_99ac09 | 1000 | 1
| hgr_agentic_034_table-text-reasoning_4e4055 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_034_table-text-reasoning_4e4055 | 1000 | 1
| hgr_agentic_035_source-authority-conflicts_30a8e6 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_035_source-authority-conflicts_30a8e6 | 1000 | 1
| hgr_agentic_036_evidence-insufficiency-abstention_a2ca1a | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_036_evidence-insufficiency-abstention_a2ca1a | 1000 | 1
| hgr_agentic_037_citation-supports-fact-but-not-conclusion_227543 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_037_citation-supports-fact-but-not-conclusion_227543 | 1000 | 1
| hgr_agentic_038_entity-disambiguation_110c97 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_038_entity-disambiguation_110c97 | 1000 | 1
| hgr_agentic_039_temporal-questions-as-of-date-x_fc8189 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_039_temporal-questions-as-of-date-x_fc8189 | 1000 | 1
| hgr_agentic_040_cross-document-contradiction_b1a754 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_040_cross-document-contradiction_b1a754 | 1000 | 1
| hgr_agentic_041_multi-hop-synthesis_76f99c | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_041_multi-hop-synthesis_76f99c | 1000 | 1
| hgr_agentic_042_stale-vs-current-document-conflicts_8d28ef | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_042_stale-vs-current-document-conflicts_8d28ef | 1000 | 1
| hgr_agentic_043_appended-document-lifecycle-changes_98ac08 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_043_appended-document-lifecycle-changes_98ac08 | 1000 | 1
| hgr_agentic_044_table-text-reasoning_aac67b | table + text reasoning | generated/agentic-workspaces/hgr_agentic_044_table-text-reasoning_aac67b | 1000 | 1
| hgr_agentic_045_source-authority-conflicts_31a8e7 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_045_source-authority-conflicts_31a8e7 | 1000 | 1
| hgr_agentic_046_evidence-insufficiency-abstention_a5ca1e | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_046_evidence-insufficiency-abstention_a5ca1e | 1000 | 1
| hgr_agentic_047_citation-supports-fact-but-not-conclusion_1f753e | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_047_citation-supports-fact-but-not-conclusion_1f753e | 1000 | 1
| hgr_agentic_048_entity-disambiguation_0b0c8e | entity disambiguation | generated/agentic-workspaces/hgr_agentic_048_entity-disambiguation_0b0c8e | 1000 | 1
| hgr_agentic_049_temporal-questions-as-of-date-x_fb8188 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_049_temporal-questions-as-of-date-x_fb8188 | 1000 | 1
| hgr_agentic_050_cross-document-contradiction_aea74f | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_050_cross-document-contradiction_aea74f | 1000 | 1
| hgr_agentic_051_multi-hop-synthesis_79f9a0 | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_051_multi-hop-synthesis_79f9a0 | 1000 | 1
| hgr_agentic_052_stale-vs-current-document-conflicts_8e28f1 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_052_stale-vs-current-document-conflicts_8e28f1 | 1000 | 1
| hgr_agentic_053_appended-document-lifecycle-changes_97ac06 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_053_appended-document-lifecycle-changes_97ac06 | 1000 | 1
| hgr_agentic_054_table-text-reasoning_b1c686 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_054_table-text-reasoning_b1c686 | 1000 | 1
| hgr_agentic_055_source-authority-conflicts_32a8e9 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_055_source-authority-conflicts_32a8e9 | 1000 | 1
| hgr_agentic_056_evidence-insufficiency-abstention_a4ca1d | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_056_evidence-insufficiency-abstention_a4ca1d | 1000 | 1
| hgr_agentic_057_citation-supports-fact-but-not-conclusion_20753f | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_057_citation-supports-fact-but-not-conclusion_20753f | 1000 | 1
| hgr_agentic_058_entity-disambiguation_0c0c8f | entity disambiguation | generated/agentic-workspaces/hgr_agentic_058_entity-disambiguation_0c0c8f | 1000 | 1
| hgr_agentic_059_temporal-questions-as-of-date-x_fa8186 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_059_temporal-questions-as-of-date-x_fa8186 | 1000 | 1
| hgr_agentic_060_cross-document-contradiction_afa751 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_060_cross-document-contradiction_afa751 | 1000 | 1
| hgr_agentic_061_multi-hop-synthesis_6bf98a | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_061_multi-hop-synthesis_6bf98a | 1000 | 1
| hgr_agentic_062_stale-vs-current-document-conflicts_8f28f2 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_062_stale-vs-current-document-conflicts_8f28f2 | 1000 | 1
| hgr_agentic_063_appended-document-lifecycle-changes_9eac11 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_063_appended-document-lifecycle-changes_9eac11 | 1000 | 1
| hgr_agentic_064_table-text-reasoning_b4c68b | table + text reasoning | generated/agentic-workspaces/hgr_agentic_064_table-text-reasoning_b4c68b | 1000 | 1
| hgr_agentic_065_source-authority-conflicts_2ba8de | source authority conflicts | generated/agentic-workspaces/hgr_agentic_065_source-authority-conflicts_2ba8de | 1000 | 1
| hgr_agentic_066_evidence-insufficiency-abstention_9fca15 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_066_evidence-insufficiency-abstention_9fca15 | 1000 | 1
| hgr_agentic_067_citation-supports-fact-but-not-conclusion_257547 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_067_citation-supports-fact-but-not-conclusion_257547 | 1000 | 1
| hgr_agentic_068_entity-disambiguation_160c9f | entity disambiguation | generated/agentic-workspaces/hgr_agentic_068_entity-disambiguation_160c9f | 1000 | 1
| hgr_agentic_069_temporal-questions-as-of-date-x_018191 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_069_temporal-questions-as-of-date-x_018191 | 1000 | 1
| hgr_agentic_070_cross-document-contradiction_b4a759 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_070_cross-document-contradiction_b4a759 | 1000 | 1
| hgr_agentic_071_multi-hop-synthesis_6af989 | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_071_multi-hop-synthesis_6af989 | 1000 | 1
| hgr_agentic_072_stale-vs-current-document-conflicts_9028f4 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_072_stale-vs-current-document-conflicts_9028f4 | 1000 | 1
| hgr_agentic_073_appended-document-lifecycle-changes_9dac10 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_073_appended-document-lifecycle-changes_9dac10 | 1000 | 1
| hgr_agentic_074_table-text-reasoning_673fed | table + text reasoning | generated/agentic-workspaces/hgr_agentic_074_table-text-reasoning_673fed | 1000 | 1
| hgr_agentic_075_source-authority-conflicts_2ca8df | source authority conflicts | generated/agentic-workspaces/hgr_agentic_075_source-authority-conflicts_2ca8df | 1000 | 1
| hgr_agentic_076_evidence-insufficiency-abstention_9eca13 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_076_evidence-insufficiency-abstention_9eca13 | 1000 | 1
| hgr_agentic_077_citation-supports-fact-but-not-conclusion_267549 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_077_citation-supports-fact-but-not-conclusion_267549 | 1000 | 1
| hgr_agentic_078_entity-disambiguation_170ca1 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_078_entity-disambiguation_170ca1 | 1000 | 1
| hgr_agentic_079_temporal-questions-as-of-date-x_008190 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_079_temporal-questions-as-of-date-x_008190 | 1000 | 1
| hgr_agentic_080_cross-document-contradiction_b5a75a | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_080_cross-document-contradiction_b5a75a | 1000 | 1
| hgr_agentic_081_multi-hop-synthesis_1facef | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_081_multi-hop-synthesis_1facef | 1000 | 1
| hgr_agentic_082_stale-vs-current-document-conflicts_9128f5 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_082_stale-vs-current-document-conflicts_9128f5 | 1000 | 1
| hgr_agentic_083_appended-document-lifecycle-changes_9cac0e | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_083_appended-document-lifecycle-changes_9cac0e | 1000 | 1
| hgr_agentic_084_table-text-reasoning_683fef | table + text reasoning | generated/agentic-workspaces/hgr_agentic_084_table-text-reasoning_683fef | 1000 | 1
| hgr_agentic_085_source-authority-conflicts_2da8e1 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_085_source-authority-conflicts_2da8e1 | 1000 | 1
| hgr_agentic_086_evidence-insufficiency-abstention_a1ca18 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_086_evidence-insufficiency-abstention_a1ca18 | 1000 | 1
| hgr_agentic_087_citation-supports-fact-but-not-conclusion_237544 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_087_citation-supports-fact-but-not-conclusion_237544 | 1000 | 1
| hgr_agentic_088_entity-disambiguation_69f33e | entity disambiguation | generated/agentic-workspaces/hgr_agentic_088_entity-disambiguation_69f33e | 1000 | 1
| hgr_agentic_089_temporal-questions-as-of-date-x_ff818e | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_089_temporal-questions-as-of-date-x_ff818e | 1000 | 1
| hgr_agentic_090_cross-document-contradiction_b2a755 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_090_cross-document-contradiction_b2a755 | 1000 | 1
| hgr_agentic_091_multi-hop-synthesis_20acf1 | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_091_multi-hop-synthesis_20acf1 | 1000 | 1
| hgr_agentic_092_stale-vs-current-document-conflicts_9228f7 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_092_stale-vs-current-document-conflicts_9228f7 | 1000 | 1
| hgr_agentic_093_appended-document-lifecycle-changes_9bac0c | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_093_appended-document-lifecycle-changes_9bac0c | 1000 | 1
| hgr_agentic_094_table-text-reasoning_5d3fde | table + text reasoning | generated/agentic-workspaces/hgr_agentic_094_table-text-reasoning_5d3fde | 1000 | 1
| hgr_agentic_095_source-authority-conflicts_2ea8e2 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_095_source-authority-conflicts_2ea8e2 | 1000 | 1
| hgr_agentic_096_evidence-insufficiency-abstention_a0ca17 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_096_evidence-insufficiency-abstention_a0ca17 | 1000 | 1
| hgr_agentic_097_citation-supports-fact-but-not-conclusion_247546 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_097_citation-supports-fact-but-not-conclusion_247546 | 1000 | 1
| hgr_agentic_098_entity-disambiguation_68f33c | entity disambiguation | generated/agentic-workspaces/hgr_agentic_098_entity-disambiguation_68f33c | 1000 | 1
| hgr_agentic_099_temporal-questions-as-of-date-x_fe818d | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_099_temporal-questions-as-of-date-x_fe818d | 1000 | 1
| hgr_agentic_100_cross-document-contradiction_b3a757 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_100_cross-document-contradiction_b3a757 | 1000 | 1
| hgr_agentic_101_multi-hop-synthesis_26acfa | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_101_multi-hop-synthesis_26acfa | 1000 | 1
| hgr_agentic_102_stale-vs-current-document-conflicts_8328df | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_102_stale-vs-current-document-conflicts_8328df | 1000 | 1
| hgr_agentic_103_appended-document-lifecycle-changes_a2ac17 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_103_appended-document-lifecycle-changes_a2ac17 | 1000 | 1
| hgr_agentic_104_table-text-reasoning_8e498a | table + text reasoning | generated/agentic-workspaces/hgr_agentic_104_table-text-reasoning_8e498a | 1000 | 1
| hgr_agentic_105_source-authority-conflicts_27a8d7 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_105_source-authority-conflicts_27a8d7 | 1000 | 1
| hgr_agentic_106_evidence-insufficiency-abstention_abca28 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_106_evidence-insufficiency-abstention_abca28 | 1000 | 1
| hgr_agentic_107_citation-supports-fact-but-not-conclusion_197534 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_107_citation-supports-fact-but-not-conclusion_197534 | 1000 | 1
| hgr_agentic_108_entity-disambiguation_6af33f | entity disambiguation | generated/agentic-workspaces/hgr_agentic_108_entity-disambiguation_6af33f | 1000 | 1
| hgr_agentic_109_temporal-questions-as-of-date-x_f5817e | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_109_temporal-questions-as-of-date-x_f5817e | 1000 | 1
| hgr_agentic_110_cross-document-contradiction_b8a75f | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_110_cross-document-contradiction_b8a75f | 1000 | 1
| hgr_agentic_111_multi-hop-synthesis_23acf5 | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_111_multi-hop-synthesis_23acf5 | 1000 | 1
| hgr_agentic_112_stale-vs-current-document-conflicts_8428e1 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_112_stale-vs-current-document-conflicts_8428e1 | 1000 | 1
| hgr_agentic_113_appended-document-lifecycle-changes_a1ac16 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_113_appended-document-lifecycle-changes_a1ac16 | 1000 | 1
| hgr_agentic_114_table-text-reasoning_90498d | table + text reasoning | generated/agentic-workspaces/hgr_agentic_114_table-text-reasoning_90498d | 1000 | 1
| hgr_agentic_115_source-authority-conflicts_28a8d9 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_115_source-authority-conflicts_28a8d9 | 1000 | 1
| hgr_agentic_116_evidence-insufficiency-abstention_aaca26 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_116_evidence-insufficiency-abstention_aaca26 | 1000 | 1
| hgr_agentic_117_citation-supports-fact-but-not-conclusion_1a7536 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_117_citation-supports-fact-but-not-conclusion_1a7536 | 1000 | 1
| hgr_agentic_118_entity-disambiguation_6df344 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_118_entity-disambiguation_6df344 | 1000 | 1
| hgr_agentic_119_temporal-questions-as-of-date-x_f4817d | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_119_temporal-questions-as-of-date-x_f4817d | 1000 | 1
| hgr_agentic_120_cross-document-contradiction_b9a760 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_120_cross-document-contradiction_b9a760 | 1000 | 1
| hgr_agentic_121_multi-hop-synthesis_29acff | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_121_multi-hop-synthesis_29acff | 1000 | 1
| hgr_agentic_122_stale-vs-current-document-conflicts_2ac262 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_122_stale-vs-current-document-conflicts_2ac262 | 1000 | 1
| hgr_agentic_123_appended-document-lifecycle-changes_314b67 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_123_appended-document-lifecycle-changes_314b67 | 1000 | 1
| hgr_agentic_124_table-text-reasoning_454047 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_124_table-text-reasoning_454047 | 1000 | 1
| hgr_agentic_125_source-authority-conflicts_fa8890 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_125_source-authority-conflicts_fa8890 | 1000 | 1
| hgr_agentic_126_evidence-insufficiency-abstention_c26b04 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_126_evidence-insufficiency-abstention_c26b04 | 1000 | 1
| hgr_agentic_127_citation-supports-fact-but-not-conclusion_448951 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_127_citation-supports-fact-but-not-conclusion_448951 | 1000 | 1
| hgr_agentic_128_entity-disambiguation_6ff347 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_128_entity-disambiguation_6ff347 | 1000 | 1
| hgr_agentic_129_temporal-questions-as-of-date-x_29ea6f | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_129_temporal-questions-as-of-date-x_29ea6f | 1000 | 1
| hgr_agentic_130_cross-document-contradiction_8414ed | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_130_cross-document-contradiction_8414ed | 1000 | 1
| hgr_agentic_131_multi-hop-synthesis_2aad01 | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_131_multi-hop-synthesis_2aad01 | 1000 | 1
| hgr_agentic_132_stale-vs-current-document-conflicts_2dc267 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_132_stale-vs-current-document-conflicts_2dc267 | 1000 | 1
| hgr_agentic_133_appended-document-lifecycle-changes_324b69 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_133_appended-document-lifecycle-changes_324b69 | 1000 | 1
| hgr_agentic_134_table-text-reasoning_434044 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_134_table-text-reasoning_434044 | 1000 | 1
| hgr_agentic_135_source-authority-conflicts_f9888f | source authority conflicts | generated/agentic-workspaces/hgr_agentic_135_source-authority-conflicts_f9888f | 1000 | 1
| hgr_agentic_136_evidence-insufficiency-abstention_c36b05 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_136_evidence-insufficiency-abstention_c36b05 | 1000 | 1
| hgr_agentic_137_citation-supports-fact-but-not-conclusion_41894d | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_137_citation-supports-fact-but-not-conclusion_41894d | 1000 | 1
| hgr_agentic_138_entity-disambiguation_6ef346 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_138_entity-disambiguation_6ef346 | 1000 | 1
| hgr_agentic_139_temporal-questions-as-of-date-x_2aea70 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_139_temporal-questions-as-of-date-x_2aea70 | 1000 | 1
| hgr_agentic_140_cross-document-contradiction_8314eb | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_140_cross-document-contradiction_8314eb | 1000 | 1
| hgr_agentic_141_multi-hop-synthesis_caf95f | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_141_multi-hop-synthesis_caf95f | 1000 | 1
| hgr_agentic_142_stale-vs-current-document-conflicts_2cc265 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_142_stale-vs-current-document-conflicts_2cc265 | 1000 | 1
| hgr_agentic_143_appended-document-lifecycle-changes_334b6a | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_143_appended-document-lifecycle-changes_334b6a | 1000 | 1
| hgr_agentic_144_table-text-reasoning_424042 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_144_table-text-reasoning_424042 | 1000 | 1
| hgr_agentic_145_source-authority-conflicts_f8888d | source authority conflicts | generated/agentic-workspaces/hgr_agentic_145_source-authority-conflicts_f8888d | 1000 | 1
| hgr_agentic_146_evidence-insufficiency-abstention_c46b07 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_146_evidence-insufficiency-abstention_c46b07 | 1000 | 1
| hgr_agentic_147_citation-supports-fact-but-not-conclusion_42894e | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_147_citation-supports-fact-but-not-conclusion_42894e | 1000 | 1
| hgr_agentic_148_entity-disambiguation_05c7cc | entity disambiguation | generated/agentic-workspaces/hgr_agentic_148_entity-disambiguation_05c7cc | 1000 | 1
| hgr_agentic_149_temporal-questions-as-of-date-x_2bea72 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_149_temporal-questions-as-of-date-x_2bea72 | 1000 | 1
| hgr_agentic_150_cross-document-contradiction_8214ea | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_150_cross-document-contradiction_8214ea | 1000 | 1
| hgr_agentic_151_multi-hop-synthesis_c9f95e | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_151_multi-hop-synthesis_c9f95e | 1000 | 1
| hgr_agentic_152_stale-vs-current-document-conflicts_27c25d | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_152_stale-vs-current-document-conflicts_27c25d | 1000 | 1
| hgr_agentic_153_appended-document-lifecycle-changes_2c4b5f | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_153_appended-document-lifecycle-changes_2c4b5f | 1000 | 1
| hgr_agentic_154_table-text-reasoning_40403f | table + text reasoning | generated/agentic-workspaces/hgr_agentic_154_table-text-reasoning_40403f | 1000 | 1
| hgr_agentic_155_source-authority-conflicts_ff8898 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_155_source-authority-conflicts_ff8898 | 1000 | 1
| hgr_agentic_156_evidence-insufficiency-abstention_c56b08 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_156_evidence-insufficiency-abstention_c56b08 | 1000 | 1
| hgr_agentic_157_citation-supports-fact-but-not-conclusion_478956 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_157_citation-supports-fact-but-not-conclusion_478956 | 1000 | 1
| hgr_agentic_158_entity-disambiguation_06c7ce | entity disambiguation | generated/agentic-workspaces/hgr_agentic_158_entity-disambiguation_06c7ce | 1000 | 1
| hgr_agentic_159_temporal-questions-as-of-date-x_2cea73 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_159_temporal-questions-as-of-date-x_2cea73 | 1000 | 1
| hgr_agentic_160_cross-document-contradiction_8114e8 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_160_cross-document-contradiction_8114e8 | 1000 | 1
| hgr_agentic_161_multi-hop-synthesis_c7f95b | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_161_multi-hop-synthesis_c7f95b | 1000 | 1
| hgr_agentic_162_stale-vs-current-document-conflicts_26c25c | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_162_stale-vs-current-document-conflicts_26c25c | 1000 | 1
| hgr_agentic_163_appended-document-lifecycle-changes_2d4b61 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_163_appended-document-lifecycle-changes_2d4b61 | 1000 | 1
| hgr_agentic_164_table-text-reasoning_3f403e | table + text reasoning | generated/agentic-workspaces/hgr_agentic_164_table-text-reasoning_3f403e | 1000 | 1
| hgr_agentic_165_source-authority-conflicts_fe8897 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_165_source-authority-conflicts_fe8897 | 1000 | 1
| hgr_agentic_166_evidence-insufficiency-abstention_c66b0a | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_166_evidence-insufficiency-abstention_c66b0a | 1000 | 1
| hgr_agentic_167_citation-supports-fact-but-not-conclusion_488958 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_167_citation-supports-fact-but-not-conclusion_488958 | 1000 | 1
| hgr_agentic_168_entity-disambiguation_04c7cb | entity disambiguation | generated/agentic-workspaces/hgr_agentic_168_entity-disambiguation_04c7cb | 1000 | 1
| hgr_agentic_169_temporal-questions-as-of-date-x_2dea75 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_169_temporal-questions-as-of-date-x_2dea75 | 1000 | 1
| hgr_agentic_170_cross-document-contradiction_8014e7 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_170_cross-document-contradiction_8014e7 | 1000 | 1
| hgr_agentic_171_multi-hop-synthesis_c6f959 | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_171_multi-hop-synthesis_c6f959 | 1000 | 1
| hgr_agentic_172_stale-vs-current-document-conflicts_29c260 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_172_stale-vs-current-document-conflicts_29c260 | 1000 | 1
| hgr_agentic_173_appended-document-lifecycle-changes_2e4b62 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_173_appended-document-lifecycle-changes_2e4b62 | 1000 | 1
| hgr_agentic_174_table-text-reasoning_4d4054 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_174_table-text-reasoning_4d4054 | 1000 | 1
| hgr_agentic_175_source-authority-conflicts_fd8895 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_175_source-authority-conflicts_fd8895 | 1000 | 1
| hgr_agentic_176_evidence-insufficiency-abstention_c76b0b | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_176_evidence-insufficiency-abstention_c76b0b | 1000 | 1
| hgr_agentic_177_citation-supports-fact-but-not-conclusion_458953 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_177_citation-supports-fact-but-not-conclusion_458953 | 1000 | 1
| hgr_agentic_178_entity-disambiguation_01c7c6 | entity disambiguation | generated/agentic-workspaces/hgr_agentic_178_entity-disambiguation_01c7c6 | 1000 | 1
| hgr_agentic_179_temporal-questions-as-of-date-x_2eea77 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_179_temporal-questions-as-of-date-x_2eea77 | 1000 | 1
| hgr_agentic_180_cross-document-contradiction_7f14e5 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_180_cross-document-contradiction_7f14e5 | 1000 | 1
| hgr_agentic_181_multi-hop-synthesis_d4f96f | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_181_multi-hop-synthesis_d4f96f | 1000 | 1
| hgr_agentic_182_stale-vs-current-document-conflicts_28c25f | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_182_stale-vs-current-document-conflicts_28c25f | 1000 | 1
| hgr_agentic_183_appended-document-lifecycle-changes_2f4b64 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_183_appended-document-lifecycle-changes_2f4b64 | 1000 | 1
| hgr_agentic_184_table-text-reasoning_adc680 | table + text reasoning | generated/agentic-workspaces/hgr_agentic_184_table-text-reasoning_adc680 | 1000 | 1
| hgr_agentic_185_source-authority-conflicts_fc8894 | source authority conflicts | generated/agentic-workspaces/hgr_agentic_185_source-authority-conflicts_fc8894 | 1000 | 1
| hgr_agentic_186_evidence-insufficiency-abstention_c86b0d | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_186_evidence-insufficiency-abstention_c86b0d | 1000 | 1
| hgr_agentic_187_citation-supports-fact-but-not-conclusion_468955 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_187_citation-supports-fact-but-not-conclusion_468955 | 1000 | 1
| hgr_agentic_188_entity-disambiguation_0fc7dc | entity disambiguation | generated/agentic-workspaces/hgr_agentic_188_entity-disambiguation_0fc7dc | 1000 | 1
| hgr_agentic_189_temporal-questions-as-of-date-x_2fea78 | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_189_temporal-questions-as-of-date-x_2fea78 | 1000 | 1
| hgr_agentic_190_cross-document-contradiction_7e14e3 | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_190_cross-document-contradiction_7e14e3 | 1000 | 1
| hgr_agentic_191_multi-hop-synthesis_d3f96e | multi-hop synthesis | generated/agentic-workspaces/hgr_agentic_191_multi-hop-synthesis_d3f96e | 1000 | 1
| hgr_agentic_192_stale-vs-current-document-conflicts_33c270 | stale-vs-current document conflicts | generated/agentic-workspaces/hgr_agentic_192_stale-vs-current-document-conflicts_33c270 | 1000 | 1
| hgr_agentic_193_appended-document-lifecycle-changes_384b72 | appended document lifecycle changes | generated/agentic-workspaces/hgr_agentic_193_appended-document-lifecycle-changes_384b72 | 1000 | 1
| hgr_agentic_194_table-text-reasoning_abc67d | table + text reasoning | generated/agentic-workspaces/hgr_agentic_194_table-text-reasoning_abc67d | 1000 | 1
| hgr_agentic_195_source-authority-conflicts_03889f | source authority conflicts | generated/agentic-workspaces/hgr_agentic_195_source-authority-conflicts_03889f | 1000 | 1
| hgr_agentic_196_evidence-insufficiency-abstention_b96af5 | evidence insufficiency / abstention | generated/agentic-workspaces/hgr_agentic_196_evidence-insufficiency-abstention_b96af5 | 1000 | 1
| hgr_agentic_197_citation-supports-fact-but-not-conclusion_3b8943 | citation supports fact but not conclusion | generated/agentic-workspaces/hgr_agentic_197_citation-supports-fact-but-not-conclusion_3b8943 | 1000 | 1
| hgr_agentic_198_entity-disambiguation_10c7de | entity disambiguation | generated/agentic-workspaces/hgr_agentic_198_entity-disambiguation_10c7de | 1000 | 1
| hgr_agentic_199_temporal-questions-as-of-date-x_30ea7a | temporal questions: as of date X | generated/agentic-workspaces/hgr_agentic_199_temporal-questions-as-of-date-x_30ea7a | 1000 | 1
| hgr_agentic_200_cross-document-contradiction_8d14fb | cross-document contradiction | generated/agentic-workspaces/hgr_agentic_200_cross-document-contradiction_8d14fb | 1000 | 1 |
