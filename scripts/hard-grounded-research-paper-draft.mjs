import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const draftPath = join(experimentDir, 'PAPER_DRAFT.md')

const requiredInputs = {
  readme: join(experimentDir, 'README.md'),
  noveltyAudit: join(experimentDir, 'NOVELTY_AUDIT.md'),
  noveltyAuditJson: join(generatedDir, 'novelty-audit.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  noveltyResolutionMatrix: join(generatedDir, 'novelty-resolution-matrix.json'),
  noveltyFinalizationPreflight: join(generatedDir, 'novelty-finalization-preflight.json'),
  noveltySourceReviewPackets: join(generatedDir, 'novelty-source-review-packets.json'),
  noveltyClaimRevisionPlan: join(generatedDir, 'novelty-claim-revision-plan.json'),
  noveltyLinkAudit: join(generatedDir, 'novelty-link-audit.json'),
  noveltyReplacementCandidates: join(generatedDir, 'novelty-replacement-candidates.json'),
  noveltyOverlapAdjudication: join(generatedDir, 'novelty-overlap-adjudication.json'),
  noveltyRefreshLedger: join(generatedDir, 'novelty-refresh-ledger.json'),
  datasetCard: join(experimentDir, 'DATASET_CARD.md'),
  licenseReview: join(generatedDir, 'license-review.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  publicPackageIntegrity: join(generatedDir, 'public-package-integrity.json'),
  publicPackageSchema: join(generatedDir, 'public-package-schema.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  versionManifest: join(generatedDir, 'version-manifest.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
  reviewPacketAudit: join(generatedDir, 'review-packet-audit.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
  reviewReturnPreflight: join(generatedDir, 'review-return-preflight.json'),
  reviewReturnChecklist: join(generatedDir, 'review-return-checklist.json'),
  reviewCollectionTracker: join(generatedDir, 'review-collection-tracker.json'),
  reviewWaveSchedule: join(generatedDir, 'review-wave-schedule.json'),
  reviewDropoffManifest: join(generatedDir, 'review-dropoff-manifest.json'),
  reviewIntakeValidator: join(generatedDir, 'review-intake-validator.json'),
  reviewAssignmentAudit: join(generatedDir, 'review-assignment-audit.json'),
  goldAdjudicationPlan: join(generatedDir, 'gold-adjudication-plan.json'),
  scaleAdjudicationPlan: join(generatedDir, 'scale-adjudication-plan.json'),
  scaleGapLedger: join(generatedDir, 'scale-gap-ledger.json'),
  reproductionCapsule: join(generatedDir, 'reproduction-capsule.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  modelReportingCard: join(generatedDir, 'model-reporting-card.json'),
  submissionContract: join(generatedDir, 'submission-contract.json'),
  scoringContract: join(generatedDir, 'scoring-contract.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  reviewCalibration: join(generatedDir, 'review-calibration.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  annotatorAgreement: join(generatedDir, 'annotator-agreement.json'),
  goldPromotionSmoke: join(generatedDir, 'gold-promotion-smoke/report.json'),
  expansionPromotionSmoke: join(generatedDir, 'expansion-promotion-smoke/report.json'),
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  approachScores: join(generatedDir, 'approach-scores.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  errorCodebook: join(generatedDir, 'error-codebook.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  hypothesisTestMatrix: join(generatedDir, 'hypothesis-test-matrix.json'),
  resultInterpretationGuide: join(generatedDir, 'result-interpretation-guide.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  supplementIndex: join(generatedDir, 'supplement-index.json'),
  citationMetadata: join(generatedDir, 'citation-metadata.json'),
  reviewerFaq: join(generatedDir, 'reviewer-faq.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  sourceDiversityPlan: join(generatedDir, 'source-diversity-plan.json'),
  sourceAcquisitionManifest: join(generatedDir, 'source-acquisition-manifest.json'),
  sourceAcquisitionPackets: join(generatedDir, 'source-acquisition-packets.json'),
  sourceAcquisitionAudit: join(generatedDir, 'source-acquisition-audit.json'),
  sourceAcquisitionFetchedRows: join(generatedDir, 'source-acquisition-fetched-rows.json'),
  sourceAcquisitionCandidates: join(generatedDir, 'source-acquisition-candidates.json'),
  sourceAcquisitionReviewWorkbooks: join(generatedDir, 'source-acquisition-review-workbooks/index.json'),
  sourceAcquisitionReviewPreflight: join(generatedDir, 'source-acquisition-review-preflight.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  difficultyMechanismLedger: join(generatedDir, 'difficulty-mechanism-ledger.json'),
  artifactChecklist: join(generatedDir, 'artifact-checklist.json'),
  threatsValidity: join(generatedDir, 'threats-validity.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function metric(value) {
  if (value === null || value === undefined) return 'n/a'
  return Number(value).toFixed(4)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function challengeDiagnosticRows(baselineAnalysis) {
  return baselineAnalysis.systems.flatMap((system) =>
    Object.entries(system.by_challenge_type || {}).map(([challengeType, summary]) => [
      system.system_id,
      challengeType,
      String(summary.task_count),
      metric(summary.macro.answer_correct),
      metric(summary.macro.evidence_recall),
      metric(summary.macro.citation_faithfulness),
      metric(summary.macro.conclusion_support),
    ]),
  )
}

function failureModeRows(failureAtlas) {
  return failureAtlas.failure_mode_summary.map((entry) => [
    entry.failure_mode,
    String(entry.case_count),
    String(entry.system_count),
    String(entry.category_count),
    entry.challenge_types.join('<br>'),
  ])
}

function representativeFailureRows(failureAtlas) {
  return failureAtlas.representative_cases.slice(0, 6).map((entry) => [
    entry.system_id,
    entry.category,
    entry.challenge_type,
    entry.failure_modes.join('<br>'),
    `answer=${metric(entry.metrics.answer_correct)}; evidence=${metric(entry.metrics.evidence_recall)}; conclusion=${metric(entry.metrics.conclusion_support)}`,
  ])
}

function datasetRows(spec) {
  return spec.datasets.map((dataset) => [dataset.id, dataset.license || 'unknown', dataset.covers.join('<br>')])
}

function coverageRows(coverageMatrix) {
  return coverageMatrix.map((row) => [
    row.category,
    row.datasets.join('<br>'),
    (row.seed_tasks || row.tasks || []).join('<br>'),
  ])
}

function constructRows(constructMap) {
  return constructMap.constructs.map((construct) => [
    construct.category,
    construct.required_dimensions.join('<br>'),
    construct.target_metrics.join('<br>'),
    construct.novelty_risk,
    `${construct.review_status.current_valid_reviewed_items}/${construct.review_status.target_reviewed_items}`,
  ])
}

function difficultyMechanismRows(difficultyMechanismLedger) {
  return difficultyMechanismLedger.categories.map((category) => [
    category.category,
    category.mechanisms.join('<br>'),
    category.target_metrics.join('<br>'),
    String(category.observed_failure_cases),
    category.claim_status,
  ])
}

function systemRows(baselineAnalysis) {
  return baselineAnalysis.systems.map((system) => [
    system.system_id,
    String(system.task_count),
    metric(system.macro.answer_correct),
    metric(system.macro.evidence_recall),
    metric(system.macro.citation_faithfulness),
    metric(system.macro.conclusion_support),
    metric(system.macro.abstention_quality),
  ])
}

function uncertaintyRows(baselineUncertainty) {
  return baselineUncertainty.systems.flatMap((system) =>
    ['answer_correct', 'citation_faithfulness', 'conclusion_support', 'abstention_quality'].map((metricName) => {
      const interval = system.metrics[metricName]
      return [
        system.system_id,
        metricName,
        metric(interval.mean),
        `[${metric(interval.ci95_low)}, ${metric(interval.ci95_high)}]`,
      ]
    }),
  )
}

function powerScenarioRows(powerPlan) {
  return powerPlan.sample_size_scenarios.map((scenario) => [
    scenario.scope,
    String(scenario.planning_n),
    String(scenario.ci95_half_width_worst_case),
    String(scenario.conservative_detectable_paired_delta_80_power),
    scenario.interpretation,
  ])
}

function hypothesisRows(hypothesisTestMatrix) {
  return hypothesisTestMatrix.rows.map((row) => [
    row.category,
    row.hypothesis,
    row.primary_metrics.join('<br>'),
    row.observed_expected_failure_modes.join('<br>') || 'none yet',
    row.claim_status,
  ])
}

function interpretationRows(resultInterpretationGuide) {
  return resultInterpretationGuide.rows.map((row) => [
    row.category,
    row.confirm_rule,
    row.partial_rule,
    row.falsify_rule,
  ])
}

function artifactRows(artifactChecklist) {
  return artifactChecklist.artifact_classes.map((entry) => [
    entry.id,
    entry.status,
    entry.evidence,
  ])
}

function threatRows(threatsValidity) {
  return threatsValidity.threats.map((threat) => [
    threat.id,
    threat.type,
    threat.severity,
    threat.mitigation,
  ])
}

function noveltyEvidenceRows(noveltyEvidence) {
  return noveltyEvidence.claim_guidance.map((claim) => [claim.claim, claim.status, claim.reason])
}

function noveltyComparisonRows(noveltyEvidence) {
  return noveltyEvidence.comparison_dimensions.map((entry) => [
    entry.dimension,
    entry.closest_source_ids.join('<br>'),
    entry.novelty_position,
  ])
}

function noveltyClaimBoundaryRows(noveltyEvidence) {
  return noveltyEvidence.claim_boundaries.map((claim) => [
    claim.paper_claim,
    claim.allowed ? 'allowed with evidence' : 'prohibited / not yet supported',
    claim.reason,
  ])
}

function topApproachRows(approachScores) {
  return approachScores.map((approach) => [
    approach.name,
    `${approach.coverage_count}/10`,
    approach.covered_categories.join('<br>'),
  ])
}

function releaseCheckRows(releaseGate) {
  return releaseGate.checks.map((check) => [
    check.id,
    check.passed ? 'yes' : 'no',
    check.detail,
  ])
}

function readinessCheck(releaseGate, id) {
  return releaseGate.checks.find((check) => check.id === id)
}

function modelBaselineRows(modelRunIndex) {
  return (modelRunIndex.runs || [])
    .filter((run) => run.eligible_model_baseline)
    .map((run) => [
      run.run_id,
      run.manifest_type || '',
      String(run.task_count || ''),
      metric(run.macro_answer_correct),
      run.report_present ? 'yes' : 'no',
    ])
}

function renderDraft({ spec, pilotSuite, coverageMatrix, approachScores, baselineAnalysis, failureAtlas, errorCodebook, paperTables, analysisPlan, hypothesisTestMatrix, resultInterpretationGuide, paperClaimLedger, supplementIndex, citationMetadata, reviewerFaq, baselineUncertainty, corpusAudit, sourceDiversityPlan, sourceAcquisitionManifest, sourceAcquisitionPackets, sourceAcquisitionAudit, sourceAcquisitionFetchedRows, sourceAcquisitionCandidates, sourceAcquisitionReviewWorkbooks, sourceAcquisitionReviewPreflight, constructMap, difficultyMechanismLedger, artifactChecklist, threatsValidity, powerPlan, noveltyAuditJson, noveltyEvidence, noveltyWatchlist, noveltyResolutionMatrix, noveltyFinalizationPreflight, noveltySourceReviewPackets, noveltyClaimRevisionPlan, noveltyLinkAudit, noveltyReplacementCandidates, noveltyOverlapAdjudication, noveltyRefreshLedger, goldSummary, reviewMergeReport, itemQualityAudit, licenseReview, licenseClearance, packageManifest, publicPackageIntegrity, publicPackageSchema, responsibleUse, dataStatement, versionManifest, reviewExecutionPlan, reviewPacketAudit, reviewReturnContract, reviewReturnPreflight, reviewReturnChecklist, reviewCollectionTracker, reviewWaveSchedule, reviewDropoffManifest, reviewIntakeValidator, reviewAssignmentAudit, goldAdjudicationPlan, scaleAdjudicationPlan, scaleGapLedger, reproductionCapsule, releaseGate, modelRunIndex, modelReportingCard, submissionContract, scoringContract, annotationExport, reviewCalibration, annotationQualityControl, annotationImport, annotationImportSmoke, annotatorAgreement, goldPromotionSmoke, expansionPromotionSmoke }) {
  const categoryCount = spec.categories.length
  const datasetCount = spec.datasets.length
  const pilotItemCount = pilotSuite.items.length
  const reviewedItems = goldSummary.valid_reviewed_items
  const reviewTotal = goldSummary.total_items
  const repairBeforeGold = itemQualityAudit.repair_before_gold
  const challengeTypeCount = new Set(pilotSuite.items.map((item) => item.challenge?.type || 'native_row')).size
  const eligibleModelBaselines = modelRunIndex.eligible_model_baselines || []
  const licenseClear = Boolean(licenseClearance.public_redistribution_clearance_ready)
  const annotationImportCheck = readinessCheck(releaseGate, 'annotation_import_path_ready')
  const annotatorAgreementCheck = readinessCheck(releaseGate, 'annotator_agreement_ready')
  const goldSmokeCheck = readinessCheck(releaseGate, 'gold_promotion_smoke_ready')
  const expansionSmokeCheck = readinessCheck(releaseGate, 'expansion_promotion_smoke_ready')

  return `# Benchmarks for Hard Grounded Research: Paper Draft

Status: working paper scaffold generated from repository artifacts, not a submission-ready manuscript.

## Abstract Draft

Grounded research QA is often evaluated as retrieval plus answer correctness, but research failures frequently arise after the relevant text has already been retrieved. We introduce a benchmark scaffold for hard grounded research that tests ${categoryCount} failure categories across ${datasetCount} Hugging Face datasets and ${pilotItemCount} pilot items. The benchmark targets multi-hop synthesis, stale-vs-current document conflicts, appended document lifecycle changes, table-plus-text reasoning, source authority conflicts, evidence insufficiency, citation overreach, entity disambiguation, as-of-date questions, and cross-document contradiction. Early non-oracle baselines show that lexical evidence selection is insufficient: failures cluster by challenge type and include missing evidence, unsupported conclusions, abstention errors, and citation faithfulness gaps. Gold release is intentionally gated on double review, disagreement resolution, and item-quality checks.

## Central Claim

The benchmark should not be framed as another RAG or long-context leaderboard. The paper claim is narrower: grounded research is hard because systems must reason about document state, source authority, temporal validity, evidence sufficiency, and whether citations support conclusions rather than merely nearby facts.

## Contributions

1. A taxonomy of ${categoryCount} hard grounded research failure modes beyond simple lookup.
2. A Hugging Face-grounded pilot suite spanning ${datasetCount} public datasets and ${challengeTypeCount} challenge types.
3. A scoring contract with answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality.
4. A review workflow with double review, disagreement queues, reviewer agreement metrics, quality hints, annotation import/export checks, and strict gold promotion gates.
5. A baseline analysis that reports macro, category, and challenge-type failures for oracle sanity, lexical, citation-aware verifier, and external model systems.

## Dataset Grounding

The scaled public package currently contains ${corpusAudit.summary.scaled_public_items} review-pending items, ${corpusAudit.summary.scaled_public_source_rows} distinct source rows, and ${corpusAudit.summary.scaled_public_evidence_units} evidence units after license remediation and pointer-only packaging. This corpus audit is evidence for benchmark construction scope, not a substitute for human-reviewed gold labels.

The generated public package integrity report verifies ${publicPackageIntegrity.summary.suites_checked} public package suites with ${publicPackageIntegrity.summary.total_items} JSON items and ${publicPackageIntegrity.summary.total_jsonl_rows} JSONL rows. It currently records ${publicPackageIntegrity.summary.findings} integrity findings and ${publicPackageIntegrity.summary.pointer_only_text_leaks} pointer-only text leaks.

The generated public package schema report verifies ${publicPackageSchema.summary.suites_checked} public package suites with ${publicPackageSchema.summary.items_checked} items and ${publicPackageSchema.summary.evidence_units_checked} evidence units against the downstream evaluator field contract. It currently records ${publicPackageSchema.summary.schema_violations} schema violations.

The generated source-diversity plan sets a paper target of ${sourceDiversityPlan.summary.target_distinct_source_rows_per_category} distinct source rows per category (${sourceDiversityPlan.summary.target_distinct_source_rows_total} total). Current scaled artifacts cover ${sourceDiversityPlan.summary.current_distinct_source_rows} distinct source rows, leaving a ${sourceDiversityPlan.summary.source_row_deficit_total}-row deficit before large-corpus category claims are defensible.

The source acquisition manifest converts this into ${sourceAcquisitionManifest.summary.acquisition_batches} Hugging Face sampling batches for ${sourceAcquisitionManifest.summary.target_new_distinct_source_rows} new distinct source rows, with ${sourceAcquisitionManifest.summary.known_license_target_rows} known-license rows preferred before ${sourceAcquisitionManifest.summary.pointer_only_target_rows} pointer-only rows.

The source acquisition packets materialize ${sourceAcquisitionPackets.summary.packet_count} JSONL queues with ${sourceAcquisitionPackets.summary.target_new_distinct_source_rows} target row slots. These packets define the next executable acquisition step, but acquired rows still require deduplication, task materialization, double review, and gold promotion before paper claims.

The source acquisition audit validates ${sourceAcquisitionAudit.summary.audited_rows}/${sourceAcquisitionAudit.summary.expected_rows} packet rows with ${sourceAcquisitionAudit.summary.finding_count} findings, so packet drift is caught before acquisition starts.

The source acquisition fetch report executed those queues against the Hugging Face dataset viewer and fetched ${sourceAcquisitionFetchedRows.summary.fetched_rows}/${sourceAcquisitionFetchedRows.summary.requested_rows} distinct source rows with ${sourceAcquisitionFetchedRows.summary.finding_count} findings. The current queue is now feasible as a source-row acquisition substrate, but the fetched rows still need task materialization, reviewer export, double review, and adjudication before they can support large-corpus paper claims.

The source acquisition candidate suite converts the fetched rows into ${sourceAcquisitionCandidates.summary.candidates} review-pending task drafts across ${sourceAcquisitionCandidates.summary.categories} categories, with ${sourceAcquisitionCandidates.summary.required_review_rows} required independent review rows. These drafts are a materialization queue, not evaluated gold.

The source acquisition review workbooks export those drafts into ${sourceAcquisitionReviewWorkbooks.workbook_count} category-level reviewer files with ${sourceAcquisitionReviewWorkbooks.total_review_rows} total rows. This closes the acquisition-to-review handoff, while final paper claims remain blocked until reviewers return labels and merge/adjudication passes.

The source acquisition review preflight currently reports ${sourceAcquisitionReviewPreflight.complete_review_rows}/${sourceAcquisitionReviewPreflight.total_review_rows} completed review rows, so it is a validation target for returned packets rather than evidence of completed human annotation.

Reviewer calibration is represented as ${reviewCalibration.sentinel_count} controlled sentinels across ${reviewCalibration.category_count} categories with minimum reviewer accuracy ${reviewCalibration.acceptance_policy.minimum_accuracy}. These sentinels screen reviewers before batch assignment and are explicitly excluded from benchmark gold promotion.

The annotation quality-control plan governs ${annotationQualityControl.workload.total_review_rows} review rows with ${annotationQualityControl.qa_rules.length} pre-registered QA rules: calibration before assignment, double blind overlap, citation-support validation, disagreement adjudication, and agreement-claim gating. It explicitly forbids sentinel rows from entering benchmark gold.

${markdownTable(['Dataset', 'License', 'Benchmark roles'], datasetRows(spec))}

## Task Taxonomy

${markdownTable(['Category', 'HF datasets', 'Seed tasks'], coverageRows(coverageMatrix))}

## Construct Validity Map

The taxonomy is operationalized as a generated construct map, not only as category labels. It currently maps ${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs to rubrics, examples, scoring metrics, novelty risk, and review status. Reviewed-gold coverage remains ${constructMap.summary.constructs_with_reviewed_gold} constructs, so this is construct-readiness evidence rather than a completed validity claim.

${markdownTable(['Category', 'Rubric dimensions', 'Target metrics', 'Novelty risk', 'Reviewed gold'], constructRows(constructMap))}

## Difficulty Mechanism Ledger

The paper question is not only whether systems can find facts, but which mechanisms make grounded research hard after plausible evidence is in context. The generated difficulty mechanism ledger maps every category to concrete mechanisms, observed baseline failure cases, target metrics, and claim blockers. It currently records ${difficultyMechanismLedger.summary.mechanisms} mechanisms across ${difficultyMechanismLedger.summary.categories} categories and ${difficultyMechanismLedger.summary.observed_failure_cases} observed pilot failure cases; ${difficultyMechanismLedger.summary.blocked_claim_categories} category claims remain blocked until review scale and final novelty gates clear.

${markdownTable(['Category', 'Mechanisms', 'Target metrics', 'Failure cases', 'Claim status'], difficultyMechanismRows(difficultyMechanismLedger))}

## Construction Approaches

${markdownTable(['Approach', 'Coverage', 'Covered categories'], topApproachRows(approachScores))}

## Evaluation Contract

Systems submit one answer per task with citation ids and abstention state. The scorer reports:

- \`answer_correct\`: whether the answer matches the expected label or gold final answer.
- \`evidence_recall\`: required citation coverage.
- \`citation_precision\`: fraction of submitted citations that are required.
- \`citation_faithfulness\`: citation precision clipped when the answer is wrong.
- \`conclusion_support\`: explicit penalty for citation-overreach probes where evidence supports a fact but not the conclusion.
- \`abstention_quality\`: correct abstention on insufficient or conflicting evidence and non-abstention when an answer is warranted.

## Pilot Baselines

${markdownTable(
  ['System', 'Tasks', 'Answer', 'Evidence Recall', 'Citation Faithfulness', 'Conclusion Support', 'Abstention'],
  systemRows(baselineAnalysis),
)}

## Challenge-Type Results

${markdownTable(
  ['System', 'Challenge', 'Tasks', 'Answer', 'Evidence Recall', 'Citation Faithfulness', 'Conclusion Support'],
  challengeDiagnosticRows(baselineAnalysis),
)}

## Failure Atlas

The generated failure atlas records ${failureAtlas.summary.failure_case_count} pilot failure cases across ${failureAtlas.summary.failure_mode_count} failure modes from ${failureAtlas.summary.scored_systems} scored systems. These examples support qualitative diagnosis of the benchmark surface; they do not support final paper claims until human review, scale, and final novelty checks pass.

The generated error codebook defines ${errorCodebook.summary.code_count} qualitative error codes and ${errorCodebook.summary.reviewer_rule_count} reviewer coding rules. It turns failure modes into reproducible coding instructions so pilot examples and future gold errors can be analyzed under the same definitions.

${markdownTable(['Failure mode', 'Cases', 'Systems', 'Categories', 'Challenge types'], failureModeRows(failureAtlas))}

${markdownTable(['System', 'Category', 'Challenge', 'Failure modes', 'Metrics'], representativeFailureRows(failureAtlas))}

## Baseline Uncertainty

${markdownTable(['System', 'Metric', 'Mean', '95% CI'], uncertaintyRows(baselineUncertainty))}

These intervals are descriptive task-level estimates over the current 30-item pilot, not final submission power estimates.

## Paper Tables And Figure Data

The generated paper table pack contains ${paperTables.summary.table_count} synchronized tables covering taxonomy constructs, macro results, challenge diagnostics, failure modes, novelty claim boundaries, and remaining paper-readiness blockers. The manuscript should cite \`PAPER_TABLES.md\` and \`generated/paper-tables.json\` as the source for copied tables to avoid drift from benchmark artifacts.

## Statistical Analysis Plan

The generated analysis plan pre-specifies ${analysisPlan.summary.hypotheses} hypotheses, ${analysisPlan.summary.model_families} model families, ${analysisPlan.summary.covariates} covariates, and ${analysisPlan.summary.claim_gates} claim gates for answering the central paper question. It allows pilot diagnostics now, but blocks category-level conclusions until ${analysisPlan.summary.reviewed_items_target} reviewed target items and final novelty checks are available.

The generated hypothesis test matrix makes those hypotheses category-specific: ${hypothesisTestMatrix.summary.hypotheses} difficulty hypotheses are tied to primary metrics, expected failure signatures, current pilot evidence, and explicit claim gates. It currently finds expected failure signatures in ${hypothesisTestMatrix.summary.categories_with_observed_expected_failure_modes}/${hypothesisTestMatrix.summary.categories} categories, but all rows remain diagnostic-only until double review, category scale, and final novelty gates clear.

${markdownTable(['Category', 'Hypothesis', 'Primary metrics', 'Observed expected modes', 'Claim status'], hypothesisRows(hypothesisTestMatrix))}

The generated result interpretation guide pre-registers how reviewed results should be read: ${resultInterpretationGuide.summary.interpretation_rules} rules define confirm, partial-support, and falsification/revision conditions across ${resultInterpretationGuide.summary.categories} category hypotheses. This prevents the paper from turning pilot failures into mechanism conclusions without reviewed scale and uncertainty evidence.

${markdownTable(['Category', 'Confirm', 'Partial support', 'Falsify or revise'], interpretationRows(resultInterpretationGuide))}

## Paper Claim Ledger

The generated paper claim ledger maps ${paperClaimLedger.summary.claims} manuscript claims to current evidence: ${paperClaimLedger.summary.allowed_claims} allowed, ${paperClaimLedger.summary.diagnostic_only_claims} diagnostic-only, and ${paperClaimLedger.summary.prohibited_claims} prohibited until review, scale, and novelty gates pass. This ledger is the manuscript claim boundary until final human-review and June 2026 novelty gates are complete.

The generated supplement index maps ${supplementIndex.summary.sections} supplement sections, ${supplementIndex.summary.paper_tables} paper tables, and ${supplementIndex.summary.claims} claims to source artifacts. It should be used as the reviewer-facing navigation layer for supplementary materials.

The generated reviewer FAQ answers ${reviewerFaq.summary.questions} likely reviewer objections using current release blockers, novelty boundaries, source-package policy, and validity risks. It should be kept with the supplement for submission and rebuttal preparation.

## Responsible Use And Leaderboard Policy

The generated responsible-use policy contains ${responsibleUse.summary.policy_rules} rules and ${responsibleUse.summary.active_restrictions} active restrictions. It disallows public leaderboards and completion claims while review, scale, and novelty gates remain incomplete, and requires pointer-only handling for license-sensitive evidence.

The generated data statement records ${dataStatement.summary.source_dataset_count} source datasets, ${dataStatement.composition.scaled_public_items} scaled public items, ${dataStatement.package_policy.pointer_only_items} pointer-only package items, intended uses, out-of-scope uses, and review-state limits. It is the package-facing datasheet companion to the dataset card.

## Scale And Power Plan

The paper target is ${powerPlan.assumptions.target_reviewed_items_per_category} double-reviewed items per category (${powerPlan.assumptions.target_reviewed_items_total} total). The current pilot remains diagnostic because it has ${powerPlan.current_state.current_pilot_items} pilot items and ${powerPlan.current_state.current_valid_reviewed_items} valid reviewed items. The generated plan uses conservative normal-approximation intervals for bounded task metrics and keeps category-scale claims blocked until review completes.

${markdownTable(['Scope', 'Planning n', 'Worst-case 95% half-width', 'Detectable delta', 'Interpretation'], powerScenarioRows(powerPlan))}

## Reproducibility Artifact Checklist

The generated artifact checklist records ${artifactChecklist.summary.reproduction_commands} reproduction commands and ${artifactChecklist.summary.artifact_classes_ready}/${artifactChecklist.summary.artifact_classes_total} ready artifact classes. It also carries the release blockers into the manuscript surface, so the paper cannot imply completion while the release gate remains \`${artifactChecklist.paper_readiness.release_gate_status}\`.

The generated version manifest records SHA-256 digests for ${versionManifest.summary.artifact_count} package-critical artifacts totaling ${versionManifest.summary.total_bytes} bytes. A submitted manuscript should cite \`VERSION_MANIFEST.md\` and \`generated/version-manifest.json\` so reviewers can identify the exact benchmark state behind the tables and claims.

The generated reproduction capsule \`${reproductionCapsule.version}\` records ${reproductionCapsule.summary.reproduction_commands} reproduction commands, ${reproductionCapsule.summary.validation_commands} validation commands, ${reproductionCapsule.summary.artifact_hashes} artifact hashes, and ${reproductionCapsule.summary.release_blockers} expected release blockers. It is the reviewer start-here artifact for reproducing the current package state.

The generated citation metadata \`${citationMetadata.version}\` defines the provisional citation key \`${citationMetadata.citation_key}\` and ${citationMetadata.summary.citation_caveats} citation caveats. It ties citation text to ${citationMetadata.summary.artifact_hashes} package hashes and explicitly prevents final novelty, completion, or leaderboard claims from being inferred from the citation.

The generated review execution plan records ${reviewExecutionPlan.summary.total_rows_remaining} remaining reviewer rows and an estimated ${reviewExecutionPlan.summary.reviewer_hours_with_reserve} reviewer-hours including adjudication reserve. It turns the current review blockers into ${reviewExecutionPlan.summary.waves} waves with explicit acceptance gates, but it does not count as completed review.

The generated review packet audit verifies ${reviewPacketAudit.summary.files_checked} first-wave reviewer files, ${reviewPacketAudit.summary.rows_checked} exported rows, and ${reviewPacketAudit.summary.categories_with_expansion_first_wave} expansion categories with ${reviewPacketAudit.summary.finding_count} packet findings. This supports reviewer handoff reproducibility without substituting for returned human labels.

The generated review return contract specifies ${reviewReturnContract.summary.expected_return_files} returned files, ${reviewReturnContract.summary.expected_return_rows} returned rows, and ${reviewReturnContract.summary.rejection_rule_count} rejection rules before annotations can be imported. It makes real human-label intake auditable without counting fixture returns as completed review.

The generated review return preflight reports ${reviewReturnPreflight.summary.present_return_files}/${reviewReturnPreflight.summary.expected_return_files} real returned files present, ${reviewReturnPreflight.summary.missing_return_files} missing files, and latest_import_ready=${reviewReturnPreflight.summary.latest_import_ready}. This separates a clean intake contract from the still-unmet requirement to collect real human annotations.

The generated review return checklist enumerates ${reviewReturnChecklist.summary.packets} exact returned-packet work units covering ${reviewReturnChecklist.summary.expected_rows} rows, with ${reviewReturnChecklist.summary.missing_packets} packets still missing. This gives the paper-review workflow a packet-level tracker rather than only aggregate row counts.

The generated review collection tracker prioritizes missing returns by release impact: ${reviewCollectionTracker.summary.pilot_missing_packets} pilot-gold packets and ${reviewCollectionTracker.summary.expansion_missing_packets} expansion-scale packets remain missing, with ${reviewCollectionTracker.summary.returned_packets} packets returned pending import. It is the operational queue for clearing review gates without treating fixture returns as evidence.

The generated review wave schedule turns that queue into ${reviewWaveSchedule.summary.waves} collection waves across ${reviewWaveSchedule.summary.packets} exact returned-packet files. It puts pilot-gold packets first, preserves category balance, and keeps all review-completion claims blocked until real returned labels are imported and merged.

The generated review drop-off manifest binds those expected return files to ${reviewDropoffManifest.summary.export_hashes} source export hashes, exact drop-off paths, editable reviewer fields, immutable-field policy, and dry-run/apply commands. It is an acceptance surface for real reviewer files, not evidence that labels have been returned.

The generated review intake validator joins that drop-off manifest with return preflight and the latest import dry-run. It currently records ${reviewIntakeValidator.summary.accepted_packets} accepted packets and ${reviewIntakeValidator.summary.blocked_packets} blocked packets, so reviewer returns remain blocked from apply until packet-level intake passes.

The generated review assignment audit checks blind double-review setup before labels are accepted: ${reviewAssignmentAudit.summary.total_assignments} assignments, ${reviewAssignmentAudit.summary.double_review_assignments} with distinct reviewer slots, and ${reviewAssignmentAudit.summary.blocked_assignments} blocked assignments under reviewer-field-only constraints.

The generated gold adjudication plan makes the pilot gold blocker item-level: ${goldAdjudicationPlan.summary.pilot_items} pilot items across ${goldAdjudicationPlan.summary.categories} categories, ${goldAdjudicationPlan.summary.missing_reviews} missing reviews, and ${goldAdjudicationPlan.summary.promotion_ready_items} promotion-ready items. This is the promotion checklist for the eventual reviewed-gold table.

The generated scale adjudication plan makes the category-scale blocker batch-level: ${scaleAdjudicationPlan.summary.expansion_batches} expansion batches, ${scaleAdjudicationPlan.summary.planned_new_items} planned new items, ${scaleAdjudicationPlan.summary.missing_review_rows} missing review rows, and ${scaleAdjudicationPlan.summary.merge_ready_items} merge-ready expansion items. This is the promotion checklist for future category-level claims.

The generated scale gap ledger makes the paper-scale deficit category-level: ${scaleGapLedger.summary.reviewed_item_deficit} reviewed items still needed across ${scaleGapLedger.summary.categories} categories, backed by ${scaleGapLedger.summary.planned_candidate_items} planned candidates and ${scaleGapLedger.summary.planned_review_rows} planned review rows. Category-level benchmark claims remain blocked until this deficit reaches zero and the release gate passes.

The generated difficulty mechanism ledger keeps the central position-paper claim auditable: ${difficultyMechanismLedger.summary.mechanisms} category mechanisms are tied to current failure evidence, target metrics, and blocked category claims rather than left as prose-only taxonomy. See \`DIFFICULTY_MECHANISM_LEDGER.md\`.

The generated hypothesis test matrix \`${hypothesisTestMatrix.version}\` turns those mechanisms into testable empirical predictions and metric contrasts. It is the manuscript bridge from taxonomy to falsifiable evaluation plan. See \`HYPOTHESIS_TEST_MATRIX.md\`.

The generated result interpretation guide \`${resultInterpretationGuide.version}\` defines what future reviewed results would need to show before a mechanism claim can be upgraded from diagnostic to supported. See \`RESULT_INTERPRETATION_GUIDE.md\`.

${markdownTable(['Artifact class', 'Status', 'Evidence'], artifactRows(artifactChecklist))}

## Threats To Validity

The generated threats-to-validity report tracks ${threatsValidity.summary.threat_count} paper risks and links each risk to release checks. High-severity threats remain ${threatsValidity.summary.high_severity_count}; this is why the current manuscript must be framed as a working scaffold rather than a final benchmark paper.

${markdownTable(['Threat', 'Type', 'Severity', 'Mitigation'], threatRows(threatsValidity))}

## External Model Baselines

Eligible external model baselines currently recorded by the model-run index: ${eligibleModelBaselines.length ? eligibleModelBaselines.join(', ') : 'none'}.

The generated submission contract \`${submissionContract.version}\` defines ${submissionContract.schema.answer_required_fields.length} required answer fields and ${submissionContract.validation_rules.length} validation rules for external model outputs. It keeps pilot scoring separate from future reviewed gold scoring and disallows public leaderboard use while responsible-use gates remain closed.

The generated scoring contract \`${scoringContract.version}\` defines ${scoringContract.summary.metric_count} metric formulas and ${scoringContract.validation_rules.length} validation rules. The metric surface explicitly separates citation faithfulness, conclusion support, and abstention quality so a citation that supports a premise does not automatically support the answer conclusion.

The generated model reporting card \`${modelReportingCard.version}\` records ${modelReportingCard.summary.systems_reported} reported systems, ${modelReportingCard.summary.eligible_model_baselines} eligible model baselines, ${modelReportingCard.summary.required_reporting_fields} required reporting fields, and ${modelReportingCard.summary.reporting_rules} reporting rules. It requires prompt-packet provenance and contract-version disclosure, and it keeps pilot model results diagnostic rather than leaderboard claims while ${modelReportingCard.summary.active_release_blockers} release blockers remain.

${modelBaselineRows(modelRunIndex).length ? markdownTable(['Run', 'Manifest', 'Tasks', 'Answer', 'Scored report'], modelBaselineRows(modelRunIndex)) : 'No eligible external model baseline reports are currently present.'}

## Review Execution Readiness

These checks prove the mechanics around review handoff, import, merge, and gold-shape promotion. They do not substitute for real human review.

- Annotation export ready: ${annotationExport.export_ready} (${annotationExport.totals.row_count} rows across ${annotationExport.totals.file_count} files)
- Reviewer calibration ready: ${reviewCalibration.review_calibration_ready} (${reviewCalibration.sentinel_count} sentinels; gold promotion allowed=${reviewCalibration.gold_promotion_allowed})
- Annotation quality-control ready: ${annotationQualityControl.annotation_quality_control_ready} (${annotationQualityControl.workload.total_review_rows} governed review rows; completion claim allowed=${annotationQualityControl.completion_claim_allowed})
- Annotation import smoke ready: ${annotationImportSmoke.annotation_import_smoke_ready} (${annotationImportSmoke.rows_checked} fixture rows, findings=${annotationImportSmoke.finding_count})
- Annotation import path ready: ${annotationImport.annotation_import_ready} (${annotationImport.rows_importable}/${annotationImport.rows_checked} rows importable; applied=${annotationImport.applied_to_workbooks})
- Release-gate annotation import check: ${annotationImportCheck?.passed ? 'yes' : 'no'} (${annotationImportCheck?.detail || 'missing'})
- Annotator agreement report ready: ${annotatorAgreement.annotator_agreement_ready} (${annotatorAgreement.summary.completed_metric_pairs} completed metric pairs; agreement claim allowed=${annotatorAgreement.summary.agreement_claim_allowed})
- Release-gate annotator agreement check: ${annotatorAgreementCheck?.passed ? 'yes' : 'no'} (${annotatorAgreementCheck?.detail || 'missing'})
- Pilot gold promotion smoke ready: ${goldPromotionSmoke.gold_promotion_smoke_ready} (${goldPromotionSmoke.gold_summary.gold_items}/${goldPromotionSmoke.gold_summary.total_items} fixture gold items; release eligible=${goldPromotionSmoke.fixture_release_eligible})
- Release-gate pilot smoke check: ${goldSmokeCheck?.passed ? 'yes' : 'no'} (${goldSmokeCheck?.detail || 'missing'})
- Expansion promotion smoke ready: ${expansionPromotionSmoke.expansion_promotion_smoke_ready} (${expansionPromotionSmoke.merge.merge_ready_items}/${expansionPromotionSmoke.merge.unique_items} fixture expansion items; release eligible=${expansionPromotionSmoke.fixture_release_eligible})
- Release-gate expansion smoke check: ${expansionSmokeCheck?.passed ? 'yes' : 'no'} (${expansionSmokeCheck?.detail || 'missing'})

## Gold Data Gate

- Gold ready: ${goldSummary.gold_ready}
- Valid reviewed items: ${reviewedItems}/${reviewTotal}
- Missing-review items: ${reviewMergeReport.missing_review_items}
- Disagreement items: ${reviewMergeReport.disagreement_items}
- Exact agreement rate: ${metric(reviewMergeReport.agreement?.exact_agreement_rate)}
- Label agreement rate: ${metric(reviewMergeReport.agreement?.label_agreement_rate)}
- Repair-before-gold items: ${repairBeforeGold}
- License review status: ${licenseReview.status}
- License blockers: ${licenseReview.blockers.length}
- Packaged license clearance ready: ${licenseClear}
- Unknown-license replacement candidates: ${licenseClearance.remediated_replacement_count}
- Unknown-license pointer-only candidates: ${licenseClearance.pointer_only_candidate_count}
- Pointer-only package items: ${packageManifest.pointer_only_items}
- Release gate status: ${releaseGate.status}
- Release blockers: ${releaseGate.blockers.length}

## Release Gate Snapshot

${markdownTable(['Check', 'Passed', 'Detail'], releaseCheckRows(releaseGate))}

## Novelty Position

The novelty audit currently rejects broad claims such as "a RAG benchmark with citations" or "a contradiction benchmark." The defensible novelty position is the combined failure-mode bundle: document lifecycle, source authority, temporal validity, table/text interpretation, citation-overreach, insufficiency, disambiguation, and contradiction inside one executable grounded research QA harness. The current novelty evidence registry contains ${noveltyEvidence.source_count} sources and still disallows completion claims.

${markdownTable(['Claim', 'Status', 'Reason'], noveltyEvidenceRows(noveltyEvidence))}

The June 2026 scan records ${noveltyEvidence.search_queries.length} search-query probes and ${noveltyEvidence.prohibited_claim_count} prohibited or unsupported claim framings. The refreshed novelty audit adds ${noveltyAuditJson.refresh_summary?.query_count ?? 0} current refresh probes over ${noveltyAuditJson.refresh_summary?.related_source_count ?? 0} adjacent sources while keeping completion claims blocked. The working paper must use the allowed claim boundary below, not the broader rejected framings.

The live-search novelty watchlist adds ${noveltyWatchlist.summary.watchlist_source_count} sources, including ${noveltyWatchlist.summary.high_risk_source_count} high-risk sources, that must be resolved before the novelty audit can become final. This watchlist is a final-audit input, not a novelty claim.

The generated novelty resolution matrix maps ${noveltyResolutionMatrix.summary.watchlist_sources} watchlist sources to claim impacts, with ${noveltyResolutionMatrix.summary.unresolved_sources} unresolved sources and ${noveltyResolutionMatrix.summary.high_risk_sources} high-risk sources still requiring final adjudication. This matrix is the working related-work checklist for the final June 2026 audit.

The generated novelty finalization preflight keeps the final audit operational rather than rhetorical: it records ${noveltyFinalizationPreflight.summary.unresolved_sources} unresolved watchlist sources, ${noveltyFinalizationPreflight.summary.high_risk_unresolved_sources} high-risk unresolved sources, and ${noveltyFinalizationPreflight.summary.review_or_scale_release_blockers} review or scale blockers that must clear before any final novelty or completion claim.

The generated novelty source review packets turn those unresolved sources into ${noveltySourceReviewPackets.summary.packets} related-work adjudication tasks, including ${noveltySourceReviewPackets.summary.high_risk_packets} high-risk task, each requiring overlap assessment, citation action, evidence-registry action, and final disposition.

The generated novelty claim revision plan maps the unresolved packets to ${noveltyClaimRevisionPlan.summary.revisions} manuscript revision actions across ${noveltyClaimRevisionPlan.summary.linked_claims} linked claims, with required boundary language and dispositions before any final novelty claim can be made.

The generated novelty link audit currently quarantines ${noveltyLinkAudit.summary.quarantined_sources}/${noveltyLinkAudit.summary.checked_sources} unresolved related-work links because the recorded URL is missing, mismatched, or not verified as a primary source. These quarantines must be cleared before the related-work review can support a final novelty claim.

The generated novelty replacement-candidate report supplies ${noveltyReplacementCandidates.summary.candidates} primary-source candidates for those quarantined links, including ${noveltyReplacementCandidates.summary.verified_title_match_candidates} verified title matches and ${noveltyReplacementCandidates.summary.candidate_title_conflicts} source that remains explicitly caveated before citation.

The generated novelty overlap adjudication worksheet converts those verified sources into ${noveltyOverlapAdjudication.summary.candidates} review rows, with ${noveltyOverlapAdjudication.summary.high_overlap_candidates} high-overlap candidates and ${noveltyOverlapAdjudication.summary.pending_dispositions} pending dispositions that must be resolved before final novelty can be claimed.

The generated novelty refresh ledger adds ${noveltyRefreshLedger.summary.source_count} newly refreshed adjacent sources from the June 26, 2026 live-search pass and marks ${noveltyRefreshLedger.summary.high_overlap_categories} high-overlap category risks. The paper must cite, rule out, or narrow claims around those sources before the preliminary novelty audit can become final.

${markdownTable(['Paper claim', 'Status', 'Reason'], noveltyClaimBoundaryRows(noveltyEvidence))}

## Adversarial Related-Work Comparison

${markdownTable(['Dimension', 'Closest source ids', 'Position to defend'], noveltyComparisonRows(noveltyEvidence))}

## Required Before Submission

1. Scale from ${pilotItemCount} pilot items to at least 30-50 double-reviewed items per category.
2. Complete independent double review and adjudicate disagreements until gold promotion succeeds.
3. Run at least two frontier or open model baselines over the same scoring source.
4. Refresh the June 2026 novelty audit with paper citations immediately before any completion claim.
5. Convert this scaffold into a full manuscript with related work, annotation protocol, limitations, and statistical uncertainty.
`
}

for (const [name, path] of Object.entries(requiredInputs)) {
  assert(existsSync(path), `Missing paper draft input ${name}: ${path}`)
}

const draft = renderDraft({
  spec: readJson(requiredInputs.spec),
  pilotSuite: readJson(requiredInputs.pilotSuite),
  coverageMatrix: readJson(requiredInputs.coverageMatrix),
  approachScores: readJson(requiredInputs.approachScores),
  baselineAnalysis: readJson(requiredInputs.baselineAnalysis),
  failureAtlas: readJson(requiredInputs.failureAtlas),
  errorCodebook: readJson(requiredInputs.errorCodebook),
  paperTables: readJson(requiredInputs.paperTables),
  analysisPlan: readJson(requiredInputs.analysisPlan),
  hypothesisTestMatrix: readJson(requiredInputs.hypothesisTestMatrix),
  resultInterpretationGuide: readJson(requiredInputs.resultInterpretationGuide),
  paperClaimLedger: readJson(requiredInputs.paperClaimLedger),
  supplementIndex: readJson(requiredInputs.supplementIndex),
  citationMetadata: readJson(requiredInputs.citationMetadata),
  reviewerFaq: readJson(requiredInputs.reviewerFaq),
  baselineUncertainty: readJson(requiredInputs.baselineUncertainty),
  corpusAudit: readJson(requiredInputs.corpusAudit),
  sourceDiversityPlan: readJson(requiredInputs.sourceDiversityPlan),
  sourceAcquisitionManifest: readJson(requiredInputs.sourceAcquisitionManifest),
  sourceAcquisitionPackets: readJson(requiredInputs.sourceAcquisitionPackets),
  sourceAcquisitionAudit: readJson(requiredInputs.sourceAcquisitionAudit),
  sourceAcquisitionFetchedRows: readJson(requiredInputs.sourceAcquisitionFetchedRows),
  sourceAcquisitionCandidates: readJson(requiredInputs.sourceAcquisitionCandidates),
  sourceAcquisitionReviewWorkbooks: readJson(requiredInputs.sourceAcquisitionReviewWorkbooks),
  sourceAcquisitionReviewPreflight: readJson(requiredInputs.sourceAcquisitionReviewPreflight),
  constructMap: readJson(requiredInputs.constructMap),
  difficultyMechanismLedger: readJson(requiredInputs.difficultyMechanismLedger),
  artifactChecklist: readJson(requiredInputs.artifactChecklist),
  threatsValidity: readJson(requiredInputs.threatsValidity),
  powerPlan: readJson(requiredInputs.powerPlan),
  noveltyAuditJson: readJson(requiredInputs.noveltyAuditJson),
  noveltyEvidence: readJson(requiredInputs.noveltyEvidence),
  noveltyWatchlist: readJson(requiredInputs.noveltyWatchlist),
  noveltyResolutionMatrix: readJson(requiredInputs.noveltyResolutionMatrix),
  noveltyFinalizationPreflight: readJson(requiredInputs.noveltyFinalizationPreflight),
  noveltySourceReviewPackets: readJson(requiredInputs.noveltySourceReviewPackets),
  noveltyClaimRevisionPlan: readJson(requiredInputs.noveltyClaimRevisionPlan),
  noveltyLinkAudit: readJson(requiredInputs.noveltyLinkAudit),
  noveltyReplacementCandidates: readJson(requiredInputs.noveltyReplacementCandidates),
  noveltyOverlapAdjudication: readJson(requiredInputs.noveltyOverlapAdjudication),
  noveltyRefreshLedger: readJson(requiredInputs.noveltyRefreshLedger),
  goldSummary: readJson(requiredInputs.goldSummary),
  reviewMergeReport: readJson(requiredInputs.reviewMergeReport),
  itemQualityAudit: readJson(requiredInputs.itemQualityAudit),
  licenseReview: readJson(requiredInputs.licenseReview),
  licenseClearance: readJson(requiredInputs.licenseClearance),
  packageManifest: readJson(requiredInputs.packageManifest),
  publicPackageIntegrity: readJson(requiredInputs.publicPackageIntegrity),
  publicPackageSchema: readJson(requiredInputs.publicPackageSchema),
  responsibleUse: readJson(requiredInputs.responsibleUse),
  dataStatement: readJson(requiredInputs.dataStatement),
  versionManifest: readJson(requiredInputs.versionManifest),
  reviewExecutionPlan: readJson(requiredInputs.reviewExecutionPlan),
  reviewPacketAudit: readJson(requiredInputs.reviewPacketAudit),
  reviewReturnContract: readJson(requiredInputs.reviewReturnContract),
  reviewReturnPreflight: readJson(requiredInputs.reviewReturnPreflight),
  reviewReturnChecklist: readJson(requiredInputs.reviewReturnChecklist),
  reviewCollectionTracker: readJson(requiredInputs.reviewCollectionTracker),
  reviewWaveSchedule: readJson(requiredInputs.reviewWaveSchedule),
  reviewDropoffManifest: readJson(requiredInputs.reviewDropoffManifest),
  reviewIntakeValidator: readJson(requiredInputs.reviewIntakeValidator),
  reviewAssignmentAudit: readJson(requiredInputs.reviewAssignmentAudit),
  goldAdjudicationPlan: readJson(requiredInputs.goldAdjudicationPlan),
  scaleAdjudicationPlan: readJson(requiredInputs.scaleAdjudicationPlan),
  scaleGapLedger: readJson(requiredInputs.scaleGapLedger),
  reproductionCapsule: readJson(requiredInputs.reproductionCapsule),
  releaseGate: readJson(requiredInputs.releaseGate),
  modelRunIndex: readJson(requiredInputs.modelRunIndex),
  modelReportingCard: readJson(requiredInputs.modelReportingCard),
  submissionContract: readJson(requiredInputs.submissionContract),
  scoringContract: readJson(requiredInputs.scoringContract),
  annotationExport: readJson(requiredInputs.annotationExport),
  reviewCalibration: readJson(requiredInputs.reviewCalibration),
  annotationQualityControl: readJson(requiredInputs.annotationQualityControl),
  annotationImport: readJson(requiredInputs.annotationImport),
  annotationImportSmoke: readJson(requiredInputs.annotationImportSmoke),
  annotatorAgreement: readJson(requiredInputs.annotatorAgreement),
  goldPromotionSmoke: readJson(requiredInputs.goldPromotionSmoke),
  expansionPromotionSmoke: readJson(requiredInputs.expansionPromotionSmoke),
})

writeText(draftPath, draft)
console.log(`Wrote hard grounded research paper draft to ${draftPath}`)
