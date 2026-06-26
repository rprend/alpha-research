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
  datasetCard: join(experimentDir, 'DATASET_CARD.md'),
  licenseReview: join(generatedDir, 'license-review.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
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
  paperTables: join(generatedDir, 'paper-tables.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  sourceDiversityPlan: join(generatedDir, 'source-diversity-plan.json'),
  sourceAcquisitionManifest: join(generatedDir, 'source-acquisition-manifest.json'),
  sourceAcquisitionPackets: join(generatedDir, 'source-acquisition-packets.json'),
  sourceAcquisitionAudit: join(generatedDir, 'source-acquisition-audit.json'),
  sourceAcquisitionFetchedRows: join(generatedDir, 'source-acquisition-fetched-rows.json'),
  sourceAcquisitionCandidates: join(generatedDir, 'source-acquisition-candidates.json'),
  sourceAcquisitionReviewWorkbooks: join(generatedDir, 'source-acquisition-review-workbooks/index.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
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

function renderDraft({ spec, pilotSuite, coverageMatrix, approachScores, baselineAnalysis, failureAtlas, paperTables, analysisPlan, baselineUncertainty, corpusAudit, sourceDiversityPlan, sourceAcquisitionManifest, sourceAcquisitionPackets, sourceAcquisitionAudit, sourceAcquisitionFetchedRows, sourceAcquisitionCandidates, sourceAcquisitionReviewWorkbooks, constructMap, artifactChecklist, threatsValidity, powerPlan, noveltyAuditJson, noveltyEvidence, goldSummary, reviewMergeReport, itemQualityAudit, licenseReview, licenseClearance, packageManifest, releaseGate, modelRunIndex, annotationExport, annotationImport, annotationImportSmoke, annotatorAgreement, goldPromotionSmoke, expansionPromotionSmoke }) {
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

The generated source-diversity plan sets a paper target of ${sourceDiversityPlan.summary.target_distinct_source_rows_per_category} distinct source rows per category (${sourceDiversityPlan.summary.target_distinct_source_rows_total} total). Current scaled artifacts cover ${sourceDiversityPlan.summary.current_distinct_source_rows} distinct source rows, leaving a ${sourceDiversityPlan.summary.source_row_deficit_total}-row deficit before large-corpus category claims are defensible.

The source acquisition manifest converts this into ${sourceAcquisitionManifest.summary.acquisition_batches} Hugging Face sampling batches for ${sourceAcquisitionManifest.summary.target_new_distinct_source_rows} new distinct source rows, with ${sourceAcquisitionManifest.summary.known_license_target_rows} known-license rows preferred before ${sourceAcquisitionManifest.summary.pointer_only_target_rows} pointer-only rows.

The source acquisition packets materialize ${sourceAcquisitionPackets.summary.packet_count} JSONL queues with ${sourceAcquisitionPackets.summary.target_new_distinct_source_rows} target row slots. These packets define the next executable acquisition step, but acquired rows still require deduplication, task materialization, double review, and gold promotion before paper claims.

The source acquisition audit validates ${sourceAcquisitionAudit.summary.audited_rows}/${sourceAcquisitionAudit.summary.expected_rows} packet rows with ${sourceAcquisitionAudit.summary.finding_count} findings, so packet drift is caught before acquisition starts.

The source acquisition fetch report executed those queues against the Hugging Face dataset viewer and fetched ${sourceAcquisitionFetchedRows.summary.fetched_rows}/${sourceAcquisitionFetchedRows.summary.requested_rows} distinct source rows with ${sourceAcquisitionFetchedRows.summary.finding_count} findings. The current queue is now feasible as a source-row acquisition substrate, but the fetched rows still need task materialization, reviewer export, double review, and adjudication before they can support large-corpus paper claims.

The source acquisition candidate suite converts the fetched rows into ${sourceAcquisitionCandidates.summary.candidates} review-pending task drafts across ${sourceAcquisitionCandidates.summary.categories} categories, with ${sourceAcquisitionCandidates.summary.required_review_rows} required independent review rows. These drafts are a materialization queue, not evaluated gold.

The source acquisition review workbooks export those drafts into ${sourceAcquisitionReviewWorkbooks.workbook_count} category-level reviewer files with ${sourceAcquisitionReviewWorkbooks.total_review_rows} total rows. This closes the acquisition-to-review handoff, while final paper claims remain blocked until reviewers return labels and merge/adjudication passes.

${markdownTable(['Dataset', 'License', 'Benchmark roles'], datasetRows(spec))}

## Task Taxonomy

${markdownTable(['Category', 'HF datasets', 'Seed tasks'], coverageRows(coverageMatrix))}

## Construct Validity Map

The taxonomy is operationalized as a generated construct map, not only as category labels. It currently maps ${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs to rubrics, examples, scoring metrics, novelty risk, and review status. Reviewed-gold coverage remains ${constructMap.summary.constructs_with_reviewed_gold} constructs, so this is construct-readiness evidence rather than a completed validity claim.

${markdownTable(['Category', 'Rubric dimensions', 'Target metrics', 'Novelty risk', 'Reviewed gold'], constructRows(constructMap))}

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

${markdownTable(['Failure mode', 'Cases', 'Systems', 'Categories', 'Challenge types'], failureModeRows(failureAtlas))}

${markdownTable(['System', 'Category', 'Challenge', 'Failure modes', 'Metrics'], representativeFailureRows(failureAtlas))}

## Baseline Uncertainty

${markdownTable(['System', 'Metric', 'Mean', '95% CI'], uncertaintyRows(baselineUncertainty))}

These intervals are descriptive task-level estimates over the current 30-item pilot, not final submission power estimates.

## Paper Tables And Figure Data

The generated paper table pack contains ${paperTables.summary.table_count} synchronized tables covering taxonomy constructs, macro results, challenge diagnostics, failure modes, novelty claim boundaries, and remaining paper-readiness blockers. The manuscript should cite \`PAPER_TABLES.md\` and \`generated/paper-tables.json\` as the source for copied tables to avoid drift from benchmark artifacts.

## Statistical Analysis Plan

The generated analysis plan pre-specifies ${analysisPlan.summary.hypotheses} hypotheses, ${analysisPlan.summary.model_families} model families, ${analysisPlan.summary.covariates} covariates, and ${analysisPlan.summary.claim_gates} claim gates for answering the central paper question. It allows pilot diagnostics now, but blocks category-level conclusions until ${analysisPlan.summary.reviewed_items_target} reviewed target items and final novelty checks are available.

## Scale And Power Plan

The paper target is ${powerPlan.assumptions.target_reviewed_items_per_category} double-reviewed items per category (${powerPlan.assumptions.target_reviewed_items_total} total). The current pilot remains diagnostic because it has ${powerPlan.current_state.current_pilot_items} pilot items and ${powerPlan.current_state.current_valid_reviewed_items} valid reviewed items. The generated plan uses conservative normal-approximation intervals for bounded task metrics and keeps category-scale claims blocked until review completes.

${markdownTable(['Scope', 'Planning n', 'Worst-case 95% half-width', 'Detectable delta', 'Interpretation'], powerScenarioRows(powerPlan))}

## Reproducibility Artifact Checklist

The generated artifact checklist records ${artifactChecklist.summary.reproduction_commands} reproduction commands and ${artifactChecklist.summary.artifact_classes_ready}/${artifactChecklist.summary.artifact_classes_total} ready artifact classes. It also carries the release blockers into the manuscript surface, so the paper cannot imply completion while the release gate remains \`${artifactChecklist.paper_readiness.release_gate_status}\`.

${markdownTable(['Artifact class', 'Status', 'Evidence'], artifactRows(artifactChecklist))}

## Threats To Validity

The generated threats-to-validity report tracks ${threatsValidity.summary.threat_count} paper risks and links each risk to release checks. High-severity threats remain ${threatsValidity.summary.high_severity_count}; this is why the current manuscript must be framed as a working scaffold rather than a final benchmark paper.

${markdownTable(['Threat', 'Type', 'Severity', 'Mitigation'], threatRows(threatsValidity))}

## External Model Baselines

Eligible external model baselines currently recorded by the model-run index: ${eligibleModelBaselines.length ? eligibleModelBaselines.join(', ') : 'none'}.

${modelBaselineRows(modelRunIndex).length ? markdownTable(['Run', 'Manifest', 'Tasks', 'Answer', 'Scored report'], modelBaselineRows(modelRunIndex)) : 'No eligible external model baseline reports are currently present.'}

## Review Execution Readiness

These checks prove the mechanics around review handoff, import, merge, and gold-shape promotion. They do not substitute for real human review.

- Annotation export ready: ${annotationExport.export_ready} (${annotationExport.totals.row_count} rows across ${annotationExport.totals.file_count} files)
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
  paperTables: readJson(requiredInputs.paperTables),
  analysisPlan: readJson(requiredInputs.analysisPlan),
  baselineUncertainty: readJson(requiredInputs.baselineUncertainty),
  corpusAudit: readJson(requiredInputs.corpusAudit),
  sourceDiversityPlan: readJson(requiredInputs.sourceDiversityPlan),
  sourceAcquisitionManifest: readJson(requiredInputs.sourceAcquisitionManifest),
  sourceAcquisitionPackets: readJson(requiredInputs.sourceAcquisitionPackets),
  sourceAcquisitionAudit: readJson(requiredInputs.sourceAcquisitionAudit),
  sourceAcquisitionFetchedRows: readJson(requiredInputs.sourceAcquisitionFetchedRows),
  sourceAcquisitionCandidates: readJson(requiredInputs.sourceAcquisitionCandidates),
  sourceAcquisitionReviewWorkbooks: readJson(requiredInputs.sourceAcquisitionReviewWorkbooks),
  constructMap: readJson(requiredInputs.constructMap),
  artifactChecklist: readJson(requiredInputs.artifactChecklist),
  threatsValidity: readJson(requiredInputs.threatsValidity),
  powerPlan: readJson(requiredInputs.powerPlan),
  noveltyAuditJson: readJson(requiredInputs.noveltyAuditJson),
  noveltyEvidence: readJson(requiredInputs.noveltyEvidence),
  goldSummary: readJson(requiredInputs.goldSummary),
  reviewMergeReport: readJson(requiredInputs.reviewMergeReport),
  itemQualityAudit: readJson(requiredInputs.itemQualityAudit),
  licenseReview: readJson(requiredInputs.licenseReview),
  licenseClearance: readJson(requiredInputs.licenseClearance),
  packageManifest: readJson(requiredInputs.packageManifest),
  releaseGate: readJson(requiredInputs.releaseGate),
  modelRunIndex: readJson(requiredInputs.modelRunIndex),
  annotationExport: readJson(requiredInputs.annotationExport),
  annotationImport: readJson(requiredInputs.annotationImport),
  annotationImportSmoke: readJson(requiredInputs.annotationImportSmoke),
  annotatorAgreement: readJson(requiredInputs.annotatorAgreement),
  goldPromotionSmoke: readJson(requiredInputs.goldPromotionSmoke),
  expansionPromotionSmoke: readJson(requiredInputs.expansionPromotionSmoke),
})

writeText(draftPath, draft)
console.log(`Wrote hard grounded research paper draft to ${draftPath}`)
