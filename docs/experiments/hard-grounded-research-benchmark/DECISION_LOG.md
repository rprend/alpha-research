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
