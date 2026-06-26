import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const datasetCardPath = join(experimentDir, 'DATASET_CARD.md')

const inputPaths = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
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
  artifactChecklist: join(generatedDir, 'artifact-checklist.json'),
  threatsValidity: join(generatedDir, 'threats-validity.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
  licenseReview: join(generatedDir, 'license-review.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  annotationProtocol: join(generatedDir, 'annotation-protocol.json'),
  adjudicationReadiness: join(generatedDir, 'adjudication-readiness.json'),
  annotatorAgreement: join(generatedDir, 'annotator-agreement.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  reviewCalibration: join(generatedDir, 'review-calibration.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  goldPromotionSmoke: join(generatedDir, 'gold-promotion-smoke/report.json'),
  expansionPromotionSmoke: join(generatedDir, 'expansion-promotion-smoke/report.json'),
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

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function datasetRows(spec) {
  return spec.datasets.map((dataset) => [
    dataset.id,
    dataset.license || 'unknown',
    dataset.url,
    dataset.covers.join('<br>'),
  ])
}

function categoryRows(coverageMatrix) {
  return coverageMatrix.map((row) => [
    row.category,
    String(row.dataset_count),
    String(row.task_count),
    row.datasets.join('<br>'),
  ])
}

function challengeRows(pilotSuite) {
  const counts = new Map()
  for (const item of pilotSuite.items) {
    const challengeType = item.challenge?.type || 'native_row'
    counts.set(challengeType, (counts.get(challengeType) || 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([challengeType, count]) => [challengeType, String(count)])
}

function checkDetail(releaseGate, id) {
  const check = releaseGate.checks.find((candidate) => candidate.id === id)
  return check ? `${check.passed ? 'pass' : 'block'} - ${check.detail}` : 'not reported'
}

function modelRows(modelRunIndex) {
  return modelRunIndex.runs
    .filter((run) => run.eligible_model_baseline)
    .map((run) => [
      run.system_id,
      run.evaluation_source,
      String(run.task_count),
      String(run.macro_answer_correct),
      run.report_present ? 'yes' : 'no',
    ])
}

function expansionSmokeTotals(expansionPromotionSmoke) {
  return Object.values(expansionPromotionSmoke.category_summary).reduce(
    (totals, row) => ({
      total: totals.total + row.total_items,
      mergeReady: totals.mergeReady + row.merge_ready_items,
    }),
    { total: 0, mergeReady: 0 },
  )
}

function renderCard({
  spec,
  pilotSuite,
  coverageMatrix,
  itemQualityAudit,
  reviewMergeReport,
  goldSummary,
  baselineAnalysis,
  failureAtlas,
  paperTables,
  analysisPlan,
  modelRunIndex,
  corpusAudit,
  sourceDiversityPlan,
  sourceAcquisitionManifest,
  sourceAcquisitionPackets,
  sourceAcquisitionAudit,
  sourceAcquisitionFetchedRows,
  sourceAcquisitionCandidates,
  sourceAcquisitionReviewWorkbooks,
  sourceAcquisitionReviewPreflight,
  constructMap,
  artifactChecklist,
  threatsValidity,
  powerPlan,
  noveltyAudit,
  licenseReview,
  licenseClearance,
  packageManifest,
  releaseGate,
  annotationProtocol,
  adjudicationReadiness,
  annotatorAgreement,
  annotationExport,
  reviewCalibration,
  annotationQualityControl,
  annotationImport,
  annotationImportSmoke,
  goldPromotionSmoke,
  expansionPromotionSmoke,
}) {
  const expansionSmoke = expansionSmokeTotals(expansionPromotionSmoke)

  return `# Hard Grounded Research Dataset Card

Status: pilot benchmark card generated from repository artifacts. This is not a final public release card until gold review is complete.

## Dataset Summary

Hard Grounded Research is a pilot benchmark for grounded research QA failure modes that go beyond simple fact lookup. Items are derived from public Hugging Face datasets and transformed into tasks that test document-state reasoning, source authority, temporal validity, evidence sufficiency, table/text interpretation, citation overreach, entity disambiguation, and contradiction handling.

- Benchmark id: \`${spec.id}\`
- Pilot items: ${pilotSuite.items.length}
- Categories: ${spec.categories.length}
- Source Hugging Face datasets: ${spec.datasets.length}
- Scaled public source rows: ${corpusAudit.summary.scaled_public_source_rows}
- Scaled public evidence units: ${corpusAudit.summary.scaled_public_evidence_units}
- Source diversity target rows: ${sourceDiversityPlan.summary.current_distinct_source_rows}/${sourceDiversityPlan.summary.target_distinct_source_rows_total}
- Source diversity deficit: ${sourceDiversityPlan.summary.source_row_deficit_total}
- Source acquisition batches: ${sourceAcquisitionManifest.summary.acquisition_batches}
- Source acquisition target rows: ${sourceAcquisitionManifest.summary.target_new_distinct_source_rows}
- Source acquisition packets: ${sourceAcquisitionPackets.summary.packet_count}
- Source acquisition audit findings: ${sourceAcquisitionAudit.summary.finding_count}
- Source acquisition fetched rows: ${sourceAcquisitionFetchedRows.summary.fetched_rows}/${sourceAcquisitionFetchedRows.summary.requested_rows}
- Source acquisition candidates: ${sourceAcquisitionCandidates.summary.candidates}
- Source acquisition review rows: ${sourceAcquisitionReviewWorkbooks.total_review_rows}
- Source acquisition complete review rows: ${sourceAcquisitionReviewPreflight.complete_review_rows}/${sourceAcquisitionReviewPreflight.total_review_rows}
- Construct map ready: ${constructMap.construct_map_ready} (${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs)
- Artifact checklist ready: ${artifactChecklist.artifact_checklist_ready} (${artifactChecklist.summary.artifact_classes_ready}/${artifactChecklist.summary.artifact_classes_total} artifact classes)
- Threats-to-validity ready: ${threatsValidity.threats_validity_ready} (${threatsValidity.summary.threat_count} threats; ${threatsValidity.summary.high_severity_count} high severity)
- Failure atlas ready: ${failureAtlas.failure_atlas_ready} (${failureAtlas.summary.failure_case_count} cases; ${failureAtlas.summary.failure_mode_count} modes)
- Paper tables ready: ${paperTables.paper_tables_ready} (${paperTables.summary.table_count} tables)
- Analysis plan ready: ${analysisPlan.analysis_plan_ready} (${analysisPlan.summary.hypotheses} hypotheses; ${analysisPlan.summary.model_families} model families)
- Paper target reviewed items/category: ${powerPlan.assumptions.target_reviewed_items_per_category}
- Paper target reviewed items total: ${powerPlan.assumptions.target_reviewed_items_total}
- Gold ready: ${goldSummary.gold_ready}
- Valid reviewed items: ${goldSummary.valid_reviewed_items}/${goldSummary.total_items}
- Release gate status: ${releaseGate.status}
- License review status: ${licenseReview.status}
- Public redistribution clearance ready: ${licenseClearance.public_redistribution_clearance_ready}
- Pointer-only package items: ${packageManifest.pointer_only_items}
- Eligible external model baselines: ${modelRunIndex.eligible_model_baseline_count}

## Intended Uses

- Evaluate grounded research QA systems under adversarial evidence-use conditions.
- Diagnose whether failures come from answer selection, citation coverage, conclusion support, abstention, temporal validity, or contradiction handling.
- Support a benchmark/position paper about what makes grounded research hard beyond lookup.

## Out-of-Scope Uses

- Do not treat the current pilot as final gold data.
- Do not use mechanically seeded labels as human-validated truth.
- Do not compare production systems as a leaderboard until double review, disagreement resolution, and novelty refresh are complete.

## Source Datasets

${markdownTable(['Dataset', 'License', 'HF URL', 'Benchmark roles'], datasetRows(spec))}

## Category Coverage

${markdownTable(['Category', 'Datasets', 'Seed tasks', 'Dataset ids'], categoryRows(coverageMatrix))}

The generated construct map links each category to rubric dimensions, pilot examples, challenge payloads, scoring metrics, novelty risk, and review status. High novelty-risk constructs: ${constructMap.summary.high_novelty_risk_constructs}; constructs with reviewed gold: ${constructMap.summary.constructs_with_reviewed_gold}. See \`CONSTRUCT_MAP.md\`.

## Source Diversity

The current scaled public package has ${sourceDiversityPlan.summary.current_distinct_source_rows} distinct source rows against a paper target of ${sourceDiversityPlan.summary.target_distinct_source_rows_total}. The generated source-diversity plan records a ${sourceDiversityPlan.summary.source_row_deficit_total}-row deficit and category-level acquisition targets so large-corpus claims cannot rely on cloned seed rows. See \`SOURCE_DIVERSITY_PLAN.md\`.

The generated source acquisition manifest converts that deficit into ${sourceAcquisitionManifest.summary.acquisition_batches} Hugging Face sampling batches covering ${sourceAcquisitionManifest.summary.target_new_distinct_source_rows} target new distinct source rows. Known-license target rows: ${sourceAcquisitionManifest.summary.known_license_target_rows}; pointer-only target rows: ${sourceAcquisitionManifest.summary.pointer_only_target_rows}. See \`SOURCE_ACQUISITION_MANIFEST.md\`.

The generated acquisition packet set materializes ${sourceAcquisitionPackets.summary.packet_count} JSONL packet files with ${sourceAcquisitionPackets.summary.target_new_distinct_source_rows} target row slots under \`generated/source-acquisition-packets/\`. See \`SOURCE_ACQUISITION_PACKETS.md\`.

The generated packet audit validates ${sourceAcquisitionAudit.summary.audited_rows}/${sourceAcquisitionAudit.summary.expected_rows} packet rows with ${sourceAcquisitionAudit.summary.finding_count} findings. See \`SOURCE_ACQUISITION_AUDIT.md\`.

The generated source acquisition fetch report executes the packets against Hugging Face and records ${sourceAcquisitionFetchedRows.summary.fetched_rows}/${sourceAcquisitionFetchedRows.summary.requested_rows} distinct source-row records with ${sourceAcquisitionFetchedRows.summary.finding_count} findings. These fetched rows still require task materialization, deduplication against final public artifacts, reviewer export, double review, and adjudication before source-diversity targets can support paper claims. See \`SOURCE_ACQUISITION_FETCHED_ROWS.md\`.

The generated source acquisition candidate suite materializes those fetched rows into ${sourceAcquisitionCandidates.summary.candidates} review-pending task drafts requiring ${sourceAcquisitionCandidates.summary.required_review_rows} independent review rows. It remains blocked from gold promotion. See \`SOURCE_ACQUISITION_CANDIDATES.md\`.

The generated source acquisition review workbook index creates ${sourceAcquisitionReviewWorkbooks.workbook_count} workbooks with ${sourceAcquisitionReviewWorkbooks.total_review_rows} review rows. Pointer-only review rows: ${sourceAcquisitionReviewWorkbooks.pointer_only_review_rows}. See \`SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md\`.

The generated source acquisition review preflight checks those workbooks and currently reports ${sourceAcquisitionReviewPreflight.complete_review_rows}/${sourceAcquisitionReviewPreflight.total_review_rows} complete review rows. It defines the returned-review validation target while keeping promotion blocked. See \`SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md\`.

## Challenge-Type Coverage

${markdownTable(['Challenge type', 'Pilot items'], challengeRows(pilotSuite))}

## Annotation And Review

- Annotation protocol: \`ANNOTATION_PROTOCOL.md\`
- Review workbooks: \`generated/review-workbooks/*.jsonl\`
- Annotation export: ${annotationExport.export_ready ? 'ready' : 'not ready'} (${annotationExport.totals.row_count} rows across ${annotationExport.totals.file_count} files)
- Reviewer calibration: ${reviewCalibration.review_calibration_ready ? 'ready' : 'not ready'} (${reviewCalibration.sentinel_count} sentinels; minimum accuracy=${reviewCalibration.acceptance_policy.minimum_accuracy}; gold promotion allowed=${reviewCalibration.gold_promotion_allowed})
- Annotation quality control: ${annotationQualityControl.annotation_quality_control_ready ? 'ready' : 'not ready'} (${annotationQualityControl.workload.total_review_rows} governed review rows; sentinel rows in gold=${annotationQualityControl.thresholds.allow_sentinel_rows_in_gold})
- Annotation import path: ${annotationImport.annotation_import_ready ? 'ready' : 'not ready'} (${annotationImport.rows_importable}/${annotationImport.rows_checked} fixture rows importable; applied=${annotationImport.applied_to_workbooks})
- Annotation import smoke: ${annotationImportSmoke.annotation_import_smoke_ready ? 'ready' : 'not ready'} (${annotationImportSmoke.rows_checked} returned fixture rows checked; findings=${annotationImportSmoke.finding_count})
- Adjudication readiness: ${adjudicationReadiness.adjudication_readiness_ready ? 'ready' : 'not ready'} (pilot queue=${adjudicationReadiness.summary.pilot_resolution_queue_items}; expansion queue=${adjudicationReadiness.summary.expansion_resolution_queue_items}; promotion_allowed=${adjudicationReadiness.release_promotion_allowed})
- Annotator agreement: ${annotatorAgreement.annotator_agreement_ready ? 'ready' : 'not ready'} (completed metric pairs=${annotatorAgreement.summary.completed_metric_pairs}; claim_allowed=${annotatorAgreement.summary.agreement_claim_allowed})
- Independent reviews required per item: 2
- Required reviewer fields: ${annotationProtocol.required_reviewer_fields.map((field) => `\`${field}\``).join(', ')}
- Missing-review items: ${reviewMergeReport.missing_review_items}
- Disagreement items: ${reviewMergeReport.disagreement_items}
- Repair-before-gold items: ${itemQualityAudit.repair_before_gold}
- Review-carefully items: ${itemQualityAudit.review_carefully}
- Exact agreement rate: ${reviewMergeReport.agreement?.exact_agreement_rate ?? 'n/a'}
- Label agreement rate: ${reviewMergeReport.agreement?.label_agreement_rate ?? 'n/a'}

## Promotion Rehearsals

- Pilot gold promotion smoke: ${goldPromotionSmoke.gold_promotion_smoke_ready ? 'ready' : 'not ready'} (${goldPromotionSmoke.gold_summary.valid_reviewed_items}/${goldPromotionSmoke.gold_summary.total_items} fixture gold items; release_eligible=${goldPromotionSmoke.fixture_release_eligible})
- Scaled expansion promotion smoke: ${expansionPromotionSmoke.expansion_promotion_smoke_ready ? 'ready' : 'not ready'} (${expansionSmoke.mergeReady}/${expansionSmoke.total} fixture expansion items merge-ready; release_eligible=${expansionPromotionSmoke.fixture_release_eligible})
- These rehearsals use fixture reviewer fields only. They prove the mechanics of merge and promotion; they do not clear human-review blockers.

## Scoring

The evaluator reports answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality. Challenge-type diagnostics are present for ${baselineAnalysis.systems.length} scored baseline systems in \`generated/baseline-analysis.json\`.

## Failure Atlas

The generated failure atlas summarizes ${failureAtlas.summary.failure_case_count} pilot failure cases across ${failureAtlas.summary.failure_mode_count} failure modes from ${failureAtlas.summary.scored_systems} scored systems. It is qualitative diagnostic evidence only and remains blocked from completion claims while release status is \`${failureAtlas.summary.release_gate_status}\`. See \`FAILURE_ATLAS.md\`.

## Paper Tables

The generated paper table pack materializes ${paperTables.summary.table_count} synchronized tables for taxonomy, baseline results, challenge diagnostics, failure modes, novelty boundaries, and release blockers. See \`PAPER_TABLES.md\` and \`generated/paper-tables.json\`.

## Analysis Plan

The generated analysis plan pre-specifies ${analysisPlan.summary.hypotheses} hypotheses, ${analysisPlan.summary.model_families} model families, and ${analysisPlan.summary.covariates} covariates for testing what makes grounded research hard beyond lookup. It keeps category-level and final novelty claims blocked until reviewed gold and final literature gates pass. See \`ANALYSIS_PLAN.md\`.

## Statistical Scale Plan

The current pilot supports diagnostic analysis only. The generated power plan targets ${powerPlan.assumptions.target_reviewed_items_per_category} double-reviewed items per category (${powerPlan.assumptions.target_reviewed_items_total} total) before category-level paper claims. At the category target, the worst-case 95% half-width for bounded task metrics is ${powerPlan.sample_size_scenarios.find((scenario) => scenario.scope === 'paper_target_per_category')?.ci95_half_width_worst_case}; at the overall target it is ${powerPlan.sample_size_scenarios.find((scenario) => scenario.scope === 'paper_target_overall')?.ci95_half_width_worst_case}. See \`POWER_PLAN.md\`.

## Reproducibility Artifact Checklist

The generated artifact checklist records ${artifactChecklist.summary.reproduction_commands} reproduction commands, ${artifactChecklist.summary.artifact_classes_ready}/${artifactChecklist.summary.artifact_classes_total} ready artifact classes, and ${artifactChecklist.summary.release_blockers} release blockers. It keeps completion claims blocked while release status is \`${artifactChecklist.paper_readiness.release_gate_status}\`. See \`ARTIFACT_CHECKLIST.md\`.

## Threats To Validity

The generated threats-to-validity report tracks ${threatsValidity.summary.threat_count} risks across construct, internal, statistical, external, artifact, evaluation, novelty, and measurement validity. High-severity threats: ${threatsValidity.summary.high_severity_count}. See \`THREATS_TO_VALIDITY.md\`.

## External Model Baselines

${markdownTable(['System', 'Evaluation source', 'Tasks', 'Macro answer correct', 'Report present'], modelRows(modelRunIndex))}

## Data Provenance And Licensing Notes

This benchmark stores normalized evidence snippets and metadata from upstream Hugging Face datasets. Upstream dataset licenses are mixed and include unknown-license sources, so a public release must either preserve attribution and license notices, replace unknown-license sources, or release only pointers/transforms where required. See \`LICENSE_REVIEW.md\`, \`generated/license-review.json\`, \`PUBLIC_PACKAGE_MANIFEST.md\`, and \`generated/public-package-manifest.json\` for the generated blocker and pointer-only packaging lists.

Packaged redistribution clearance is currently ${licenseClearance.public_redistribution_clearance_ready ? 'ready' : 'not ready'} for the generated public package: ${licenseClearance.remediated_replacement_count} impacted scaled candidates are replaced with known-license alternatives, ${licenseClearance.pointer_only_candidate_count} are pointer-only, and ${licenseClearance.package_mode_counts.redistributable_known_license_evidence} use redistributable known-license evidence. Raw upstream source-license status is still tracked separately from package clearance.

## Known Limitations

1. Current scale is ${pilotSuite.items.length} pilot items, not the target 30-50 reviewed items per category.
2. Gold labels are blocked until independent review and disagreement resolution are complete.
3. Some challenge items are synthetic transformations of existing rows and require human review before publication.
4. The novelty audit is ${noveltyAudit.status} and records ${noveltyAudit.refresh_summary?.query_count ?? 0} June 2026 refresh queries; it still must become final before any completion claim.
5. Unknown-license upstream datasets must remain pointer-only or be replaced before any package that redistributes source text.

## Release Gate

See \`RELEASE_GATE.md\` and \`generated/release-gate.json\`. Current blockers: ${releaseGate.blockers.length}.

Key release checks:

- Gold review: ${checkDetail(releaseGate, 'gold_review_complete')}
- Review preflight: ${checkDetail(releaseGate, 'review_preflight_ready')}
- Reviewer handoff: ${checkDetail(releaseGate, 'reviewer_handoff_ready')}
- Review progress: ${checkDetail(releaseGate, 'review_progress_ready')}
- Adjudication readiness: ${checkDetail(releaseGate, 'adjudication_readiness_ready')}
- Annotator agreement: ${checkDetail(releaseGate, 'annotator_agreement_ready')}
- Corpus audit: ${checkDetail(releaseGate, 'corpus_audit_ready')}
- Source diversity: ${checkDetail(releaseGate, 'source_diversity_plan_ready')}
- Source acquisition: ${checkDetail(releaseGate, 'source_acquisition_manifest_ready')}
- Source acquisition packets: ${checkDetail(releaseGate, 'source_acquisition_packets_ready')}
- Source acquisition audit: ${checkDetail(releaseGate, 'source_acquisition_audit_ready')}
- Source acquisition fetch report: ${checkDetail(releaseGate, 'source_acquisition_fetch_report_ready')}
- Source acquisition full fetch: ${checkDetail(releaseGate, 'source_acquisition_fetch_full_ready')}
- Source acquisition candidates: ${checkDetail(releaseGate, 'source_acquisition_candidates_ready')}
- Source acquisition review workbooks: ${checkDetail(releaseGate, 'source_acquisition_review_workbooks_ready')}
- Source acquisition review preflight: ${checkDetail(releaseGate, 'source_acquisition_review_preflight_report_ready')}
- Construct map: ${checkDetail(releaseGate, 'construct_map_ready')}
- Artifact checklist: ${checkDetail(releaseGate, 'artifact_checklist_ready')}
- Threats to validity: ${checkDetail(releaseGate, 'threats_validity_ready')}
- Failure atlas: ${checkDetail(releaseGate, 'failure_atlas_ready')}
- Paper tables: ${checkDetail(releaseGate, 'paper_tables_ready')}
- Analysis plan: ${checkDetail(releaseGate, 'analysis_plan_ready')}
- Power plan: ${checkDetail(releaseGate, 'power_plan_ready')}
- Novelty refresh ledger: ${checkDetail(releaseGate, 'novelty_refresh_ledger_ready')}
- Novelty claim boundaries: ${checkDetail(releaseGate, 'novelty_claim_boundaries_ready')}
- Annotation export: ${checkDetail(releaseGate, 'annotation_export_ready')}
- Annotation return readiness: ${checkDetail(releaseGate, 'annotation_return_readiness_ready')}
- Reviewer calibration: ${checkDetail(releaseGate, 'review_calibration_ready')}
- Annotation quality control: ${checkDetail(releaseGate, 'annotation_quality_control_ready')}
- Annotation import path: ${checkDetail(releaseGate, 'annotation_import_path_ready')}
- Pilot promotion smoke: ${checkDetail(releaseGate, 'gold_promotion_smoke_ready')}
- Expansion promotion smoke: ${checkDetail(releaseGate, 'expansion_promotion_smoke_ready')}
- Public package clearance: ${checkDetail(releaseGate, 'unknown_license_resolved')}
- External model baselines: ${checkDetail(releaseGate, 'frontier_or_open_model_results_present')}
- Novelty audit: ${checkDetail(releaseGate, 'novelty_audit_final')}
`
}

for (const [name, path] of Object.entries(inputPaths)) {
  assert(existsSync(path), `Missing dataset card input ${name}: ${path}`)
}

writeText(
  datasetCardPath,
  renderCard({
    spec: readJson(inputPaths.spec),
    pilotSuite: readJson(inputPaths.pilotSuite),
    coverageMatrix: readJson(inputPaths.coverageMatrix),
    itemQualityAudit: readJson(inputPaths.itemQualityAudit),
    reviewMergeReport: readJson(inputPaths.reviewMergeReport),
    goldSummary: readJson(inputPaths.goldSummary),
    baselineAnalysis: readJson(inputPaths.baselineAnalysis),
    failureAtlas: readJson(inputPaths.failureAtlas),
    paperTables: readJson(inputPaths.paperTables),
    analysisPlan: readJson(inputPaths.analysisPlan),
    modelRunIndex: readJson(inputPaths.modelRunIndex),
    corpusAudit: readJson(inputPaths.corpusAudit),
    sourceDiversityPlan: readJson(inputPaths.sourceDiversityPlan),
    sourceAcquisitionManifest: readJson(inputPaths.sourceAcquisitionManifest),
    sourceAcquisitionPackets: readJson(inputPaths.sourceAcquisitionPackets),
    sourceAcquisitionAudit: readJson(inputPaths.sourceAcquisitionAudit),
    sourceAcquisitionFetchedRows: readJson(inputPaths.sourceAcquisitionFetchedRows),
    sourceAcquisitionCandidates: readJson(inputPaths.sourceAcquisitionCandidates),
    sourceAcquisitionReviewWorkbooks: readJson(inputPaths.sourceAcquisitionReviewWorkbooks),
    sourceAcquisitionReviewPreflight: readJson(inputPaths.sourceAcquisitionReviewPreflight),
    constructMap: readJson(inputPaths.constructMap),
    artifactChecklist: readJson(inputPaths.artifactChecklist),
    threatsValidity: readJson(inputPaths.threatsValidity),
    powerPlan: readJson(inputPaths.powerPlan),
    noveltyAudit: readJson(inputPaths.noveltyAudit),
    licenseReview: readJson(inputPaths.licenseReview),
    licenseClearance: readJson(inputPaths.licenseClearance),
    packageManifest: readJson(inputPaths.packageManifest),
    releaseGate: readJson(inputPaths.releaseGate),
    annotationProtocol: readJson(inputPaths.annotationProtocol),
    adjudicationReadiness: readJson(inputPaths.adjudicationReadiness),
    annotatorAgreement: readJson(inputPaths.annotatorAgreement),
    annotationExport: readJson(inputPaths.annotationExport),
    reviewCalibration: readJson(inputPaths.reviewCalibration),
    annotationQualityControl: readJson(inputPaths.annotationQualityControl),
    annotationImport: readJson(inputPaths.annotationImport),
    annotationImportSmoke: readJson(inputPaths.annotationImportSmoke),
    goldPromotionSmoke: readJson(inputPaths.goldPromotionSmoke),
    expansionPromotionSmoke: readJson(inputPaths.expansionPromotionSmoke),
  }),
)

console.log(`Wrote hard grounded research dataset card to ${datasetCardPath}`)
