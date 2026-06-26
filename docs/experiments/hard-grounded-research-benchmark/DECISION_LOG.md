# Decision Log

## 2026-06-26 — Materialize appendix evidence for lifecycle tasks

Decision: Add explicit synthetic appendix evidence units to document-lifecycle pilot items instead of representing appended document state only inside challenge metadata.

Rationale: The quality audit correctly flagged lifecycle items as repair-before-gold because they had only original-body evidence. To test lifecycle reasoning, models and reviewers need a citeable appended/superseding document unit.

Consequence: Appended lifecycle pilot items now include both original evidence and a citeable appendix update evidence unit, and the challenge payload points to the appendix evidence id.

## 2026-06-26 — Audit machine-seeded items before gold review

Decision: Add a deterministic item-quality audit that flags pilot items needing repair or careful review before human adjudication can promote them to gold.

Rationale: The pilot suite intentionally composes and perturbs Hugging Face rows, which can create weak or artificial items. A paper-worthy benchmark needs explicit pre-adjudication quality checks so machine-seeded artifacts do not silently become gold data.

Consequence: `benchmark:hard-grounded:audit` now emits `ITEM_QUALITY_AUDIT.md` and `generated/item-quality-audit.json` with per-item repair priorities and findings.

## 2026-06-26 — Promote aggregate scores into failure analysis

Decision: Extend the baseline report from macro metrics into per-category failure counts and representative failed examples for the lexical baseline.

Rationale: A benchmark paper needs to explain what failures the tasks expose, not only show that a baseline score is low. Representative failures connect the taxonomy to concrete evidence-use errors.

Consequence: `benchmark:hard-grounded:report` now includes lexical failure taxonomy and example failures in both `BASELINE_ANALYSIS.md` and `generated/baseline-analysis.json`.

## 2026-06-26 — Summarize baselines as reproducible paper tables

Decision: Add a report builder that turns checked-in run reports, gold readiness, and model-baseline readiness into a Markdown analysis and machine-readable JSON.

Rationale: Raw score JSON is useful for automation but weak as paper evidence. The benchmark needs reproducible category-level result tables that separate oracle sanity checks, non-oracle failures, dry-run model readiness, and unreviewed gold status.

Consequence: `benchmark:hard-grounded:report` now emits `BASELINE_ANALYSIS.md` and `generated/baseline-analysis.json`.

## 2026-06-26 — Make model baselines prompt-auditable first

Decision: Add an OpenAI-compatible baseline harness whose default mode writes prompt packets and a run manifest, with API execution gated behind an explicit `--run` flag.

Rationale: Model baselines are necessary for a publishable benchmark, but results must be reproducible and inspectable before spending API calls. Prompt packets let reviewers audit the exact evidence, challenge payload, and JSON answer contract sent to a model.

Consequence: `benchmark:hard-grounded:openai` now emits `runs/openai-grounded-baseline-v1/prompt-packet.jsonl` and `run-manifest.json` in dry-run mode; scored submissions are produced only with `--run` and `OPENAI_API_KEY`.

## 2026-06-26 — Add the first non-oracle retrieval baseline

Decision: Add a lexical evidence baseline that ranks provided evidence by question-token overlap, answers with simple abstain/conflict/label/text heuristics, and scores through the same external submission path as model systems.

Rationale: Previous weak baselines still read native answers, so they were scorer diagnostics rather than credible research-QA systems. A publishable benchmark needs baselines that fail for realistic reasons without privileged labels.

Consequence: `benchmark:hard-grounded:lexical` now emits `runs/lexical-evidence-baseline-v1/submission.json` and `runs/lexical-evidence-baseline-v1/report.json`.

## 2026-06-26 — Gate gold release on validated adjudication

Decision: Add an adjudication builder that validates reviewer labels, final answers, citation ids, insufficiency/conflict flags, notes, and challenge preservation before emitting a gold suite.

Rationale: The pilot suite is machine-seeded and should remain visibly non-gold until human review is complete. A paper benchmark needs an enforceable promotion path from review queue to publishable gold data.

Consequence: `benchmark:hard-grounded:adjudicate` now writes `generated/gold-suite-summary.json` on every run and emits `generated/gold-suite.json` only when all items are valid reviewed rows.

## 2026-06-26 — Add a deterministic local runner before API model runs

Decision: Add a local rule runner that writes full submission objects and scores them through the same evaluator path intended for model systems.

Rationale: The benchmark needs a reproducible end-to-end runner contract before spending API calls on frontier or open model baselines.

Consequence: `benchmark:hard-grounded:run` now emits `runs/local-rule-agent-v1/submission.json` and `runs/local-rule-agent-v1/report.json`.

## 2026-06-26 — Prefer materializable Hugging Face sources

Decision: Use Hugging Face datasets that can be sampled through the Dataset Viewer API for the working benchmark seed, replacing non-materializable choices when a viewer-accessible equivalent exists.

Rationale: A paper-worthy benchmark needs concrete, inspectable examples, not only dataset citations. `stanfordnlp/wikitablequestions` requires arbitrary Python in the Dataset Viewer and `defunct-datasets/eli5` has the viewer disabled, so they are poor defaults for an executable seed suite. `danwakeem/wikitablequestions-wtq` and `Pavithree/eli5` preserve the same benchmark roles while allowing live row materialization.

Consequence: The benchmark runner now fails if it cannot normalize live rows from the selected HF sources, and `generated/materialized-examples.json` becomes part of the harness contract.

## 2026-06-26 — Make scoring deterministic before adding agents

Decision: Add a schema-first local evaluator and a native-label baseline before building any model- or agent-specific runner.

Rationale: The benchmark cannot be paper-worthy if results depend on ad hoc manual judging or a single agent implementation. A deterministic scorer establishes the result contract first: answer correctness, evidence recall, citation precision, citation faithfulness, and abstention quality.

Consequence: `scripts/hard-grounded-research-evaluate.mjs` now scores JSON submissions against the materialized examples and emits reproducible baseline artifacts under `generated/`.

## 2026-06-26 — Treat novelty as a release gate

Decision: Do not claim the benchmark is paper-worthy or novel until a current literature scan supports a narrower contribution claim.

Rationale: The June 2026 scan found adjacent benchmarks for RAG faithfulness, passage grounding, temporal conflicts, conflicting evidence, and long-context/RAG evaluation. The benchmark's plausible contribution is the combined hard-research failure taxonomy, not any single category.

Consequence: `NOVELTY_AUDIT.md` is now part of the project record and lists required work before a completion claim.

## 2026-06-26 — Make categories operational with rubrics

Decision: Promote the ten hard-research categories from labels into an explicit rubric contract before expanding item counts.

Rationale: A larger benchmark would be weak if annotators and evaluators interpreted categories differently. The novelty audit also identified category-specific rubrics as required work before any paper-worthy claim.

Consequence: `rubrics.json` now defines task goals, required dimensions, strong answers, near misses, and hard negatives for every category, and the evaluator includes rubric dimensions in score reports.

## 2026-06-26 — Add diagnostic weak baselines

Decision: Add deterministic non-oracle diagnostic baselines before integrating model runners.

Rationale: The native-label baseline is useful only as an evaluator sanity check because it has access to gold answers and all required citations. A paper benchmark also needs simple systems that visibly fail on evidence recall and citation faithfulness, so the benchmark can show its scoring surface catches grounded-research failures.

Consequence: `benchmark:hard-grounded:evaluate` now emits `baseline-comparisons.json` with oracle, answer-only/no-citation, and first-evidence-only systems.

## 2026-06-26 — Expand to a machine-seeded pilot suite

Decision: Build a deterministic 30-item pilot suite from the materialized Hugging Face rows before attempting the full reviewed benchmark.

Rationale: The paper-worthy target needs 30-50 reviewed items per category, but the benchmark needs an intermediate artifact that exercises all category contracts across multiple examples and remains cheap to regenerate. A machine-seeded pilot lets the scorer, baselines, and data contract scale beyond a single example per category while clearly marking items as needing human adjudication.

Consequence: `generated/pilot-suite.json` now contains three pilot items per category with native, composed, and adversarial-wrapper construction metadata, and the evaluator scores this pilot suite by default.

## 2026-06-26 — Separate pilot items from gold items

Decision: Treat the machine-seeded pilot suite as a review queue, not as publishable gold data.

Rationale: Paper-worthy benchmark claims require adjudicated labels, minimal citation sets, and explicit insufficiency/conflict judgments. The pilot suite is useful for exercising the machinery, but it should not be confused with reviewed ground truth.

Consequence: The generator now emits `generated/adjudication-queue.jsonl`, `generated/adjudication-summary.json`, and `ADJUDICATION_PACKET.md`; the summary marks `gold_ready: false` until human review is complete.

## 2026-06-26 — Make adversarial traps explicit

Decision: Encode category-specific challenge payloads inside pilot items instead of relying on the generic `adversarial_wrapper` flag.

Rationale: Reviewers and model runners need to know the exact trap an item is testing: stale/current conflict, lifecycle supersession, authority ranking, insufficiency, citation overreach, as-of-date leakage, or contradiction handling. A flag alone is not enough to make the benchmark inspectable or reproducible.

Consequence: Pilot items and adjudication queue rows now include structured `challenge` objects with required behavior, invalid evidence policy, and the intended failure mode.

## 2026-06-26 — Make scorer switchable to adjudicated gold

Decision: Add a gold-aware evaluation path that uses `generated/gold-suite.json` final answers and required citation ids when invoked with `--gold`.

Rationale: The pilot scorer is useful before review, but paper results must be computed from adjudicated labels rather than native or machine-seeded answers.

Consequence: `hard-grounded-research-evaluate.mjs --gold` now refuses to run until gold exists, then scores external submissions against adjudicated answers and citation requirements.

## 2026-06-26 — Add a non-oracle citation verifier baseline

Decision: Add a citation-aware verifier baseline that post-checks lexical answers against their cited evidence and abstains when citations do not support the conclusion.

Rationale: The novelty audit requires a third non-oracle baseline beyond lexical retrieval and prompt-auditable model runs. A verifier baseline isolates whether citation checking improves groundedness or merely trades answer coverage for abstention.

Consequence: `benchmark:hard-grounded:verify-citations` now emits `runs/citation-aware-verifier-v1/submission.json` and `report.json`, and the baseline analysis compares verifier deltas against the lexical baseline.

## 2026-06-26 — Add provisional calibration without weakening gold

Decision: Add a mechanically labeled calibration suite that reuses the future gold item shape but is explicitly marked non-gold and separate from strict adjudicated gold.

Rationale: The benchmark needs end-to-end gold-style scoring before human adjudication is complete, but publishing machine-derived labels as gold would corrupt the paper claim. A provisional calibration suite exercises final-answer and required-citation scoring while preserving the all-reviewed gold gate.

Consequence: `benchmark:hard-grounded:calibrate` now emits `generated/calibration-suite.json` and `calibration-suite-summary.json`, and `hard-grounded-research-evaluate.mjs --calibration` scores against those provisional labels without overwriting pilot baseline artifacts.

## 2026-06-26 — Make model baselines source-aware

Decision: Make the OpenAI-compatible baseline runner choose among pilot, provisional calibration, and future gold suites with separate output directories and matching evaluator flags.

Rationale: Paper tables need model baselines over the same label source being reported. A pilot-only model harness would force manual rewiring once calibration or adjudicated gold is available.

Consequence: `benchmark:hard-grounded:openai:calibration` now emits an auditable calibration prompt packet under `runs/openai-grounded-baseline-v1-calibration/`, while `--gold` is already wired to score future reviewed gold without changing code.

## 2026-06-26 — Score conclusion support separately

Decision: Add `conclusion_support` as an explicit evaluator metric that penalizes citation-overreach probes unless the system abstains.

Rationale: Citation precision only checks whether cited ids are in the expected set; it cannot distinguish evidence that supports a true premise from evidence that supports the submitted conclusion. The benchmark's overreach category needs a visible diagnostic for that failure mode.

Consequence: All score reports now include `conclusion_support`, baseline analysis tables expose it, and validation checks keep the overreach diagnostic in the evaluator contract.

## 2026-06-26 — Batch adjudication for double review

Decision: Generate a deterministic adjudication batch manifest with category-level batches and two reviewer slots per item.

Rationale: The benchmark cannot reach paper-worthy gold data with an undifferentiated queue alone. Review work needs explicit batch units, double-review requirements, and disagreement-resolution policy before it can scale beyond a pilot.

Consequence: `benchmark:hard-grounded` now emits `generated/adjudication-batches.json` and `ADJUDICATION_BATCHES.md`, and validation requires both artifacts alongside the adjudication queue.

## 2026-06-26 — Emit reviewer workbooks

Decision: Generate per-batch, per-reviewer JSONL workbooks plus a workbook index from the adjudication batch manifest.

Rationale: A double-review policy is not enough if reviewers still have to edit a shared raw queue. Independent workbook files make review assignment, completion, and later merge/adjudication auditable.

Consequence: `benchmark:hard-grounded` now emits `generated/review-workbooks/*.jsonl`, `generated/review-workbooks/index.json`, and `REVIEW_WORKBOOKS.md` without marking any item reviewed.

## 2026-06-26 — Validate workbook merge readiness

Decision: Add a review-workbook merge validator that counts completed reviews, missing second reviews, disagreements, and invalid reviewer fields before queue merge.

Rationale: Independent workbooks need a gate before they can affect adjudicated labels. The benchmark should prevent accidental gold promotion from incomplete, single-reviewed, or disagreeing rows.

Consequence: `benchmark:hard-grounded:review-merge` now emits `generated/review-merge-report.json` and `REVIEW_MERGE_REPORT.md`; strict mode can fail until every item has two valid agreeing reviews.

## 2026-06-26 — Emit disagreement resolution queue

Decision: Extend review-merge validation to emit a dedicated adjudicator resolution queue for items where completed independent reviews disagree.

Rationale: Double review only helps if disagreements become explicit adjudication tasks instead of being hidden in aggregate counts. A paper-worthy gold process needs a traceable handoff from reviewer disagreement to final adjudicated label.

Consequence: `benchmark:hard-grounded:review-merge` now emits `generated/review-resolution-queue.jsonl` and `REVIEW_RESOLUTION_QUEUE.md`; the queue is empty until completed reviewer workbooks disagree.

## 2026-06-26 — Promote gold only from agreeing double reviews

Decision: Make `benchmark:hard-grounded:adjudicate` build gold only from completed reviewer workbooks after the review-merge report proves every item has two valid agreeing reviews.

Rationale: A single mutable adjudication queue is too weak for paper-grade gold labels. The publishable benchmark needs a deterministic promotion path whose readiness depends on independent review completion, validation, and disagreement resolution.

Consequence: `generated/gold-suite-summary.json` now reports merge-readiness fields from `generated/review-merge-report.json`, and `generated/gold-suite.json` is withheld until the double-review gate is fully satisfied.

## 2026-06-26 — Put quality findings in reviewer rows

Decision: Embed machine item-quality hints directly into every reviewer workbook row.

Rationale: A separate quality audit is easy to miss during labeling. Reviewers need repair priority and specific quality findings beside the question, candidate answer, rubric, and evidence so questionable machine-seeded items are adjudicated with the right skepticism.

Consequence: `generated/review-workbooks/*.jsonl` rows now include `review_priority` and `quality_findings`, while reviewers still edit only `reviewer_fields`.

## 2026-06-26 — Report reviewer agreement metrics

Decision: Add inter-reviewer agreement metrics to the review-merge report.

Rationale: A publishable benchmark needs to report label reliability, not just whether the gold gate passed. Exact agreement and label-only agreement separate citation/answer disagreements from category-label disagreements, which is useful for diagnosing hard grounded research tasks.

Consequence: `generated/review-merge-report.json` and `REVIEW_MERGE_REPORT.md` now include double-reviewed item counts plus exact and label agreement rates overall and by category.

## 2026-06-26 — Summarize baselines by challenge type

Decision: Add challenge-type diagnostic summaries to the baseline analysis report.

Rationale: The paper question asks what makes grounded research hard beyond lookup. Category-level failures are useful, but challenge-type slices expose whether systems fail on stale/current conflicts, appendix lifecycle changes, authority conflicts, citation overreach, as-of-date constraints, or native multi-hop retrieval.

Consequence: `generated/baseline-analysis.json` and `BASELINE_ANALYSIS.md` now report macro metrics by challenge type for every scored baseline.

## 2026-06-26 — Generate a paper draft scaffold

Decision: Add a generated paper draft scaffold built from benchmark artifacts.

Rationale: A publishable benchmark needs a coherent paper argument that stays synchronized with the actual suite, baselines, review gates, and novelty audit. A generated scaffold makes gaps explicit without turning preliminary pilot results into final claims.

Consequence: `scripts/hard-grounded-research-paper-draft.mjs` now emits `PAPER_DRAFT.md` with abstract, contribution, taxonomy, dataset, baseline, challenge-type, gold-gate, novelty, and remaining-work sections.

## 2026-06-26 — Generate a dataset card

Decision: Add a generated dataset card for the hard grounded research pilot.

Rationale: A benchmark that may become public needs explicit provenance, intended-use, review-state, scoring, limitation, and license caveat documentation. Keeping this card generated from artifacts prevents release documentation from drifting away from the actual suite state.

Consequence: `scripts/hard-grounded-research-dataset-card.mjs` now emits `DATASET_CARD.md`, and the paper draft treats the dataset card as a present release artifact rather than a future placeholder.

## 2026-06-26 — Add a machine-readable release gate

Decision: Generate a release-readiness gate that blocks paper/public release until gold review, license review, repair queue, model baselines, and novelty audit checks pass.

Rationale: The dataset card names release risks, but paper readiness needs an executable gate. A machine-readable blocker list prevents preliminary pilot artifacts from being mistaken for a finished benchmark.

Consequence: `scripts/hard-grounded-research-release-gate.mjs` emits `generated/release-gate.json` and `RELEASE_GATE.md`; dataset card and paper draft now surface the current release status and blocker count.

## 2026-06-26 — Generate a license review

Decision: Add a generated upstream dataset license review and make the release gate consume it.

Rationale: Unknown-license sources should not be a vague warning buried in the dataset card. The benchmark needs an auditable list of which datasets block redistribution, what current Hugging Face metadata says, and what action is required before public release.

Consequence: `scripts/hard-grounded-research-license-review.mjs` now emits `generated/license-review.json` and `LICENSE_REVIEW.md`; the release gate, dataset card, and paper draft all surface license-review status and blockers.

## 2026-06-26 — Define pointer-only public packaging

Decision: Generate an item-level public package manifest that strips evidence text for unknown-license datasets while retaining source pointers and text hashes.

Rationale: The license review identifies blockers, but public packaging needs a concrete safe artifact shape. Pointer-only packaging lets the benchmark preserve reproducibility metadata without redistributing text from unresolved upstream licenses.

Consequence: `scripts/hard-grounded-research-package-manifest.mjs` now emits `generated/public-package-manifest.json` and `PUBLIC_PACKAGE_MANIFEST.md`; release gate, dataset card, and paper draft report pointer-only item counts.

## 2026-06-26 — Materialize a sanitized public suite

Decision: Generate a loadable public benchmark package that applies the pointer-only manifest to the pilot suite.

Rationale: A manifest describes redistribution policy, but downstream users need a concrete artifact they can run without accidentally receiving unknown-license evidence text. Materializing the package makes the license-safe shape testable.

Consequence: `scripts/hard-grounded-research-public-package.mjs` now emits `generated/public-package/hard-grounded-research-public-suite.json`, a JSONL companion, and a summary while asserting that pointer-only evidence units do not contain text.

## 2026-06-26 — Add an import path for external model results

Decision: Treat prompt packets and external model outputs as first-class artifacts with a scored importer.

Rationale: The benchmark needs real frontier or open-model baselines, but those runs should not depend on hand-edited submissions or secrets in chat. A deterministic importer lets batch outputs become scored reports with provenance, while keeping dry-run prompt packets useful before credentials are available.

Consequence: OpenAI prompt packets now carry stable custom ids, and `scripts/hard-grounded-research-import-model-results.mjs` converts model output JSONL into benchmark submissions and reports.

## 2026-06-26 — Add review preflight before gold merge

Decision: Generate a preflight work queue for reviewer workbooks before attempting review merge.

Rationale: The gold-data blocker is not actionable if reviewers only learn about missing or invalid fields at merge time. A preflight report makes each incomplete row, missing field, and high-attention item visible before adjudication.

Consequence: `scripts/hard-grounded-research-review-preflight.mjs` now emits `generated/review-preflight.json` and `REVIEW_PREFLIGHT.md`, with strict mode failing until all assigned review rows are complete.

## 2026-06-26 — Gate release on review preflight

Decision: Make the release gate consume review preflight readiness directly.

Rationale: Review merge readiness is too late in the workflow to express the current blocker precisely. The paper gate should show whether reviewer workbooks are complete before asking whether independent reviews agree and can merge.

Consequence: `scripts/hard-grounded-research-release-gate.mjs` now adds `review_preflight_ready`, sourced from `generated/review-preflight.json`, so incomplete reviewer rows appear as an explicit release blocker.

## 2026-06-26 — Generate a novelty comparison matrix

Decision: Convert the June 2026 novelty scan into a generated source-by-category comparison matrix.

Rationale: A paper-worthy benchmark cannot rely on a free-form novelty paragraph. The audit needs to name adjacent benchmarks, identify which categories are already crowded, and preserve the narrow differentiator required for a defensible paper claim.

Consequence: `scripts/hard-grounded-research-novelty-audit.mjs` now emits `generated/novelty-audit.json` and refreshes `NOVELTY_AUDIT.md` with source coverage, novelty-risk ratings, and a conservative no-completion-claim position.

## 2026-06-26 — Gate release on novelty audit JSON

Decision: Make `generated/novelty-audit.json` the authoritative input for the release novelty check.

Rationale: Markdown text is useful for readers but brittle as a release condition. The release gate should consume structured fields such as `status`, `completion_claim_allowed`, and `high_novelty_risk_categories` so the novelty blocker is enforceable.

Consequence: `scripts/hard-grounded-research-release-gate.mjs` now reads `generated/novelty-audit.json` and blocks release until the audit is final and explicitly allows a completion claim.

## 2026-06-26 — Index eligible model baselines by provenance

Decision: Count frontier/open model baselines from scored run reports with provenance manifests instead of hard-coded run directory names.

Rationale: The benchmark should accept OpenAI, open-weight, or externally imported batch results as long as they are scored and reproducible. A fixed OpenAI-only release check would make the paper pipeline brittle and would not support the requested open-model comparison path.

Consequence: `scripts/hard-grounded-research-model-run-index.mjs` now emits `generated/model-run-index.json` and `MODEL_RUN_INDEX.md`; release readiness can distinguish heuristic diagnostics from eligible model baselines.

## 2026-06-26 — Add non-release import smoke fixture

Decision: Add a fixture-backed smoke test for external model-result import without counting it as a model baseline.

Rationale: The importer is part of the paper pipeline, so it needs a local contract test that proves JSONL model outputs can be parsed, scored, indexed, and excluded from release eligibility when they are synthetic fixtures.

Consequence: `scripts/hard-grounded-research-import-smoke.mjs` now generates a full-suite fixture output, imports it, scores it, marks the run as a fixture, refreshes the model-run index, and asserts the fixture is not eligible for the frontier/open-model release gate.

## 2026-06-26 — Gate paper readiness on category scale

Decision: Add a generated scale plan with a target of 30 reviewed items per category.

Rationale: The current 30-item pilot is useful for harness development but too small for the paper claim. The release gate needs a machine-readable scale target so the benchmark cannot be mistaken for paper-ready before each failure mode has enough reviewed examples.

Consequence: `scripts/hard-grounded-research-scale-plan.mjs` now emits `generated/scale-plan.json` and `SCALE_PLAN.md`; the release gate can block paper readiness on category-level reviewed-item scale.

## 2026-06-26 — Add category expansion blueprint

Decision: Extend the scale plan with per-category source datasets and generation strategies.

Rationale: A scale target says how many items are missing, but not how to produce them. The benchmark needs an expansion blueprint tied to existing Hugging Face sources and seed-task transformations so the path from pilot to paper-scale data is executable.

Consequence: `scripts/hard-grounded-research-scale-plan.mjs` now derives per-category expansion strategies from `benchmark-spec.json`, including source datasets, dataset roles, generation strategy, and review requirement.

## 2026-06-26 — Plan expansion review batches

Decision: Convert each category scale gap into explicit, review-sized expansion batches.

Rationale: The benchmark needs operational units that generation and review work can execute independently. Category totals are useful for release gating, but batches make expected new items, required review rows, source datasets, and not-yet-generated status auditable before data growth starts.

Consequence: `scripts/hard-grounded-research-scale-plan.mjs` now emits `expansion_batches`, `planned_new_items`, and `planned_review_rows` in `generated/scale-plan.json`, and `SCALE_PLAN.md` includes a batch table for reviewer operations.

## 2026-06-26 — Pin expansion batches to generation contracts

Decision: Add a generated expansion manifest that turns each planned scale batch into a ready-for-generation contract.

Rationale: Review-sized batches still leave too much ambiguity for dataset growth. A generator needs category-specific instructions, source dataset pointers, required output schema, and acceptance checks so generated items can be audited before entering reviewer workbooks.

Consequence: `scripts/hard-grounded-research-expansion-manifest.mjs` now emits `generated/expansion-manifest.json` and `EXPANSION_MANIFEST.md`, with one contract per scale batch and explicit `source_row_id`, provenance, evidence, and acceptance-check requirements.

## 2026-06-26 — Materialize expansion batches as non-gold candidates

Decision: Generate expansion candidates from every manifest batch while forbidding automatic gold promotion.

Rationale: A paper-scale benchmark needs actual candidate items, not only planned batches. At the same time, machine-expanded items must stay out of the gold suite until two human reviews or adjudication confirm grounding, answerability, and category fit.

Consequence: `scripts/hard-grounded-research-expansion-candidates.mjs` now emits `generated/expansion-candidates.json` and `EXPANSION_CANDIDATES.md`, with 270 review-gated candidates, row-level provenance, and `gold_promotion_allowed: false`.

## 2026-06-26 — Review expansion candidates in separate workbooks

Decision: Generate independent reviewer workbooks for expansion candidates instead of mixing them into the pilot adjudication queue.

Rationale: Expansion candidates are not gold and have different failure risks from the original pilot seeds. Keeping their review workbooks separate preserves provenance, prevents accidental promotion, and gives reviewers explicit fields for category fit and generation defects.

Consequence: `scripts/hard-grounded-research-expansion-review-workbooks.mjs` now emits `EXPANSION_REVIEW_WORKBOOKS.md`, `generated/expansion-review-workbooks/index.json`, and two JSONL reviewer workbooks per expansion batch with gold promotion disabled before merge.

## 2026-06-26 — Gate paper readiness on expansion review completion

Decision: Add a separate preflight gate for expansion review workbooks and wire it into release readiness.

Rationale: The benchmark now has scaled candidate items, but those candidates should not support paper claims until their reviewer rows are complete. A dedicated expansion preflight keeps pilot review status separate from scaled-candidate review status and requires expansion-specific fields for category fit and generation defects.

Consequence: `scripts/hard-grounded-research-expansion-review-preflight.mjs` now emits `generated/expansion-review-preflight.json` and `EXPANSION_REVIEW_PREFLIGHT.md`; `scripts/hard-grounded-research-release-gate.mjs` now blocks release on `expansion_review_preflight_ready`.

## 2026-06-26 — Gate scaled candidates on reviewer agreement

Decision: Add a separate merge-readiness report for expansion candidate reviews.

Rationale: Completed expansion review rows are not enough for paper use if independent reviewers disagree. The scaled candidate path needs the same kind of agreement accounting as the pilot queue, plus category-fit and generation-defect agreement, while still forbidding automatic gold promotion.

Consequence: `scripts/hard-grounded-research-expansion-review-merge.mjs` now emits `generated/expansion-review-merge-report.json`, `EXPANSION_REVIEW_MERGE_REPORT.md`, and an expansion resolution queue; the release gate now blocks on `expansion_review_merge_ready`.

## 2026-06-26 — Quantify unknown-license impact on scaled candidates

Decision: Add a generated license-impact queue for expansion candidates that use unknown-license upstream datasets.

Rationale: The release gate already blocks on unknown-license sources, but paper-scale remediation needs item-level scope. Mapping blocker datasets to impacted expansion candidates makes it clear which categories and batches require replacement sources or pointer-only packaging before public release.

Consequence: `scripts/hard-grounded-research-license-impact.mjs` now emits `generated/license-impact.json` and `LICENSE_IMPACT.md`; the release gate now blocks on `license_impact_clear`.

## 2026-06-26 — Plan license remediation by category

Decision: Generate a category-level replacement-versus-pointer-only plan for unknown-license expansion candidates.

Rationale: Knowing which candidates are impacted is not sufficient to unblock a paper release. The benchmark needs an executable remediation policy that distinguishes categories with known-license replacement datasets from categories that must remain pointer-only until a replacement source is added.

Consequence: `scripts/hard-grounded-research-license-remediation-plan.mjs` now emits `generated/license-remediation-plan.json` and `LICENSE_REMEDIATION_PLAN.md`; the release gate now records that the remediation plan exists.

## 2026-06-26 — Materialize known-license replacement candidates

Decision: Generate a separate license-remediated expansion candidate suite for remediation-plan categories with known-license replacement sources.

Rationale: A remediation plan is not enough for a paper-ready benchmark if reviewers cannot inspect the replacement items. Materializing replacement-path candidates creates a concrete review target while preserving the original raw expansion candidates and keeping pointer-only categories explicit.

Consequence: `scripts/hard-grounded-research-remediated-expansion-candidates.mjs` now emits `generated/license-remediated-expansion-candidates.json` and `LICENSE_REMEDIATED_EXPANSION_CANDIDATES.md`; the release gate records whether every replacement-path candidate has been materialized.

## 2026-06-26 — Package scaled candidates for public release

Decision: Generate a scaled public expansion package that swaps in known-license replacement candidates and strips text for pointer-only evidence.

Rationale: Reviewers and future benchmark users need to inspect the exact public artifact implied by the licensing policy. Keeping raw expansion candidates separate from the public package preserves provenance while proving that unknown-license text does not leak into the scaled release view.

Consequence: `scripts/hard-grounded-research-scaled-public-package.mjs` now emits `generated/public-package/hard-grounded-research-scaled-public-suite.json`, JSONL, `generated/public-package/scaled-summary.json`, and `SCALED_PUBLIC_PACKAGE.md`; the release gate records whether the scaled public package exists and uses all remediated replacements.

## 2026-06-26 — Prepare two real model baseline packets

Decision: Generate release-baseline prompt packets for one frontier/API model and one open-weight/API-compatible model without counting dry-run packets as scored baselines.

Rationale: The benchmark needs real model results before paper claims, but readiness should not be faked by local heuristics or empty manifests. A generated packet index gives external runners stable prompts, expected output shape, and import commands while preserving the release gate requirement for scored non-fixture reports.

Consequence: `scripts/hard-grounded-research-model-baseline-packets.mjs` now emits two model-baseline packet directories, `generated/model-baseline-packets.json`, and `MODEL_BASELINE_PACKETS.md`; the release gate records packet readiness separately from scored model readiness.

## 2026-06-26 — Consolidate review operations into one queue

Decision: Generate a single review operations packet that combines pilot and expansion review preflight status, category progress, and next work batches.

Rationale: The release gate has several review blockers, but reviewers need one operational view of the remaining rows rather than separate preflight and merge reports. Consolidating the queue makes the path to gold promotion and scaled-review readiness explicit without fabricating completed human review.

Consequence: `scripts/hard-grounded-research-review-operations.mjs` now emits `generated/review-operations.json` and `REVIEW_OPERATIONS.md`; the release gate records whether the consolidated review operations queue exists.

## 2026-06-26 — Add uncertainty to diagnostic baselines

Decision: Generate descriptive uncertainty intervals for current task-level baseline metrics and paired baseline deltas.

Rationale: A paper-worthy benchmark needs to avoid overclaiming from a 30-item pilot. Reporting task-level confidence intervals and paired deltas makes the current evidence easier to interpret while preserving the release requirement for larger double-reviewed data and real model baselines.

Consequence: `scripts/hard-grounded-research-baseline-uncertainty.mjs` now emits `generated/baseline-uncertainty.json` and `BASELINE_UNCERTAINTY.md`; the paper draft includes a baseline uncertainty section and the release gate records that uncertainty estimates exist.

## 2026-06-26 — Register novelty evidence separately from final novelty claims

Decision: Generate a source-backed novelty evidence registry while keeping completion claims disabled.

Rationale: The benchmark needs an auditable trail of related work before any Stanford-PhD-level novelty claim. A separate evidence registry lets the paper draft cite adjacent work and reject overbroad claims without converting the preliminary novelty audit into a final approval.

Consequence: `scripts/hard-grounded-research-novelty-evidence.mjs` now emits `generated/novelty-evidence.json` and `NOVELTY_EVIDENCE.md`; the release gate records that related-work evidence exists while `novelty_audit_final` remains blocked.

## 2026-06-26 — Define a generated annotation protocol

Decision: Generate a formal annotation protocol for pilot and expansion reviewer workbooks.

Rationale: Paper-worthy gold data requires reviewers to apply consistent labels, citation rules, category-fit judgments, and generation-defect codes. A generated protocol keeps the annotation instructions tied to the current rubric and workbook schema without pretending any review rows are complete.

Consequence: `scripts/hard-grounded-research-annotation-protocol.mjs` now emits `generated/annotation-protocol.json` and `ANNOTATION_PROTOCOL.md`; the release gate records that the protocol exists before final review labels are collected.

## 2026-06-26 — Clear license blockers through packaged redistribution evidence

Decision: Generate an explicit license clearance report from the scaled public package and let the release gate clear unknown-license blockers only when every impacted candidate is replaced or pointer-only with no text leaks.

Rationale: Raw source metadata can still contain unknown-license datasets after remediation, but the paper release artifact is the sanitized public package. The benchmark needs executable evidence that no unknown-license text is redistributed while preserving pointers, hashes, and replacement provenance.

Consequence: `scripts/hard-grounded-research-license-clearance.mjs` now emits `generated/license-clearance.json` and `LICENSE_CLEARANCE.md`; the release gate uses this clearance artifact to distinguish unresolved source metadata from redistribution-safe packaging.

## 2026-06-26 — Score the first real frontier API baseline

Decision: Run and record one non-fixture OpenAI Responses API pilot baseline instead of relying only on dry-run packets and local heuristic systems.

Rationale: A publishable benchmark needs externally scored model evidence, not just runnable prompt packets. One real 30-item pilot run starts the release-baseline evidence trail while preserving the release gate requirement for at least two eligible non-fixture model baselines before paper claims.

Consequence: `runs/openai-grounded-baseline-v1/` now contains the prompt packet, run manifest, model submission, and scored report; `generated/model-run-index.json` records one eligible model baseline and the release gate still blocks completion until a second real baseline is scored.

## 2026-06-26 — Score a second external provider baseline

Decision: Add and run an Anthropic Messages API pilot baseline as the second non-fixture external model baseline.

Rationale: The release gate requires at least two scored non-fixture model baselines before paper claims. Using a second provider family makes the evidence stronger than running another OpenAI model variant and gives the benchmark an immediate cross-provider failure profile.

Consequence: `scripts/hard-grounded-research-anthropic-baseline.mjs` now emits an auditable prompt packet, run manifest, model submission, and scored report under `runs/anthropic-grounded-baseline-v1/`; the model run index and release gate can now verify two eligible external baselines.

## 2026-06-26 — Prioritize review with external model failures

Decision: Generate a model-failure review triage packet from the two eligible external baseline reports.

Rationale: Human review remains the core blocker, but reviewers should start where the benchmark already exposes grounded-research failures in real systems. Ranking pilot rows by cross-model answer errors, citation faithfulness failures, conclusion-support failures, and abstention mistakes turns model evidence into a concrete review workflow without pretending any review labels are complete.

Consequence: `scripts/hard-grounded-research-review-triage.mjs` now emits `generated/review-triage.json` and `REVIEW_TRIAGE.md`; review operations and the release gate record that model-failure triage is ready before paper review begins.

## 2026-06-26 — Convert review readiness into annotation assignments

Decision: Generate a first-wave annotation assignment plan from review operations, model-failure triage, and expansion review preflight.

Rationale: Review queues and workbooks are necessary but not sufficient for paper-scale execution. A reviewer needs an explicit sequence: the highest-risk pilot items first, then a balanced expansion wave across all ten categories. This advances review readiness without fabricating any human labels.

Consequence: `scripts/hard-grounded-research-annotation-assignments.mjs` now emits `generated/annotation-assignments.json` and `ANNOTATION_ASSIGNMENTS.md`; review operations and the release gate record that concrete annotation assignments exist while all true review completion blockers remain.

## 2026-06-26 — Expand novelty audit with fresh June 2026 adjacent benchmarks

Decision: Add a broader source-backed novelty refresh covering text-table, legal/compliance, enterprise, corpus-level, and long-context RAG benchmarks while keeping completion claims disabled.

Rationale: The benchmark's novelty case should be stress-tested against current adjacent benchmark work before any final claim; adding these sources makes overclaiming harder and sharpens the differentiator.

Consequence: `scripts/hard-grounded-research-novelty-audit.mjs` and `scripts/hard-grounded-research-novelty-evidence.mjs` now include additional web-checked sources; regenerated `NOVELTY_AUDIT.md`, `NOVELTY_EVIDENCE.md`, and release artifacts keep `novelty_audit_final` blocked until human review and final audit.

## 2026-06-26 — Export checksum-backed annotation packets

Decision: Generate a first-wave annotation export from the assignment plan instead of asking reviewers to edit repo-internal workbook paths directly.

Rationale: Human double review is the main remaining paper-readiness blocker. A stable export manifest with per-file checksums, reviewer-field-only rules, and row counts makes review handoff and later import auditable without pretending any labels are complete.

Consequence: `scripts/hard-grounded-research-annotation-export.mjs` now emits `generated/annotation-export/manifest.json`, per-workbook export JSONL files, and `ANNOTATION_EXPORT.md`; validation and the release gate record export readiness while keeping all review-completion blockers active.

## 2026-06-26 — Smoke-test returned annotation packets

Decision: Add a fixture import smoke for annotation exports that verifies returned reviewer packets only modify `reviewer_fields`.

Rationale: Exporting review rows is not enough for a paper-grade annotation workflow; the repo also needs evidence that returned packets can be parsed without corrupting immutable benchmark content. A fixture smoke makes the import contract executable while keeping synthetic rows out of gold promotion.

Consequence: `scripts/hard-grounded-research-annotation-import-smoke.mjs` now emits `generated/annotation-import-smoke/report.json`, returned fixture JSONL files, and `ANNOTATION_IMPORT_SMOKE.md`; the release gate records import-smoke readiness while human review blockers remain active.

## 2026-06-26 — Add a dry-run-first annotation importer

Decision: Add a reusable annotation-return importer with dry-run validation by default and an explicit `--apply` mode for updating reviewer workbooks.

Rationale: A paper-grade review workflow needs more than export and smoke artifacts; it needs a deterministic path from returned reviewer JSONL files back into the workbooks used by preflight, merge, and gold promotion. The importer must protect immutable benchmark fields and reject fixture annotations unless the run is explicitly marked as smoke validation.

Consequence: `scripts/hard-grounded-research-import-annotations.mjs` now validates returned annotation packets, writes `generated/annotation-import/report.json` and `ANNOTATION_IMPORT.md`, rejects fixture rows by default, and updates workbooks only when `--apply` is requested on clean non-fixture input.

## 2026-06-26 — Rehearse gold promotion with isolated fixture workbooks

Decision: Add a fixture-only gold-promotion rehearsal that completes copied reviewer workbooks and verifies merge-ready gold shape without touching real review state.

Rationale: The benchmark should prove the end-to-end promotion machinery can work before human annotations arrive. A separate rehearsal catches schema or merge failures while preserving the release rule that only real double review can clear gold blockers.

Consequence: `scripts/hard-grounded-research-gold-promotion-smoke.mjs` now emits `generated/gold-promotion-smoke/report.json`, fixture completed workbooks, a fixture gold suite, and `GOLD_PROMOTION_SMOKE.md`; the release gate records the smoke result while real review blockers remain active.

## 2026-06-26 — Rehearse scaled expansion promotion

Decision: Add a fixture-only expansion promotion rehearsal that completes copied expansion workbooks and verifies all 270 scaled candidates can become merge-ready.

Rationale: The pilot gold smoke proves the 30-item path, but the paper target also depends on scaled per-category review. The expansion path has extra reviewer fields and more workbooks, so it needs its own isolated proof before real annotation begins.

Consequence: `scripts/hard-grounded-research-expansion-promotion-smoke.mjs` now emits `generated/expansion-promotion-smoke/report.json`, fixture expansion workbooks, and `EXPANSION_PROMOTION_SMOKE.md`; the release gate records scaled-path smoke readiness while expansion review blockers remain active.

## 2026-06-26 — Synchronize paper draft with release evidence

Decision: Make the generated paper draft consume current release-gate, license-clearance, model-baseline, annotation-import, and promotion-smoke artifacts.

Rationale: A paper scaffold is actively harmful if it lags behind the benchmark evidence or repeats stale blocker status. The manuscript draft should summarize the exact current state of review mechanics, external baselines, packaged license clearance, and remaining release blockers from generated artifacts.

Consequence: `scripts/hard-grounded-research-paper-draft.mjs` now emits a paper draft with external model baseline rows, review execution readiness, fixture promotion smoke summaries, packaged license clearance, and a release-gate snapshot sourced from current JSON artifacts.

## 2026-06-26 — Synchronize dataset card with release evidence

Decision: Make the generated dataset card consume current release-gate, license-clearance, model-baseline, annotation-import, and promotion-smoke artifacts.

Rationale: The dataset card is the public-facing artifact a benchmark user will read first, so it must not lag behind the evidence used by the paper draft or release gate. It should clearly separate raw source-license blockers, packaged redistribution clearance, fixture-only workflow rehearsals, and true human-review blockers.

Consequence: `scripts/hard-grounded-research-dataset-card.mjs` now emits review handoff readiness, import-path readiness, fixture promotion rehearsals, external model baseline rows, packaged license clearance, and key release-gate checks in `DATASET_CARD.md`.

## 2026-06-26 — Stress-test novelty against closer 2025-2026 benchmarks

Decision: Expand the novelty evidence registry with additional close work on step-level context faithfulness, RAG faithfulness metrics, temporal database QA, knowledge drift, claim-aware RAG, and entity ambiguity.

Rationale: The paper should survive a skeptical related-work review, so the registry needs to identify nearby benchmarks and explicitly state which claims are not novel before making any positive contribution claim.

Consequence: `scripts/hard-grounded-research-novelty-evidence.mjs` now emits a larger source registry plus an adversarial comparison table in `NOVELTY_EVIDENCE.md`; completion claims remain disabled until the final novelty audit and human-reviewed data are complete.

## 2026-06-26 — Package reviewer handoff into a single contract

Decision: Generate a reviewer handoff packet that ties annotation assignments, export files, editable-field rules, import commands, and acceptance gates into one reviewer-facing artifact.

Rationale: Review remains the central paper-readiness blocker, and scattered scripts are too easy to misuse. A single generated handoff contract makes the next human-review step auditable while preserving the rule that fixture labels and smoke tests do not clear gold blockers.

Consequence: `scripts/hard-grounded-research-reviewer-handoff.mjs` now emits `generated/reviewer-handoff.json` and `REVIEWER_HANDOFF.md`; the release gate records `reviewer_handoff_ready` while real pilot and expansion review blockers remain active.

## 2026-06-26 — Track review progress as a generated release artifact

Decision: Generate a review progress report from pilot preflight, pilot merge, expansion preflight, expansion merge, review operations, annotation assignments, reviewer handoff, and scale-plan artifacts.

Rationale: Review completion is the main path from working scaffold to paper-ready benchmark. A progress report should quantify row completion, merge-ready items, category coverage, first-wave handoff status, and remaining scale target so future imports can be audited without reading every workbook.

Consequence: `scripts/hard-grounded-research-review-progress.mjs` now emits `generated/review-progress.json` and `REVIEW_PROGRESS.md`; the release gate records `review_progress_ready` while keeping human-review completion blockers active.

## 2026-06-26 — Enforce reviewer schema at annotation import

Decision: Validate reviewer labels, citation ids, insufficiency/conflict flags, notes, confidence, and expansion-only enums inside the annotation importer before any returned packet can be applied.

Rationale: Import is the last boundary before reviewer fields are written into workbooks. Bad non-empty values should fail before `--apply`, not only later during merge, so returned human packets cannot partially corrupt review state.

Consequence: `scripts/hard-grounded-research-import-annotations.mjs` now rejects invalid reviewer schemas at import time; the fixture import report remains clean only if returned rows satisfy the same semantic rules expected by merge.

## 2026-06-26 — Generate adjudication readiness from resolution queues

Decision: Add a generated adjudication readiness report that connects pilot and expansion merge outputs to their resolution queues, required adjudicator fields, and promotion preconditions.

Rationale: Empty resolution queues are ambiguous before reviewers have completed workbooks; they can mean no disagreements exist yet or simply that no double-review evidence has been produced. A readiness artifact should make that distinction explicit and keep promotion blocked until review, disagreement resolution, and gold summary conditions are all satisfied.

Consequence: `scripts/hard-grounded-research-adjudication-readiness.mjs` now emits `generated/adjudication-readiness.json` and `ADJUDICATION_READINESS.md`; the release gate records `adjudication_readiness_ready` while preserving the real human-review and gold-promotion blockers.

## 2026-06-26 — Add annotator agreement as a paper reliability artifact

Decision: Generate a standalone annotator agreement report for pilot and expansion reviewer workbooks, including exact agreement and Cohen's kappa hooks for completed reviewer pairs.

Rationale: A paper-worthy benchmark needs reliability evidence beyond merge readiness. The report should compute inter-annotator agreement once human labels arrive, but it must explicitly withhold agreement claims while reviewer pairs are blank so the manuscript cannot overstate reliability.

Consequence: `scripts/hard-grounded-research-annotator-agreement.mjs` now emits `generated/annotator-agreement.json` and `ANNOTATOR_AGREEMENT.md`; the release gate, dataset card, paper draft, and harness contract record agreement-report readiness while real human-review blockers remain active.

## 2026-06-26 — Synchronize baseline analysis with eligible model runs

Decision: Make baseline analysis and uncertainty consume the model-run index so eligible external model baselines appear in the same result tables as local diagnostic systems.

Rationale: The release gate already recognized scored OpenAI and Anthropic runs, but the baseline analysis still reported zero eligible model baselines and uncertainty only covered three local systems. A paper artifact cannot carry contradictory readiness evidence, so model-run-index output must be the authority for scored external runs.

Consequence: `scripts/hard-grounded-research-report.mjs` now appends eligible external reports from `generated/model-run-index.json`; `scripts/hard-grounded-research-baseline-uncertainty.mjs` derives its scored report list from `generated/baseline-analysis.json`; regenerated baseline, uncertainty, release, dataset-card, and paper artifacts now report five scored systems.

## 2026-06-26 — Audit corpus scale and packaging scope

Decision: Generate a corpus audit that quantifies pilot and scaled public suite composition, source-row diversity, evidence-unit counts, category coverage, challenge types, and pointer-only packaging scope.

Rationale: The benchmark claims to expose large-corpus grounded research failures, but paper readers need an auditable corpus-level summary rather than scattered suite and package files. The audit should make source breadth and public packaging constraints inspectable without implying that machine-seeded or expansion items are gold.

Consequence: `scripts/hard-grounded-research-corpus-audit.mjs` now emits `generated/corpus-audit.json` and `CORPUS_AUDIT.md`; the release gate, dataset card, paper draft, README, and harness contract record corpus-audit readiness while human-review and novelty blockers remain active.

## 2026-06-26 — Bound novelty claims with adversarial June 2026 scan evidence

Decision: Extend the novelty evidence and audit artifacts with explicit search-query provenance, additional close benchmarks, and allowed-versus-prohibited paper claims.

Rationale: The literature scan shows that many individual axes are already crowded, including multi-hop RAG, temporal RAG, text/table RAG, contradiction, and citation faithfulness. A paper-worthy benchmark should make the defensible claim boundary inspectable instead of relying on a broad novelty statement.

Consequence: The novelty scripts now record closer June 2026 adjacent work, generate claim-boundary tables, and expose a release-gate check for claim-boundary readiness while keeping the final novelty and human-review blockers active.

## 2026-06-26 — Add reviewer return-readiness checklist to annotation exports

Decision: Put packet-level return requirements, expected row counts, required reviewer fields, checksum instructions, and import commands directly into the annotation export manifest and reviewer handoff.

Rationale: Human review is the main paper-readiness blocker, and file-level exports alone do not tell reviewers or operators how to know a returned packet is complete before import. A return-readiness checklist makes the review loop auditable without pretending that labels have already been collected.

Consequence: `scripts/hard-grounded-research-annotation-export.mjs` now emits return-checklist metadata; `scripts/hard-grounded-research-reviewer-handoff.mjs` surfaces it in the reviewer packet; the release gate and harness validate that return readiness is available while gold and review-completion blockers remain active.

## 2026-06-26 — Justify category scale with a statistical sensitivity plan

Decision: Generate a scale and power plan that connects the 30-items-per-category target to descriptive confidence intervals, detectable paired deltas, and current review deficits.

Rationale: A benchmark paper needs a defensible sample-size argument, not only a target item count. The plan should make clear what the current 30-item pilot can and cannot support, why 300 reviewed items is the minimum paper target, and how much uncertainty remains until human review completes.

Consequence: `scripts/hard-grounded-research-power-plan.mjs` now emits `generated/power-plan.json` and `POWER_PLAN.md`; release, dataset-card, paper, and harness artifacts record the power-plan evidence while keeping category-scale and gold-review blockers active.

## 2026-06-26 — Map taxonomy constructs to rubrics, challenges, and metrics

Decision: Generate a construct-validity map that links each hard-grounded category to source datasets, rubric dimensions, observed challenge payloads, scoring metrics, novelty risk, and review status.

Rationale: A paper-worthy benchmark needs to show that the ten categories are operational constructs rather than a naming taxonomy. Reviewers should be able to inspect whether each construct has a rubric, examples, measurable failure signals, and a known novelty risk before trusting category-level claims.

Consequence: `scripts/hard-grounded-research-construct-map.mjs` now emits `generated/construct-map.json` and `CONSTRUCT_MAP.md`; release, dataset-card, paper, README, and harness artifacts require the construct map while human-review and scale blockers remain active.

## 2026-06-26 — Generate a reproducibility artifact checklist

Decision: Add a generated artifact checklist that records benchmark artifact classes, reproduction commands, paper-readiness blockers, and the current completion-claim boundary.

Rationale: A benchmark/position paper needs an auditable artifact surface, not just scattered generated files. Reviewers should be able to see which package components can be regenerated, which claims remain blocked, and which command sequence exercises the benchmark harness.

Consequence: `scripts/hard-grounded-research-artifact-checklist.mjs` emits `generated/artifact-checklist.json` and `ARTIFACT_CHECKLIST.md`; release, dataset-card, paper, README, and harness artifacts now require the checklist while human-review, category-scale, and final novelty blockers remain active.

## 2026-06-26 — Make validity threats release-check backed

Decision: Generate a threats-to-validity report that links each paper risk to current evidence, mitigations, and release checks.

Rationale: A publishable benchmark paper needs to show that known weaknesses are actively gated rather than merely acknowledged in prose. Validity threats should be inspectable, machine-readable, and tied to the same release checks that block overclaiming.

Consequence: `scripts/hard-grounded-research-threats-validity.mjs` emits `generated/threats-validity.json` and `THREATS_TO_VALIDITY.md`; release, dataset-card, paper, README, and harness artifacts now require the threats report while review, scale, and final novelty blockers remain active.

## 2026-06-26 — Generate a cross-system failure atlas

Decision: Generate a pilot failure atlas that converts scored run reports into cross-system failure modes, category summaries, and representative diagnostic cases.

Rationale: A benchmark paper needs concrete evidence of what failures the tasks expose, not only macro scores. A generated atlas makes qualitative failure examples reproducible and separates diagnostic pilot evidence from human-reviewed claims.

Consequence: `scripts/hard-grounded-research-failure-atlas.mjs` emits `generated/failure-atlas.json` and `FAILURE_ATLAS.md`; release, dataset-card, paper, README, and harness artifacts require the atlas while human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Generate paper tables from canonical artifacts

Decision: Generate a paper table and figure-data pack from the benchmark's canonical JSON artifacts.

Rationale: A paper-worthy benchmark should not rely on manually copied tables that can drift from the scorer, release gate, novelty registry, or failure atlas. Tables for taxonomy, baseline results, challenge diagnostics, failure modes, novelty boundaries, and blockers need to be reproducible.

Consequence: `scripts/hard-grounded-research-paper-tables.mjs` emits `generated/paper-tables.json` and `PAPER_TABLES.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the pack while human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Pre-specify the benchmark analysis plan

Decision: Generate a statistical analysis plan that pre-specifies hypotheses, model families, covariates, contrasts, and claim gates for the hard-grounded benchmark paper.

Rationale: The paper question asks what makes grounded research hard beyond lookup, which requires more than score tables. A reproducible analysis plan keeps pilot diagnostics separate from future category-level claims and makes the intended statistical tests inspectable before human-reviewed gold exists.

Consequence: `scripts/hard-grounded-research-analysis-plan.mjs` emits `generated/analysis-plan.json` and `ANALYSIS_PLAN.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the plan while human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Make source-row diversity a paper gate

Decision: Generate a source-diversity expansion plan that measures distinct source-row coverage per category and records the deficit against paper-scale targets.

Rationale: A large-corpus benchmark cannot rely on many transformed items from a small number of seed rows. The corpus audit exposed this weakness; the benchmark needs an explicit source-row acquisition plan so future category claims require broader Hugging Face grounding rather than cloned examples.

Consequence: `scripts/hard-grounded-research-source-diversity-plan.mjs` emits `generated/source-diversity-plan.json` and `SOURCE_DIVERSITY_PLAN.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the plan while source-row, human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Convert source diversity deficits into acquisition batches

Decision: Generate a source acquisition manifest that turns category source-row deficits into concrete Hugging Face sampling batches.

Rationale: A source-diversity target is useful only if it becomes an executable acquisition queue. The benchmark needs category-level dataset choices, row targets, license packaging rules, and review status before a future expansion can credibly broaden the corpus.

Consequence: `scripts/hard-grounded-research-source-acquisition-manifest.mjs` emits `generated/source-acquisition-manifest.json` and `SOURCE_ACQUISITION_MANIFEST.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the manifest while acquisition, human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Materialize source acquisition packets

Decision: Generate executable JSONL source-acquisition packets from the Hugging Face acquisition manifest.

Rationale: A batch manifest still leaves room for inconsistent manual sampling. Packet files should give each target row slot a dataset, viewer parameters, source-row exclusions, packaging policy, and review status so future acquisition can be audited.

Consequence: `scripts/hard-grounded-research-source-acquisition-packets.mjs` emits `generated/source-acquisition-packets.json`, `SOURCE_ACQUISITION_PACKETS.md`, and per-batch JSONL files under `generated/source-acquisition-packets/`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the packet set while acquisition, human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Audit source acquisition packets

Decision: Generate a packet-level audit that validates source acquisition JSONL queues against the acquisition manifest.

Rationale: Source acquisition packets are only useful if their row counts, batch ids, row slots, source-row exclusions, required next steps, and review statuses remain consistent. A generated audit catches packet drift before acquisition starts.

Consequence: `scripts/hard-grounded-research-source-acquisition-audit.mjs` emits `generated/source-acquisition-audit.json` and `SOURCE_ACQUISITION_AUDIT.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the audit while acquisition, human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Record the June novelty refresh ledger

Decision: Extend the novelty audit with a machine-readable refresh ledger for current June 2026 related-work probes.

Rationale: The benchmark paper can only defend a narrow novelty position if recent adjacent work is auditable by query, source id, and implication. The refresh ledger makes the current scan reproducible without weakening the final novelty blocker.

Consequence: `scripts/hard-grounded-research-novelty-audit.mjs` now emits `refresh_provenance` and `refresh_summary` in `generated/novelty-audit.json`; release, dataset-card, paper, artifact-checklist, README, and harness checks require the refresh ledger while human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Fetch source acquisition row metadata

Decision: Execute the source acquisition packets against the Hugging Face dataset viewer and generate a metadata-safe fetched-row report.

Rationale: Packet queues are not enough to know whether the proposed source-diversity expansion is feasible. Fetching row IDs, offsets, field keys, and policy-safe previews exposes real corpus availability problems before task materialization or reviewer export.

Consequence: `scripts/hard-grounded-research-source-acquisition-fetch.mjs` emits `generated/source-acquisition-fetched-rows.json`, `generated/source-acquisition-fetched-rows.jsonl`, and `SOURCE_ACQUISITION_FETCHED_ROWS.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the fetch report while its underfilled WTQ batches remain unresolved and human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Rebalance table source acquisition with FeTaQA

Decision: Add FeTaQA as a known-license table/text source and make source acquisition allocation respect dataset viewer availability caps.

Rationale: The fetched-row report showed that the WTQ mirror cannot fill all table, citation-overreach, and entity-disambiguation acquisition slots. Rebalancing toward an accessible MIT-licensed table-to-text dataset turns the acquisition plan from a nominal queue into a feasible source-row substrate.

Consequence: `benchmark-spec.json` now includes `DongfuJiang/FeTaQA` and a WTQ acquisition cap; `scripts/hard-grounded-research-source-acquisition-manifest.mjs` performs capacity-aware allocation; regenerated acquisition packets fetch 246/246 distinct Hugging Face source rows with zero findings while human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Materialize acquired rows into task drafts

Decision: Generate review-pending task drafts from every fetched source-acquisition row.

Rationale: Fetched source rows do not yet move the benchmark toward paper-scale reviewed data unless they become concrete candidate tasks. A generated candidate suite preserves source provenance, pointer-only packaging rules, category-specific drafting instructions, and required review counts before reviewer workbook export.

Consequence: `scripts/hard-grounded-research-source-acquisition-candidates.mjs` emits `generated/source-acquisition-candidates.json`, `generated/source-acquisition-candidates.jsonl`, and `SOURCE_ACQUISITION_CANDIDATES.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require 246 review-pending candidates while human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Export source acquisition review workbooks

Decision: Generate two-review workbook files for every source-acquisition task draft.

Rationale: A paper-scale acquisition queue is only useful if reviewers can actually label it through the same immutable-metadata, reviewer-fields-only workflow as the pilot and expansion candidates. Separate source-acquisition workbooks create that handoff without claiming review has happened.

Consequence: `scripts/hard-grounded-research-source-acquisition-review-workbooks.mjs` emits `generated/source-acquisition-review-workbooks/` and `SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require 20 workbooks and 492 review rows while human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Add source acquisition review preflight

Decision: Generate a strict preflight report for source-acquisition reviewer workbooks.

Rationale: Reviewer workbooks need a machine-checkable return contract before labels are collected. A preflight report makes required fields, citation-id validity, pointer-only text constraints, and incomplete rows explicit without treating blank workbooks as reviewed data.

Consequence: `scripts/hard-grounded-research-source-acquisition-review-preflight.mjs` emits `generated/source-acquisition-review-preflight.json` and `SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the report while it records 0/492 complete review rows and keeps human-review, scale, and final novelty blockers active.

## 2026-06-26 — Add reviewer calibration sentinels

Decision: Generate reviewer-screening sentinel items for every hard-grounded category before paper-scale annotation.

Rationale: Double review is only useful if reviewers consistently apply the benchmark labels and citation-support rules. A calibration packet tests each category's expected label, citation requirements, and common trap before reviewers can influence gold labels.

Consequence: `scripts/hard-grounded-research-review-calibration.mjs` emits `generated/review-calibration.json` and `REVIEW_CALIBRATION.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the calibration packet while its sentinels remain excluded from benchmark gold promotion.

## 2026-06-26 — Pre-register annotation quality control

Decision: Generate a pre-registered annotation quality-control policy for the benchmark review workflow.

Rationale: A paper-worthy benchmark needs more than blank workbooks and calibration sentinels; it needs explicit rules for reviewer eligibility, blind overlap, citation-support validation, disagreement adjudication, and when agreement claims are allowed.

Consequence: `scripts/hard-grounded-research-annotation-quality-control.mjs` emits `generated/annotation-quality-control.json` and `ANNOTATION_QUALITY_CONTROL.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the policy while human-review, scale, and final novelty blockers remain active.

## 2026-06-26 — Add a paper claim ledger

Decision: Generate a claim-by-claim admissibility ledger for the benchmark paper.

Rationale: The manuscript needs a precise boundary between claims supported by current artifacts, pilot-only diagnostic claims, and claims that remain prohibited until review, scale, and final novelty gates pass.

Consequence: `scripts/hard-grounded-research-paper-claim-ledger.mjs` emits `generated/paper-claim-ledger.json` and `PAPER_CLAIM_LEDGER.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the ledger while category-effect, publishable-gold, and novelty-completion claims remain blocked.

## 2026-06-26 — Add responsible-use policy

Decision: Generate a responsible-use and leaderboard policy for benchmark artifacts.

Rationale: A hard-grounded research benchmark can be misused if pilot diagnostics are treated as rankings or if license-sensitive evidence is redistributed without constraints. The release package needs explicit public-use rules tied to current review, claim, and license gates.

Consequence: `scripts/hard-grounded-research-responsible-use.mjs` emits `generated/responsible-use.json` and `RESPONSIBLE_USE.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the policy while public leaderboards and completion claims remain disallowed.

## 2026-06-26 — Add external submission contract

Decision: Generate a versioned external model submission contract for benchmark predictions.

Rationale: Model comparisons are only reproducible if every system emits the same required answer, citation, abstention, confidence, and evidence-assessment fields against a declared scoring source. The contract also keeps pilot diagnostics separate from future reviewed-gold scoring and leaderboard use.

Consequence: `scripts/hard-grounded-research-submission-contract.mjs` emits `generated/submission-contract.json` and `SUBMISSION_CONTRACT.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the contract while public leaderboard use remains disabled.

## 2026-06-26 — Add scoring contract

Decision: Generate a metric-level scoring contract for external benchmark submissions.

Rationale: The benchmark's central failure modes depend on distinctions that generic answer accuracy hides, especially citation faithfulness, conclusion support, and abstention quality. A scoring contract makes those distinctions auditable before any public leaderboard or category claim is allowed.

Consequence: `scripts/hard-grounded-research-scoring-contract.mjs` emits `generated/scoring-contract.json` and `SCORING_CONTRACT.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the contract while category-level and leaderboard claims remain blocked.

## 2026-06-26 — Add qualitative error codebook

Decision: Generate a qualitative error-codebook for benchmark failure analysis.

Rationale: The failure atlas counts model failures, but a paper-worthy benchmark needs stable inclusion and exclusion rules so reviewers can reproduce qualitative claims about wrong answers, missing evidence, citation overreach, abstention, authority, temporal, and contradiction failures.

Consequence: `scripts/hard-grounded-research-error-codebook.mjs` emits `generated/error-codebook.json` and `ERROR_CODEBOOK.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the codebook while qualitative claims remain pilot-diagnostic until review, scale, and novelty gates pass.

## 2026-06-26 — Add data statement

Decision: Generate a datasheet-style data statement for the benchmark package.

Rationale: A publishable benchmark needs a stable package-facing statement of data composition, source provenance, licensing policy, intended use, out-of-scope use, and review status, separate from the narrative dataset card.

Consequence: `scripts/hard-grounded-research-data-statement.mjs` emits `generated/data-statement.json` and `DATA_STATEMENT.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the statement while completion and leaderboard claims remain blocked.

## 2026-06-26 — Add version manifest

Decision: Generate a checksum-backed version manifest for package-critical benchmark artifacts.

Rationale: A paper-grade benchmark package needs an immutable way to identify the exact generated artifacts behind a manuscript, dataset card, release gate, and public package. Hashing the key files makes drift auditable while the review and novelty gates remain incomplete.

Consequence: `scripts/hard-grounded-research-version-manifest.mjs` emits `generated/version-manifest.json` and `VERSION_MANIFEST.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the manifest while completion claims remain blocked.

## 2026-06-26 — Add supplement index

Decision: Generate a reviewer-facing supplement index for the benchmark paper package.

Rationale: The package now has paper tables, claim boundaries, data statements, contracts, and version hashes, but reviewers still need one navigation layer that maps supplement sections, claims, and tables back to the authoritative artifacts.

Consequence: `scripts/hard-grounded-research-supplement-index.mjs` emits `generated/supplement-index.json` and `SUPPLEMENT_INDEX.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the index while completion claims remain blocked.

## 2026-06-26 — Add reviewer FAQ

Decision: Generate a reviewer-facing FAQ for the benchmark paper package.

Rationale: A serious benchmark submission needs concise answers to predictable reviewer objections about gold readiness, novelty, large-corpus framing, licensing, supplement navigation, and residual validity risks.

Consequence: `scripts/hard-grounded-research-reviewer-faq.mjs` emits `generated/reviewer-faq.json` and `REVIEWER_FAQ.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the FAQ while completion claims remain blocked.

## 2026-06-26 — Add model reporting card

Decision: Generate a model reporting card for benchmark result disclosure.

Rationale: The package has prompt packets, model runs, submission contracts, and scoring contracts, but model results still need a reviewer-facing policy that specifies required metadata, provenance, and claim limits without implying a public leaderboard.

Consequence: `scripts/hard-grounded-research-model-reporting-card.mjs` emits `generated/model-reporting-card.json` and `MODEL_REPORTING_CARD.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the card while pilot model scores remain diagnostic.

## 2026-06-26 — Add review execution plan

Decision: Generate a human review execution plan for the benchmark release blockers.

Rationale: The remaining release blockers are human review, merge, scale, and gold-promotion work. A paper-grade benchmark package needs an auditable plan for review waves, effort, quality controls, and acceptance gates instead of leaving those blockers as an opaque to-do list.

Consequence: `scripts/hard-grounded-research-review-execution-plan.mjs` emits `generated/review-execution-plan.json` and `REVIEW_EXECUTION_PLAN.md`; release, dataset-card, paper, artifact-checklist, README, and harness artifacts require the plan while reviewer labels remain unfilled.

## 2026-06-26 — Refresh supplement index scope

Decision: Expand the generated supplement index to cover the current model-reporting, review-execution, and reproduction artifacts.

Rationale: The supplement index is the reviewer navigation layer, so it must track the package as it grows. It had fallen behind the current release gate and version manifest counts, which would make the submission supplement internally inconsistent.

Consequence: `scripts/hard-grounded-research-supplement-index.mjs` now emits `supplement-index-v2` from release, claim, version, model-reporting, review-execution, and artifact-checklist inputs; regenerated supplement artifacts report the current 58/65 release state while completion claims remain blocked.

## 2026-06-26 — Add reproduction capsule

Decision: Generate a reviewer-facing reproduction capsule for the benchmark package.

Rationale: The package has commands, hashes, release gates, and data statements, but reviewers need one start-here artifact that says exactly how to reproduce the current state, what validation commands to run, and which blockers are expected rather than accidental.

Consequence: `scripts/hard-grounded-research-reproduction-capsule.mjs` emits `generated/reproduction-capsule.json` and `REPRODUCTION_CAPSULE.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and harness artifacts require the capsule while completion claims remain blocked.

## 2026-06-26 — Add citation metadata

Decision: Generate citation metadata for the benchmark package.

Rationale: A paper-grade benchmark package needs a stable citation surface that points to the exact package state, records caveats, and prevents readers from treating a pilot artifact citation as a final leaderboard or novelty claim.

Consequence: `scripts/hard-grounded-research-citation-metadata.mjs` emits `generated/citation-metadata.json` and `CITATION.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and harness artifacts require the metadata while DOI and completion claims remain blocked.

## 2026-06-26 — Add public package integrity report

Decision: Generate a public package integrity report for the benchmark JSON and JSONL artifacts.

Rationale: A benchmark package that redistributes sanitized public artifacts needs an inspectable check that JSON and JSONL views match, item ids are unique, pointer-only evidence has no text, and package summaries agree with the manifest.

Consequence: `scripts/hard-grounded-research-public-package-integrity.mjs` emits `generated/public-package-integrity.json` and `PUBLIC_PACKAGE_INTEGRITY.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and harness artifacts require zero integrity findings while completion claims remain blocked.

## 2026-06-26 — Add public package schema report

Decision: Generate a public package schema report for the benchmark JSON artifacts.

Rationale: Integrity checks prove JSON and JSONL parity, but downstream evaluators also need an auditable field-level contract for items, source examples, evidence units, and pointer-only text handling.

Consequence: `scripts/hard-grounded-research-public-package-schema.mjs` emits `generated/public-package-schema.json` and `PUBLIC_PACKAGE_SCHEMA.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and harness artifacts require zero schema violations while completion claims remain blocked.

## 2026-06-26 — Add review packet audit

Decision: Generate a first-wave review packet audit for the benchmark annotation export.

Rationale: The remaining paper blockers depend on returned human annotations. Before collecting them, the package needs an auditable handoff check that export files exist, match their manifest hashes, preserve the reviewer-field-only contract, cover the intended first-wave categories, and can be returned through the import path.

Consequence: `scripts/hard-grounded-research-review-packet-audit.mjs` emits `generated/review-packet-audit.json` and `REVIEW_PACKET_AUDIT.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and harness artifacts require zero packet findings while completion claims remain blocked.

## 2026-06-26 — Add novelty watchlist

Decision: Generate a live-search novelty watchlist for adjacent 2026 RAG and grounded-QA work.

Rationale: The benchmark cannot be called novel until final related-work adjudication is complete. A paper-grade package needs an explicit watchlist of newly found or high-risk adjacent sources that must be resolved before moving the novelty audit from preliminary to final.

Consequence: `scripts/hard-grounded-research-novelty-watchlist.mjs` emits `generated/novelty-watchlist.json` and `NOVELTY_WATCHLIST.md`; release, dataset-card, paper, artifact-checklist, README, and version-manifest artifacts require the watchlist while final novelty and completion claims remain blocked.

## 2026-06-26 — Add review return contract

Decision: Generate a real reviewer-return contract for first-wave annotation packets.

Rationale: The benchmark has exported reviewer packets, an import path, and a packet audit, but paper-grade human review needs an explicit contract for returned filenames, row counts, editable fields, rejection rules, and dry-run/apply commands before any real labels are accepted.

Consequence: `scripts/hard-grounded-research-review-return-contract.mjs` emits `generated/review-return-contract.json` and `REVIEW_RETURN_CONTRACT.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and harness artifacts require a clean return contract while human-review completion claims remain blocked.

## 2026-06-26 — Add review return preflight

Decision: Generate a preflight report for real returned reviewer packets before import/apply.

Rationale: The return contract defines the expected files, but reviewers and maintainers also need an executable status surface that says whether the actual return directory exists, which returned JSONL files are present or missing, and whether the latest import report matches the files on disk.

Consequence: `scripts/hard-grounded-research-review-return-preflight.mjs` emits `generated/review-return-preflight.json` and `REVIEW_RETURN_PREFLIGHT.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the preflight while human-review completion claims remain blocked until real returned labels are collected and merged.

## 2026-06-26 — Add review return checklist

Decision: Generate a packet-level checklist for expected reviewer return files.

Rationale: The preflight reports aggregate missing files, but paper-grade review operations need each expected returned JSONL as an assignable work unit with scope, category, reviewer slot, row count, wave, and current return status.

Consequence: `scripts/hard-grounded-research-review-return-checklist.mjs` emits `generated/review-return-checklist.json` and `REVIEW_RETURN_CHECKLIST.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the checklist while human-review completion claims remain blocked until real returned labels are collected and merged.

## 2026-06-26 — Add novelty resolution matrix

Decision: Generate a source-level resolution matrix for novelty watchlist items.

Rationale: The watchlist records unresolved adjacent work, but final paper novelty needs each source mapped to pressure points, impacted manuscript claims, boundary changes, and final-audit disposition so the benchmark cannot overclaim generic RAG, citation, temporal, or domain QA novelty.

Consequence: `scripts/hard-grounded-research-novelty-resolution-matrix.mjs` emits `generated/novelty-resolution-matrix.json` and `NOVELTY_RESOLUTION_MATRIX.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the matrix while final novelty and completion claims remain blocked.

## 2026-06-26 — Add novelty finalization preflight

Decision: Generate a final-audit preflight for unresolved novelty watchlist and claim-boundary work.

Rationale: The resolution matrix identifies source-level overlap risks, but the benchmark still needs an operational checklist that says exactly why the novelty audit cannot become final, which sources and release blockers remain, and what must be regenerated after source adjudication.

Consequence: `scripts/hard-grounded-research-novelty-finalization-preflight.mjs` emits `generated/novelty-finalization-preflight.json` and `NOVELTY_FINALIZATION_PREFLIGHT.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, citation, and reproduction artifacts require the preflight while final novelty and completion claims remain blocked.

## 2026-06-26 — Add review collection tracker

Decision: Generate a reviewer-return collection tracker for the missing first-wave annotation packets.

Rationale: The review return checklist lists expected files, but the benchmark needs a paper-grade control surface that prioritizes missing returns by pilot-gold and scale impact, maps each packet to release gates, and records the exact dry-run/apply commands before real labels can enter the harness.

Consequence: `scripts/hard-grounded-research-review-collection-tracker.mjs` emits `generated/review-collection-tracker.json` and `REVIEW_COLLECTION_TRACKER.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the tracker while review, merge, scale, and gold claims remain blocked until real returned labels are collected and applied.

## 2026-06-26 — Add gold adjudication plan

Decision: Generate an item-level gold adjudication plan for the pilot suite.

Rationale: The release gate says `gold_review_complete` is blocked, but paper-grade gold construction needs each pilot item mapped to category coverage, missing reviews, required adjudicator fields, promotion gates, and collection dependencies before any reviewed-gold claim can be made.

Consequence: `scripts/hard-grounded-research-gold-adjudication-plan.mjs` emits `generated/gold-adjudication-plan.json` and `GOLD_ADJUDICATION_PLAN.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the plan while gold promotion and completion claims remain blocked until real reviews and adjudications are complete.

## 2026-06-26 — Add scale adjudication plan

Decision: Generate a batch-level adjudication plan for scaled expansion review.

Rationale: The category-scale gate is still blocked by 270 expansion candidates and 540 missing review rows. A paper-grade scale path needs every expansion batch mapped to category targets, first-wave collection status, missing reviews, required adjudicator fields, and category-level claim gates.

Consequence: `scripts/hard-grounded-research-scale-adjudication-plan.mjs` emits `generated/scale-adjudication-plan.json` and `SCALE_ADJUDICATION_PLAN.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the plan while category-scale and completion claims remain blocked until real expansion reviews and adjudications are complete.

## 2026-06-26 — Add novelty source review packets

Decision: Generate source-level review packets for unresolved novelty watchlist items.

Rationale: The final novelty gate is blocked by unresolved adjacent work, but the benchmark needs executable related-work review tasks that require overlap assessment, claim-boundary updates, citation actions, evidence-registry actions, and final dispositions for each source.

Consequence: `scripts/hard-grounded-research-novelty-source-review-packets.mjs` emits `generated/novelty-source-review-packets.json` and `NOVELTY_SOURCE_REVIEW_PACKETS.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the packets while final novelty and completion claims remain blocked.

## 2026-06-26 — Add novelty claim revision plan

Decision: Generate a claim-level revision plan for unresolved novelty sources.

Rationale: The novelty source packets identify source-review tasks, but final paper novelty also needs every unresolved source mapped to manuscript claims, claim statuses, boundary language, and required citation/removal actions before the final audit can pass.

Consequence: `scripts/hard-grounded-research-novelty-claim-revision-plan.mjs` emits `generated/novelty-claim-revision-plan.json` and `NOVELTY_CLAIM_REVISION_PLAN.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the plan while final novelty and completion claims remain blocked.

## 2026-06-26 — Add novelty link audit quarantine

Decision: Quarantine unresolved novelty sources whose recorded URLs do not verify against the expected primary-source title.

Rationale: A final novelty claim cannot rely on watchlist sources if the URL is missing, points to a different paper, or cannot be verified as a primary source. The related-work pipeline needs an explicit link audit before source dispositions, citation updates, and final novelty adjudication.

Consequence: `scripts/hard-grounded-research-novelty-link-audit.mjs` emits `generated/novelty-link-audit.json` and `NOVELTY_LINK_AUDIT.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the audit while final novelty and completion claims remain blocked until quarantined sources are replaced or verified.

## 2026-06-26 — Add novelty replacement candidates

Decision: Generate verified related-work replacement candidates for quarantined novelty sources.

Rationale: The link audit correctly blocks final novelty on invalid or unverified URLs, but reviewers need a concrete path from quarantine to adjudication. A replacement-candidate report should map each quarantined source to verified or explicitly caveated primary-source candidates before claim-boundary revisions can be finalized.

Consequence: `scripts/hard-grounded-research-novelty-replacement-candidates.mjs` emits `generated/novelty-replacement-candidates.json` and `NOVELTY_REPLACEMENT_CANDIDATES.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the candidates while final novelty and completion claims remain blocked until reviewers adjudicate overlap.

## 2026-06-26 — Verify novelty replacement primary sources

Decision: Correct and verify the primary-source URLs for novelty replacement candidates.

Rationale: The previous replacement-candidate report preserved one title conflict because the ConFiQA/Context-DPO and LegalBench-RAG URLs were conflated. Final related-work review needs candidate records whose titles and arXiv IDs match before reviewers can adjudicate overlap rather than cleaning bibliographic errors.

Consequence: `scripts/hard-grounded-research-novelty-replacement-candidates.mjs` now records Context-DPO at `2412.15280` and LegalBench-RAG at `2408.10343`, reducing replacement-candidate title conflicts to zero while final novelty and completion claims remain blocked until source-overlap review is complete.

## 2026-06-26 — Add novelty overlap adjudication worksheet

Decision: Generate an overlap-adjudication worksheet for verified novelty replacement candidates.

Rationale: Verified related-work links are necessary but not sufficient for a final novelty claim. Reviewers need each adjacent source mapped to overlap scope, affected manuscript claims, required citation/narrowing/removal decisions, and concrete questions before the final novelty audit can be upgraded from preliminary to final.

Consequence: `scripts/hard-grounded-research-novelty-overlap-adjudication.mjs` emits `generated/novelty-overlap-adjudication.json` and `NOVELTY_OVERLAP_ADJUDICATION.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the worksheet while all final novelty and completion claims remain blocked.

## 2026-06-26 — Add review wave schedule

Decision: Generate an ordered review wave schedule for missing returned-review packets.

Rationale: The benchmark has return contracts, checklists, and a collection tracker, but the remaining human-review blocker still needs an ordered schedule that groups exact expected return files by priority, wave, category, reviewer slot, row count, acceptance criteria, and release-gate impact.

Consequence: `scripts/hard-grounded-research-review-wave-schedule.mjs` emits `generated/review-wave-schedule.json` and `REVIEW_WAVE_SCHEDULE.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the schedule while all review, merge, gold, scale, and completion claims remain blocked until real returned labels are collected and applied.

## 2026-06-26 — Add review dropoff manifest

Decision: Generate a reviewer drop-off manifest for exact returned packet validation.

Rationale: The wave schedule orders collection, but maintainers still need a per-file drop-off contract with expected return paths, source export hashes, required editable fields, immutable-field policy, acceptance criteria, and import commands before real reviewer files can be accepted safely.

Consequence: `scripts/hard-grounded-research-review-dropoff-manifest.mjs` emits `generated/review-dropoff-manifest.json` and `REVIEW_DROPOFF_MANIFEST.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the manifest while all review, merge, gold, scale, and completion claims remain blocked until real returned labels are collected and applied.

## 2026-06-26 — Add novelty refresh ledger

Decision: Generate a June 2026 novelty refresh ledger for newly checked adjacent benchmarks.

Rationale: The preliminary novelty audit records earlier related work, but the final novelty gate needs a dated refresh ledger that captures newly found adjacent benchmarks, maps them to the hard-grounded categories they threaten, and states the required claim-narrowing action before the paper can make a genuine novelty claim.

Consequence: `scripts/hard-grounded-research-novelty-refresh-ledger.mjs` emits `generated/novelty-refresh-ledger.json` and `NOVELTY_REFRESH_LEDGER.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the ledger while final novelty and completion claims remain blocked until the sources are fully adjudicated.

## 2026-06-26 — Add review intake validator

Decision: Generate a packet-level reviewer-return intake validator.

Rationale: The drop-off manifest binds expected files and hashes, and return preflight reports file presence, but maintainers still need a single acceptance artifact that joins source-export hashes, return-file presence, import dry-run findings, and per-packet apply status before returned labels can be safely imported.

Consequence: `scripts/hard-grounded-research-review-intake-validator.mjs` emits `generated/review-intake-validator.json` and `REVIEW_INTAKE_VALIDATOR.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the validator while review, merge, gold, scale, and completion claims remain blocked until real returns pass intake and are applied.

## 2026-06-26 — Add scale gap ledger

Decision: Generate a category-level scale gap ledger.

Rationale: The scale plan and adjudication plan describe expansion batches, but the paper needs a compact category-by-category ledger that shows the 30-reviewed-items target, current reviewed count, reviewed-item deficit, planned candidates, planned review rows, and release-gate blockers before any category-level result can be claimed.

Consequence: `scripts/hard-grounded-research-scale-gap-ledger.mjs` emits `generated/scale-gap-ledger.json` and `SCALE_GAP_LEDGER.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the ledger while category-scale and completion claims remain blocked until real reviewed items meet every category target.

## 2026-06-26 — Add review assignment audit

Decision: Generate a blind double-review assignment audit.

Rationale: The assignment plan lists review waves, but paper-grade annotation needs an explicit audit that every assigned item has distinct reviewer slots, reviewer-field-only constraints, and clean packet/return contracts before returned labels are trusted.

Consequence: `scripts/hard-grounded-research-review-assignment-audit.mjs` emits `generated/review-assignment-audit.json` and `REVIEW_ASSIGNMENT_AUDIT.md`; release, dataset-card, paper, supplement, artifact-checklist, README, version-manifest, and reproduction artifacts require the audit while review, merge, gold, scale, and completion claims remain blocked until real double reviews are returned and adjudicated.
