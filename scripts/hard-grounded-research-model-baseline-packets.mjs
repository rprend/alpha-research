import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const packetsDir = join(experimentDir, 'model-baseline-packets')
const indexJsonPath = join(generatedDir, 'model-baseline-packets.json')
const indexMarkdownPath = join(experimentDir, 'MODEL_BASELINE_PACKETS.md')

const baselineTargets = [
  {
    system_id: 'frontier-api-grounded-baseline-v1',
    family: 'frontier_api',
    recommended_model: 'gpt-5.5 or current frontier model',
    description: 'Frontier model baseline using a high-accuracy API model with strict grounded JSON output.',
  },
  {
    system_id: 'open-weight-grounded-baseline-v1',
    family: 'open_weight_or_open_router',
    recommended_model: 'current strong open-weight instruct model',
    description: 'Open or locally hosted model baseline using the same grounded JSON output contract.',
  },
]

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

function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function evidenceUnits(item) {
  if (Array.isArray(item.evidence_units)) return item.evidence_units
  return (item.source_examples || []).flatMap((source) => source.evidence_units || [])
}

function promptForItem(item, target) {
  return {
    custom_id: item.id || item.task_id,
    task_id: item.id || item.task_id,
    benchmark_id: 'hard-grounded-research-benchmark',
    baseline_system_id: target.system_id,
    target_family: target.family,
    category: item.category,
    challenge_type: item.challenge?.type || 'native_row',
    messages: [
      {
        role: 'system',
        content:
          'You are answering a grounded research QA benchmark. Use only supplied evidence. Return strict JSON with no markdown.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          question: item.question,
          evidence: evidenceUnits(item).map((unit) => ({
            id: unit.id,
            title: unit.title,
            locator: unit.locator,
            text: unit.text,
          })),
          challenge: item.challenge || null,
          answer_schema: {
            answer: 'string; use ABSTAIN when supplied evidence is insufficient and CONFLICT when evidence is irreconcilably contradictory',
            citations: 'array of evidence ids that directly support the answer',
            abstained: 'boolean',
            confidence: 'number from 0 to 1',
            evidence_assessment: 'short explanation of why the citations support or fail to support the conclusion',
          },
          rules: [
            'Do not use outside knowledge.',
            'Every non-abstention answer must cite direct supporting evidence ids.',
            'If a citation supports a related fact but not the requested conclusion, answer ABSTAIN.',
            'If source dates or authority decide the answer, state the controlling evidence in evidence_assessment.',
          ],
        }),
      },
    ],
  }
}

function buildPackets(suite) {
  const tasks = suite.task_examples || suite.items
  const packets = []
  for (const target of baselineTargets) {
    const targetDir = join(packetsDir, target.system_id)
    const packetPath = join(targetDir, 'prompt-packet.jsonl')
    const manifestPath = join(targetDir, 'packet-manifest.json')
    const outputTemplatePath = join(targetDir, 'expected-output-template.jsonl')
    const prompts = tasks.map((item) => promptForItem(item, target))
    const outputTemplateRows = prompts.map((prompt) => ({
      custom_id: prompt.custom_id,
      output_text:
        '{"answer":"ABSTAIN","citations":[],"abstained":true,"confidence":0,"evidence_assessment":"Replace this template row with model output before import."}',
    }))

    writeJsonl(packetPath, prompts)
    writeJsonl(outputTemplatePath, outputTemplateRows)
    writeJson(manifestPath, {
      benchmark_id: 'hard-grounded-research-benchmark',
      system_id: target.system_id,
      target_family: target.family,
      recommended_model: target.recommended_model,
      description: target.description,
      suite: 'pilot',
      prompt_count: prompts.length,
      prompt_packet: relative(root, packetPath),
      expected_output_template: relative(root, outputTemplatePath),
      import_command: `node scripts/hard-grounded-research-import-model-results.mjs --system-id=${target.system_id} --input=${relative(root, outputTemplatePath).replace('expected-output-template.jsonl', 'model-output.jsonl')} --suite=pilot`,
      scored_report_required_for_release: true,
    })
    packets.push({
      system_id: target.system_id,
      target_family: target.family,
      recommended_model: target.recommended_model,
      prompt_count: prompts.length,
      prompt_packet: relative(root, packetPath),
      manifest: relative(root, manifestPath),
      expected_output_template: relative(root, outputTemplatePath),
      scored_report_present: existsSync(join(experimentDir, 'runs', target.system_id, 'report.json')),
    })
  }

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_suite: 'generated/pilot-suite.json',
    required_scored_model_baselines: 2,
    packet_count: packets.length,
    prompt_count_per_packet: tasks.length,
    packets_ready: packets.length >= 2 && packets.every((packet) => packet.prompt_count === tasks.length),
    scored_reports_ready: packets.filter((packet) => packet.scored_report_present).length >= 2,
    packets,
  }
}

function renderMarkdown(index) {
  const rows = index.packets.map((packet) => [
    packet.system_id,
    packet.target_family,
    packet.recommended_model,
    String(packet.prompt_count),
    packet.scored_report_present ? 'yes' : 'no',
  ])

  return `# Hard Grounded Research Model Baseline Packets

This generated artifact prepares two required model baselines without counting them as scored results. Release readiness still requires importing and scoring actual model outputs for at least two non-fixture systems.

## Summary

- Source suite: ${index.source_suite}
- Packets: ${index.packet_count}
- Prompt count per packet: ${index.prompt_count_per_packet}
- Packets ready: ${index.packets_ready}
- Scored reports ready: ${index.scored_reports_ready}

## Packets

${markdownTable(['System', 'Target family', 'Recommended model', 'Prompts', 'Scored report present'], rows)}
`
}

if (!existsSync(pilotSuitePath)) throw new Error(`Missing pilot suite: ${pilotSuitePath}`)

const packetIndex = buildPackets(readJson(pilotSuitePath))
writeJson(indexJsonPath, packetIndex)
writeText(indexMarkdownPath, renderMarkdown(packetIndex))

console.log(`Wrote hard grounded model baseline packet index to ${indexJsonPath}`)
console.log(`Wrote hard grounded model baseline packet report to ${indexMarkdownPath}`)
