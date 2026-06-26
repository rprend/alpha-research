import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const checklistJsonPath = join(generatedDir, 'artifact-checklist.json')
const checklistMarkdownPath = join(experimentDir, 'ARTIFACT_CHECKLIST.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
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
  powerPlan: join(generatedDir, 'power-plan.json'),
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
  scaledPublicPackageSummary: join(generatedDir, 'public-package/scaled-summary.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  submissionContract: join(generatedDir, 'submission-contract.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  reviewCalibration: join(generatedDir, 'review-calibration.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
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

function artifactClass(id, status, evidence, blockers = []) {
  return {
    id,
    status: status ? 'ready' : 'blocked',
    ready: Boolean(status),
    evidence,
    blockers,
  }
}

function buildChecklist({
  spec,
  pilotSuite,
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
  powerPlan,
  noveltyAudit,
  noveltyEvidence,
  licenseClearance,
  packageManifest,
  responsibleUse,
  scaledPublicPackageSummary,
  modelRunIndex,
  submissionContract,
  baselineAnalysis,
  paperTables,
  analysisPlan,
  paperClaimLedger,
  annotationExport,
  reviewCalibration,
  annotationQualityControl,
  reviewProgress,
  releaseGate,
}) {
  const failedReleaseChecks = releaseGate.checks.filter((check) => !check.passed)
  const artifactClasses = [
    artifactClass('taxonomy_and_constructs', constructMap.construct_map_ready, `${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs mapped to rubrics, metrics, examples, novelty risk, and review status.`),
    artifactClass('corpus_and_public_package', corpusAudit.corpus_audit_ready && licenseClearance.public_redistribution_clearance_ready, `${corpusAudit.summary.scaled_public_items} scaled public items; ${corpusAudit.summary.scaled_public_evidence_units} evidence units; ${corpusAudit.summary.scaled_public_pointer_only_evidence_units} pointer-only evidence units.`),
    artifactClass('source_diversity_expansion', sourceDiversityPlan.source_diversity_plan_ready, `${sourceDiversityPlan.summary.current_distinct_source_rows}/${sourceDiversityPlan.summary.target_distinct_source_rows_total} target source rows; deficit=${sourceDiversityPlan.summary.source_row_deficit_total}.`),
    artifactClass('source_acquisition_manifest', sourceAcquisitionManifest.source_acquisition_manifest_ready, `${sourceAcquisitionManifest.summary.acquisition_batches} acquisition batches; ${sourceAcquisitionManifest.summary.target_new_distinct_source_rows} target new source rows.`),
    artifactClass('source_acquisition_packets', sourceAcquisitionPackets.source_acquisition_packets_ready, `${sourceAcquisitionPackets.summary.packet_count} packet files; ${sourceAcquisitionPackets.summary.target_new_distinct_source_rows} acquisition row slots.`),
    artifactClass('source_acquisition_audit', sourceAcquisitionAudit.source_acquisition_audit_ready, `${sourceAcquisitionAudit.summary.audited_rows}/${sourceAcquisitionAudit.summary.expected_rows} packet rows audited; findings=${sourceAcquisitionAudit.summary.finding_count}.`),
    artifactClass('source_acquisition_fetch_report', sourceAcquisitionFetchedRows.source_acquisition_fetch_report_ready, `${sourceAcquisitionFetchedRows.summary.fetched_rows}/${sourceAcquisitionFetchedRows.summary.requested_rows} source rows fetched from Hugging Face; findings=${sourceAcquisitionFetchedRows.summary.finding_count}.`),
    artifactClass('source_acquisition_candidates', sourceAcquisitionCandidates.source_acquisition_candidates_ready, `${sourceAcquisitionCandidates.summary.candidates} fetched-row candidates; ${sourceAcquisitionCandidates.summary.required_review_rows} required review rows.`),
    artifactClass('source_acquisition_review_workbooks', sourceAcquisitionReviewWorkbooks.source_acquisition_review_workbooks_ready, `${sourceAcquisitionReviewWorkbooks.workbook_count} workbooks; ${sourceAcquisitionReviewWorkbooks.total_review_rows} source-acquisition review rows.`),
    artifactClass('source_acquisition_review_preflight', sourceAcquisitionReviewPreflight.source_acquisition_review_preflight_report_ready, `${sourceAcquisitionReviewPreflight.complete_review_rows}/${sourceAcquisitionReviewPreflight.total_review_rows} source-acquisition review rows complete; preflight_ready=${sourceAcquisitionReviewPreflight.preflight_ready}.`),
    artifactClass('review_calibration', reviewCalibration.review_calibration_ready && reviewCalibration.gold_promotion_allowed === false, `${reviewCalibration.sentinel_count} reviewer-screening sentinels across ${reviewCalibration.category_count} categories; minimum_accuracy=${reviewCalibration.acceptance_policy.minimum_accuracy}.`),
    artifactClass('annotation_quality_control', annotationQualityControl.annotation_quality_control_ready && annotationQualityControl.completion_claim_allowed === false, `${annotationQualityControl.workload.total_review_rows} review rows governed by ${annotationQualityControl.qa_rules.length} QA rules; sentinel rows in gold=${annotationQualityControl.thresholds.allow_sentinel_rows_in_gold}.`),
    artifactClass('annotation_and_review_workflow', annotationExport.export_ready && reviewProgress.review_progress_ready, `${annotationExport.totals.row_count} exported review rows; ${reviewProgress.summary.reviewed_items_remaining} reviewed target items remaining.`),
    artifactClass('submission_contract', submissionContract.submission_contract_ready && submissionContract.public_leaderboard_allowed === false, `${submissionContract.version}; pilot tasks=${submissionContract.scoring_sources.pilot.task_count}; required fields=${submissionContract.schema.answer_required_fields.length}.`),
    artifactClass('baselines_and_scoring', baselineAnalysis.systems.length >= 5 && modelRunIndex.eligible_model_baseline_count >= 2, `${baselineAnalysis.systems.length} scored systems; ${modelRunIndex.eligible_model_baseline_count} eligible external model baselines.`),
    artifactClass('statistics_and_scale', powerPlan.power_plan_ready, `${powerPlan.assumptions.target_reviewed_items_per_category} target reviewed items/category; ${powerPlan.current_state.reviewed_items_remaining} reviewed items remaining.`),
    artifactClass('paper_tables_and_figures', paperTables.paper_tables_ready, `${paperTables.summary.table_count} paper tables; ${paperTables.summary.challenge_rows} challenge rows; ${paperTables.summary.failure_modes} failure modes.`),
    artifactClass('analysis_plan', analysisPlan.analysis_plan_ready, `${analysisPlan.summary.hypotheses} hypotheses; ${analysisPlan.summary.model_families} model families; ${analysisPlan.summary.covariates} covariates.`),
    artifactClass('paper_claim_ledger', paperClaimLedger.paper_claim_ledger_ready && paperClaimLedger.completion_claim_allowed === false, `${paperClaimLedger.summary.claims} claims mapped to evidence; prohibited=${paperClaimLedger.summary.prohibited_claims}; diagnostic=${paperClaimLedger.summary.diagnostic_only_claims}.`),
    artifactClass('responsible_use', responsibleUse.responsible_use_ready && responsibleUse.public_leaderboard_allowed === false, `${responsibleUse.summary.policy_rules} policy rules; active restrictions=${responsibleUse.summary.active_restrictions}; public leaderboard allowed=${responsibleUse.public_leaderboard_allowed}.`),
    artifactClass('novelty_and_claim_boundaries', noveltyEvidence.completion_claim_allowed === false && noveltyEvidence.claim_boundaries.length >= 4 && noveltyAudit.refresh_summary?.query_count >= 4, `${noveltyEvidence.source_count} related-work sources; ${noveltyEvidence.allowed_claim_count} allowed claims; ${noveltyEvidence.prohibited_claim_count} prohibited claims; refresh queries=${noveltyAudit.refresh_summary?.query_count ?? 0}.`),
  ]

  const reproductionCommands = [
    { step: 'Generate benchmark seeds and pilot suite', command: 'node scripts/hard-grounded-research-benchmark.mjs' },
    { step: 'Run scorer smoke report', command: 'node scripts/hard-grounded-research-evaluate.mjs' },
    { step: 'Run local non-oracle baselines', command: 'node scripts/hard-grounded-research-runner.mjs && node scripts/hard-grounded-research-lexical-baseline.mjs && node scripts/hard-grounded-research-citation-verifier.mjs' },
    { step: 'Refresh submission contract', command: 'node scripts/hard-grounded-research-submission-contract.mjs' },
    { step: 'Refresh aggregate baseline analysis', command: 'node scripts/hard-grounded-research-report.mjs' },
    { step: 'Refresh corpus, construct, and power artifacts', command: 'node scripts/hard-grounded-research-corpus-audit.mjs && node scripts/hard-grounded-research-construct-map.mjs && node scripts/hard-grounded-research-power-plan.mjs' },
    { step: 'Refresh source diversity plan', command: 'node scripts/hard-grounded-research-source-diversity-plan.mjs' },
    { step: 'Refresh source acquisition manifest', command: 'node scripts/hard-grounded-research-source-acquisition-manifest.mjs' },
    { step: 'Refresh source acquisition packets', command: 'node scripts/hard-grounded-research-source-acquisition-packets.mjs' },
    { step: 'Refresh source acquisition audit', command: 'node scripts/hard-grounded-research-source-acquisition-audit.mjs' },
    { step: 'Fetch source acquisition row metadata', command: 'node scripts/hard-grounded-research-source-acquisition-fetch.mjs' },
    { step: 'Materialize source acquisition candidates', command: 'node scripts/hard-grounded-research-source-acquisition-candidates.mjs' },
    { step: 'Generate source acquisition review workbooks', command: 'node scripts/hard-grounded-research-source-acquisition-review-workbooks.mjs' },
    { step: 'Refresh source acquisition review preflight', command: 'node scripts/hard-grounded-research-source-acquisition-review-preflight.mjs' },
    { step: 'Refresh reviewer calibration sentinels', command: 'node scripts/hard-grounded-research-review-calibration.mjs' },
    { step: 'Refresh annotation quality-control policy', command: 'node scripts/hard-grounded-research-annotation-quality-control.mjs' },
    { step: 'Refresh paper tables and figure data', command: 'node scripts/hard-grounded-research-paper-tables.mjs' },
    { step: 'Refresh statistical analysis plan', command: 'node scripts/hard-grounded-research-analysis-plan.mjs' },
    { step: 'Refresh paper claim ledger', command: 'node scripts/hard-grounded-research-paper-claim-ledger.mjs' },
    { step: 'Refresh responsible-use policy', command: 'node scripts/hard-grounded-research-responsible-use.mjs' },
    { step: 'Refresh release and publication surfaces', command: 'node scripts/hard-grounded-research-release-gate.mjs && node scripts/hard-grounded-research-dataset-card.mjs && node scripts/hard-grounded-research-paper-draft.mjs' },
    { step: 'Validate harness integration', command: 'node scripts/validate-harness.mjs' },
    { step: 'Run app build and dashboard QA', command: 'node_modules/.bin/vite build && node scripts/qa-dashboard.mjs' },
    { step: 'Run full repository gates', command: 'pnpm build && pnpm test', caveat: 'Currently blocked in this workspace by pnpm ignored-build approvals for esbuild, sharp, and workerd.' },
  ]

  const paperReadiness = {
    status: releaseGate.status === 'release_ready' ? 'paper_ready' : 'blocked',
    release_gate_status: releaseGate.status,
    completion_claim_allowed: releaseGate.status === 'release_ready',
    blockers: failedReleaseChecks.map((check) => ({
      id: check.id,
      detail: check.detail,
      blocker: check.blocker,
    })),
  }

  const checklist = {
    artifact_checklist_ready: artifactClasses.every((entry) => entry.ready) && reproductionCommands.length >= 8,
    benchmark_id: spec.id,
    generated_from: {
      release_gate: 'generated/release-gate.json',
      corpus_audit: 'generated/corpus-audit.json',
      source_diversity_plan: 'generated/source-diversity-plan.json',
      source_acquisition_manifest: 'generated/source-acquisition-manifest.json',
      source_acquisition_packets: 'generated/source-acquisition-packets.json',
      source_acquisition_audit: 'generated/source-acquisition-audit.json',
      source_acquisition_fetched_rows: 'generated/source-acquisition-fetched-rows.json',
      source_acquisition_candidates: 'generated/source-acquisition-candidates.json',
      source_acquisition_review_workbooks: 'generated/source-acquisition-review-workbooks/index.json',
      source_acquisition_review_preflight: 'generated/source-acquisition-review-preflight.json',
      construct_map: 'generated/construct-map.json',
      power_plan: 'generated/power-plan.json',
      novelty_audit: 'generated/novelty-audit.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      responsible_use: 'generated/responsible-use.json',
      scaled_public_package_summary: 'generated/public-package/scaled-summary.json',
      model_run_index: 'generated/model-run-index.json',
      submission_contract: 'generated/submission-contract.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      paper_tables: 'generated/paper-tables.json',
      analysis_plan: 'generated/analysis-plan.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      annotation_export: 'generated/annotation-export/manifest.json',
      review_calibration: 'generated/review-calibration.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      review_progress: 'generated/review-progress.json',
    },
    summary: {
      categories: spec.categories.length,
      pilot_items: pilotSuite.items.length,
      scaled_public_items: scaledPublicPackageSummary.item_count,
      artifact_classes_ready: artifactClasses.filter((entry) => entry.ready).length,
      artifact_classes_total: artifactClasses.length,
      reproduction_commands: reproductionCommands.length,
      release_blockers: failedReleaseChecks.length,
    },
    artifact_classes: artifactClasses,
    reproduction_commands: reproductionCommands,
    paper_readiness: paperReadiness,
  }

  return checklist
}

function renderMarkdown(checklist) {
  const artifactRows = checklist.artifact_classes.map((entry) => [
    entry.id,
    entry.status,
    entry.evidence,
  ])
  const commandRows = checklist.reproduction_commands.map((entry) => [
    entry.step,
    `\`${entry.command}\`${entry.caveat ? `<br>${entry.caveat}` : ''}`,
  ])
  const blockerRows = checklist.paper_readiness.blockers.map((blocker) => [
    blocker.id,
    blocker.detail,
    blocker.blocker,
  ])

  return `# Hard Grounded Research Artifact Checklist

This generated checklist makes the benchmark package auditable as a research artifact. It records what can be regenerated, what is already packaged, and which paper-readiness claims remain blocked.

## Summary

- Checklist ready: ${checklist.artifact_checklist_ready}
- Benchmark id: \`${checklist.benchmark_id}\`
- Categories: ${checklist.summary.categories}
- Pilot items: ${checklist.summary.pilot_items}
- Scaled public items: ${checklist.summary.scaled_public_items}
- Artifact classes ready: ${checklist.summary.artifact_classes_ready}/${checklist.summary.artifact_classes_total}
- Reproduction commands: ${checklist.summary.reproduction_commands}
- Release blockers: ${checklist.summary.release_blockers}
- Paper readiness status: ${checklist.paper_readiness.status}
- Completion claim allowed: ${checklist.paper_readiness.completion_claim_allowed}

## Artifact Classes

${markdownTable(['Class', 'Status', 'Evidence'], artifactRows)}

## Reproduction Commands

${markdownTable(['Step', 'Command'], commandRows)}

## Paper-Readiness Blockers

${blockerRows.length ? markdownTable(['Check', 'Detail', 'Required action'], blockerRows) : 'No paper-readiness blockers are present.'}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing artifact checklist input ${name}: ${path}`)
}

const checklist = buildChecklist({
  spec: readJson(inputs.spec),
  pilotSuite: readJson(inputs.pilotSuite),
  corpusAudit: readJson(inputs.corpusAudit),
  sourceDiversityPlan: readJson(inputs.sourceDiversityPlan),
  sourceAcquisitionManifest: readJson(inputs.sourceAcquisitionManifest),
  sourceAcquisitionPackets: readJson(inputs.sourceAcquisitionPackets),
  sourceAcquisitionAudit: readJson(inputs.sourceAcquisitionAudit),
  sourceAcquisitionFetchedRows: readJson(inputs.sourceAcquisitionFetchedRows),
  sourceAcquisitionCandidates: readJson(inputs.sourceAcquisitionCandidates),
  sourceAcquisitionReviewWorkbooks: readJson(inputs.sourceAcquisitionReviewWorkbooks),
  sourceAcquisitionReviewPreflight: readJson(inputs.sourceAcquisitionReviewPreflight),
  constructMap: readJson(inputs.constructMap),
  powerPlan: readJson(inputs.powerPlan),
  noveltyAudit: readJson(inputs.noveltyAudit),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  licenseClearance: readJson(inputs.licenseClearance),
  packageManifest: readJson(inputs.packageManifest),
  responsibleUse: readJson(inputs.responsibleUse),
  scaledPublicPackageSummary: readJson(inputs.scaledPublicPackageSummary),
  modelRunIndex: readJson(inputs.modelRunIndex),
  submissionContract: readJson(inputs.submissionContract),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  paperTables: readJson(inputs.paperTables),
  analysisPlan: readJson(inputs.analysisPlan),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  annotationExport: readJson(inputs.annotationExport),
  reviewCalibration: readJson(inputs.reviewCalibration),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  reviewProgress: readJson(inputs.reviewProgress),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(checklistJsonPath, checklist)
writeText(checklistMarkdownPath, renderMarkdown(checklist))
console.log(`Wrote hard grounded research artifact checklist to ${checklistJsonPath}`)
console.log(`Wrote hard grounded research artifact checklist report to ${checklistMarkdownPath}`)
