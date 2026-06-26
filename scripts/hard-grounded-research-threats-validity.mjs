import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const threatsJsonPath = join(generatedDir, 'threats-validity.json')
const threatsMarkdownPath = join(experimentDir, 'THREATS_TO_VALIDITY.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
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

function check(releaseGate, id) {
  return releaseGate.checks.find((entry) => entry.id === id) || null
}

function buildThreats({
  spec,
  releaseGate,
  corpusAudit,
  constructMap,
  powerPlan,
  reviewProgress,
  itemQualityAudit,
  noveltyEvidence,
  licenseClearance,
  modelRunIndex,
}) {
  const threats = [
    {
      id: 'construct_undercoverage',
      type: 'construct_validity',
      severity: constructMap.summary.ready_constructs === spec.categories.length ? 'medium' : 'high',
      risk: 'The taxonomy could name plausible hard-grounded tasks without proving that each category is operationally distinct.',
      evidence: `${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs mapped; ${constructMap.summary.constructs_with_reviewed_gold} constructs have reviewed gold.`,
      mitigation: 'Keep construct map, category-specific rubric dimensions, and per-category review targets in the release gate.',
      release_check_ids: ['construct_map_ready', 'gold_review_complete', 'category_scale_ready'],
    },
    {
      id: 'machine_seeded_label_bias',
      type: 'internal_validity',
      severity: reviewProgress.summary.reviewed_items_remaining > 0 ? 'high' : 'low',
      risk: 'Current labels and transformed tasks may encode generator assumptions rather than human-reviewed grounded truth.',
      evidence: `${reviewProgress.summary.pilot_complete_review_rows}/${reviewProgress.summary.pilot_total_review_rows} pilot review rows complete; ${reviewProgress.summary.expansion_complete_review_rows}/${reviewProgress.summary.expansion_total_review_rows} expansion review rows complete.`,
      mitigation: 'Block gold release until double review, preflight, merge, and adjudication complete.',
      release_check_ids: ['review_preflight_ready', 'review_merge_ready', 'expansion_review_preflight_ready', 'expansion_review_merge_ready'],
    },
    {
      id: 'small_pilot_uncertainty',
      type: 'statistical_conclusion_validity',
      severity: powerPlan.current_state.current_valid_reviewed_items === 0 ? 'high' : 'medium',
      risk: 'Pilot metrics may be unstable and should not be read as final category-level benchmark results.',
      evidence: `${powerPlan.current_state.current_pilot_items} pilot items; ${powerPlan.current_state.current_valid_reviewed_items} valid reviewed items; target ${powerPlan.assumptions.target_reviewed_items_total} reviewed items.`,
      mitigation: 'Report uncertainty and keep category-scale claims blocked until the planned reviewed sample is complete.',
      release_check_ids: ['power_plan_ready', 'category_scale_ready', 'baseline_uncertainty_present'],
    },
    {
      id: 'source_corpus_bias',
      type: 'external_validity',
      severity: corpusAudit.summary.source_dataset_count < 8 ? 'medium' : 'low',
      risk: 'Five Hugging Face source datasets may not represent all large-corpus research workflows or domains.',
      evidence: `${corpusAudit.summary.source_dataset_count} source datasets; ${corpusAudit.summary.scaled_public_source_rows} scaled public source rows; ${corpusAudit.summary.scaled_public_items} scaled public items.`,
      mitigation: 'Describe the benchmark as a controlled failure-mode suite rather than a universal research QA sample.',
      release_check_ids: ['corpus_audit_ready', 'scaled_public_package_present'],
    },
    {
      id: 'license_and_text_packaging',
      type: 'artifact_validity',
      severity: licenseClearance.public_redistribution_clearance_ready ? 'medium' : 'high',
      risk: 'Mixed upstream licenses can make public package contents diverge from private development evidence text.',
      evidence: `packaged clearance=${licenseClearance.public_redistribution_clearance_ready}; replaced=${licenseClearance.remediated_replacement_count}; pointer_only=${licenseClearance.pointer_only_candidate_count}.`,
      mitigation: 'Use pointer-only packaging, hashes, replacement candidates, and explicit source-license reporting.',
      release_check_ids: ['unknown_license_resolved', 'license_impact_clear', 'public_package_manifest_present'],
    },
    {
      id: 'baseline_overfitting_and_prompt_variance',
      type: 'evaluation_validity',
      severity: modelRunIndex.eligible_model_baseline_count >= 2 ? 'medium' : 'high',
      risk: 'A small number of model baselines can overstate or understate benchmark difficulty because of prompt and provider variance.',
      evidence: `${modelRunIndex.eligible_model_baseline_count} eligible external baselines; ${modelRunIndex.runs?.length || 0} indexed runs.`,
      mitigation: 'Keep prompt packets, scored reports, and non-oracle local baselines reproducible; require at least two external baselines before paper claims.',
      release_check_ids: ['frontier_or_open_model_results_present', 'model_baseline_packets_present'],
    },
    {
      id: 'novelty_overclaiming',
      type: 'novelty_validity',
      severity: noveltyEvidence.completion_claim_allowed ? 'medium' : 'high',
      risk: 'Adjacent RAG, grounding, temporal QA, contradiction, and citation-faithfulness work may already cover individual slices.',
      evidence: `${noveltyEvidence.source_count} related-work sources; ${noveltyEvidence.allowed_claim_count} allowed claims; ${noveltyEvidence.prohibited_claim_count} prohibited claims; completion_claim_allowed=${noveltyEvidence.completion_claim_allowed}.`,
      mitigation: 'Claim novelty only for the unified hard-grounded failure taxonomy after a final literature refresh.',
      release_check_ids: ['novelty_evidence_registry_present', 'novelty_claim_boundaries_ready', 'novelty_audit_final'],
    },
    {
      id: 'item_quality_and_review_burden',
      type: 'measurement_validity',
      severity: itemQualityAudit.repair_before_gold > 0 ? 'high' : 'medium',
      risk: 'Reviewers may accept fluent but ill-formed transformed items unless quality findings are surfaced in the workflow.',
      evidence: `${itemQualityAudit.repair_before_gold} repair-before-gold items; ${itemQualityAudit.review_carefully} review-carefully items.`,
      mitigation: 'Carry quality findings into workbooks and keep repair queues visible before gold promotion.',
      release_check_ids: ['repair_queue_clear', 'reviewer_handoff_ready'],
    },
  ]

  const releaseBlockedThreats = threats.map((threat) => ({
    ...threat,
    release_checks: threat.release_check_ids.map((id) => {
      const releaseCheck = check(releaseGate, id)
      return {
        id,
        passed: releaseCheck?.passed ?? false,
        detail: releaseCheck?.detail || 'not found',
      }
    }),
  }))

  return {
    threats_validity_ready: threats.length >= 8 && releaseBlockedThreats.every((threat) => threat.release_checks.length > 0),
    benchmark_id: spec.id,
    generated_from: {
      release_gate: 'generated/release-gate.json',
      corpus_audit: 'generated/corpus-audit.json',
      construct_map: 'generated/construct-map.json',
      power_plan: 'generated/power-plan.json',
      review_progress: 'generated/review-progress.json',
      item_quality_audit: 'generated/item-quality-audit.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      license_clearance: 'generated/license-clearance.json',
      model_run_index: 'generated/model-run-index.json',
    },
    summary: {
      threat_count: releaseBlockedThreats.length,
      high_severity_count: releaseBlockedThreats.filter((threat) => threat.severity === 'high').length,
      blocked_release_check_count: releaseGate.blockers.length,
      completion_claim_allowed: false,
    },
    threats: releaseBlockedThreats,
  }
}

function renderMarkdown(report) {
  const threatRows = report.threats.map((threat) => [
    threat.id,
    threat.type,
    threat.severity,
    threat.evidence,
    threat.mitigation,
  ])
  const releaseRows = report.threats.flatMap((threat) =>
    threat.release_checks.map((entry) => [
      threat.id,
      entry.id,
      entry.passed ? 'yes' : 'no',
      entry.detail,
    ]),
  )

  return `# Hard Grounded Research Threats To Validity

This generated report turns paper risks into an auditable checklist. It does not clear human-review, scale, or final novelty blockers; it makes those blockers explicit as threats to validity.

## Summary

- Threats report ready: ${report.threats_validity_ready}
- Benchmark id: \`${report.benchmark_id}\`
- Threats tracked: ${report.summary.threat_count}
- High-severity threats: ${report.summary.high_severity_count}
- Release blockers: ${report.summary.blocked_release_check_count}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Threats

${markdownTable(['Threat', 'Type', 'Severity', 'Current evidence', 'Mitigation'], threatRows)}

## Release-Check Links

${markdownTable(['Threat', 'Release check', 'Passed', 'Detail'], releaseRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing threats-to-validity input ${name}: ${path}`)
}

const report = buildThreats({
  spec: readJson(inputs.spec),
  releaseGate: readJson(inputs.releaseGate),
  corpusAudit: readJson(inputs.corpusAudit),
  constructMap: readJson(inputs.constructMap),
  powerPlan: readJson(inputs.powerPlan),
  reviewProgress: readJson(inputs.reviewProgress),
  itemQualityAudit: readJson(inputs.itemQualityAudit),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  licenseClearance: readJson(inputs.licenseClearance),
  modelRunIndex: readJson(inputs.modelRunIndex),
})

writeJson(threatsJsonPath, report)
writeText(threatsMarkdownPath, renderMarkdown(report))
console.log(`Wrote hard grounded research threats-to-validity report to ${threatsJsonPath}`)
console.log(`Wrote hard grounded research threats-to-validity markdown to ${threatsMarkdownPath}`)
