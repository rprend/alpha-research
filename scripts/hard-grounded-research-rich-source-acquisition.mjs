import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const outputPath = join(generatedDir, 'rich-source-acquisition-rows.json')
const markdownPath = join(experimentDir, 'RICH_SOURCE_ACQUISITION.md')

const DATASET_SERVER = 'https://datasets-server.huggingface.co'

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function stableHash(text) {
  let hash = 2166136261
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function compact(value, max = 1400) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text
}

async function fetchRows(dataset, config, split, offset, length) {
  const url = new URL('/rows', DATASET_SERVER)
  url.searchParams.set('dataset', dataset)
  url.searchParams.set('config', config)
  url.searchParams.set('split', split)
  url.searchParams.set('offset', String(offset))
  url.searchParams.set('length', String(length))
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Dataset Viewer request failed ${response.status}: ${url}`)
  const body = await response.json()
  return body.rows || []
}

async function fetchRowPages(dataset, config, split, totalLength) {
  const rows = []
  for (let offset = 0; offset < totalLength; offset += 100) {
    rows.push(...(await fetchRows(dataset, config, split, offset, Math.min(100, totalLength - offset))))
  }
  return rows
}

function firstAnswer(answerBundle) {
  const first = answerBundle?.answer?.find((entry) => entry && entry.unanswerable === false)
  if (!first) return null
  const text = first.free_form_answer || first.extractive_spans?.[0] || first.yes_no
  if (!text) return null
  return {
    text: String(text),
    evidence: (first.evidence || first.highlighted_evidence || []).map((entry) => compact(entry, 900)).filter(Boolean),
  }
}

function qasperRows(rawRows) {
  const rows = []
  for (const wrapper of rawRows) {
    const row = wrapper.row
    const sections = row.full_text?.section_name || []
    const paragraphs = row.full_text?.paragraphs || []
    const sectionDocs = sections.map((section, index) => ({
      section,
      text: compact((paragraphs[index] || []).join('\n'), 1800),
    })).filter((entry) => entry.text.length >= 240)
    const questions = row.qas?.question || []
    const answers = row.qas?.answers || []
    for (let index = 0; index < questions.length; index += 1) {
      const answer = firstAnswer(answers[index])
      if (!answer || answer.evidence.length === 0) continue
      rows.push({
        source_id: `qasper:${row.id}:${index}`,
        dataset: 'allenai/qasper',
        config: 'qasper',
        split: 'train',
        upstream_row_id: row.id,
        title: row.title,
        question: questions[index],
        answer: answer.text,
        evidence: answer.evidence,
        documents: sectionDocs.slice(0, 10),
        source_kind: 'full_paper_sections_with_qa_evidence',
        content_hash: stableHash(JSON.stringify([row.id, questions[index], answer.text, answer.evidence])),
      })
    }
  }
  return rows
}

function hotpotRows(rawRows) {
  return rawRows.map((wrapper) => {
    const row = wrapper.row
    const titles = row.context?.title || []
    const sentences = row.context?.sentences || []
    const docs = titles.map((title, index) => ({
      section: title,
      text: compact((sentences[index] || []).join(' '), 1600),
    })).filter((entry) => entry.text.length >= 120)
    const supportingTitles = new Set((row.supporting_facts?.title || []).map(String))
    return {
      source_id: `hotpotqa:${row.id}`,
      dataset: 'hotpotqa/hotpot_qa',
      config: 'distractor',
      split: 'train',
      upstream_row_id: row.id,
      title: row.question,
      question: row.question,
      answer: row.answer,
      evidence: docs.filter((doc) => supportingTitles.has(doc.section)).map((doc) => doc.text),
      documents: docs,
      source_kind: 'multi_document_context_with_supporting_facts',
      content_hash: stableHash(JSON.stringify([row.id, row.question, row.answer, docs])),
    }
  }).filter((row) => row.evidence.length > 0 && row.documents.length >= 5)
}

async function main() {
  const qasperRaw = await fetchRowPages('allenai/qasper', 'qasper', 'train', 140)
  const hotpotRaw = await fetchRowPages('hotpotqa/hotpot_qa', 'distractor', 'train', 220)
  const qasper = qasperRows(qasperRaw).slice(0, 260)
  const hotpot = hotpotRows(hotpotRaw).slice(0, 220)
  const rows = [...qasper, ...hotpot]
  const report = {
    report_id: 'hard-grounded-research-rich-source-acquisition',
    checked_date: '2026-06-26',
    source: 'Hugging Face Dataset Viewer API',
    row_count: rows.length,
    datasets: {
      'allenai/qasper': qasper.length,
      'hotpotqa/hotpot_qa': hotpot.length,
    },
    purpose:
      'Richer source substrate for v8+ benchmark generation. Rows retain full paper sections or multi-document context so tasks can be grounded in evidence text rather than artificial locator/native-response fields.',
    rows,
  }
  writeJson(outputPath, report)
  writeText(
    markdownPath,
    `# Rich Source Acquisition

This acquisition pass fetches richer public rows from Hugging Face Dataset Viewer for the next hard-grounded benchmark candidate.

## Result

- Rows: ${rows.length}
- Qasper full-paper QA rows: ${qasper.length}
- HotpotQA multi-document rows: ${hotpot.length}
- Output: \`generated/rich-source-acquisition-rows.json\`

## Why This Exists

The v4-v7 candidates were rejected because compact previews made the tasks recoverable by generic extraction scripts. This source file preserves paper sections, QA evidence snippets, and multi-document contexts so the next generator can build tasks from evidence content instead of public fields such as \`Locator hint\`, \`Native response\`, or \`short result\`.
`,
  )
  console.log(`Wrote ${outputPath}`)
  console.log(`Wrote ${markdownPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
