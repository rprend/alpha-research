import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const specPath = join(experimentDir, 'benchmark-spec.json')
const outDir = join(experimentDir, 'generated')
const viewerBaseUrl = 'https://datasets-server.huggingface.co'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
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

function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
}

function byId(items) {
  return new Map(items.map((item) => [item.id, item]))
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function validateSpec(spec) {
  assert(spec.id === 'hard-grounded-research-benchmark', 'Unexpected benchmark id.')
  assert(Array.isArray(spec.categories) && spec.categories.length === 10, 'Expected exactly 10 hard categories.')
  assert(Array.isArray(spec.datasets) && spec.datasets.length >= 4, 'Expected at least four HF datasets.')
  assert(Array.isArray(spec.seed_tasks) && spec.seed_tasks.length >= spec.categories.length, 'Expected one seed task per category.')
  assert(Array.isArray(spec.approaches) && spec.approaches.length >= 3, 'Expected multiple benchmark construction approaches.')

  const categorySet = new Set(spec.categories)
  const datasetIds = new Set(spec.datasets.map((dataset) => dataset.id))
  const taskCategories = new Set(spec.seed_tasks.map((task) => task.category))

  for (const category of categorySet) {
    assert(taskCategories.has(category), `Missing seed task for category: ${category}`)
  }

  for (const dataset of spec.datasets) {
    assert(dataset.url?.startsWith('https://hf.co/datasets/'), `Dataset is not grounded in HF: ${dataset.id}`)
    assert(dataset.viewer?.config && dataset.viewer?.split, `Dataset is missing viewer config/split: ${dataset.id}`)
    assert(Array.isArray(dataset.covers) && dataset.covers.length > 0, `Dataset covers no categories: ${dataset.id}`)
    for (const category of dataset.covers) {
      assert(categorySet.has(category), `Dataset ${dataset.id} covers unknown category: ${category}`)
    }
  }

  for (const task of spec.seed_tasks) {
    assert(categorySet.has(task.category), `Task ${task.id} has unknown category.`)
    assert(Array.isArray(task.dataset_ids) && task.dataset_ids.length > 0, `Task ${task.id} has no datasets.`)
    for (const datasetId of task.dataset_ids) {
      assert(datasetIds.has(datasetId), `Task ${task.id} references unknown dataset: ${datasetId}`)
    }
    assert(task.question_template, `Task ${task.id} is missing question template.`)
    assert(task.expected_failure, `Task ${task.id} is missing expected failure.`)
    assert(Array.isArray(task.scoring_focus) && task.scoring_focus.length > 0, `Task ${task.id} has no scoring focus.`)
  }
}

function scoreApproaches(spec) {
  const datasetMap = byId(spec.datasets)
  const categorySet = new Set(spec.categories)

  return spec.approaches.map((approach) => {
    const taskMatches = spec.seed_tasks.filter((task) => {
      if (approach.id === 'reuse_native_labels') {
        return task.dataset_ids.every((id) => datasetMap.get(id)?.native_signals?.length)
      }
      if (approach.id === 'adversarial_transform') {
        return [
          'stale-vs-current document conflicts',
          'appended document lifecycle changes',
          'source authority conflicts',
          'evidence insufficiency / abstention',
          'citation supports fact but not conclusion',
          'temporal questions: as of date X',
          'cross-document contradiction',
        ].includes(task.category)
      }
      if (approach.id === 'composed_corpus_suite') {
        return task.dataset_ids.length > 1
      }
      return false
    })
    const covered = new Set(taskMatches.map((task) => task.category))
    return {
      id: approach.id,
      name: approach.name,
      covered_categories: [...covered],
      coverage_count: covered.size,
      coverage_rate: Number((covered.size / categorySet.size).toFixed(2)),
      seed_task_count: taskMatches.length,
    }
  }).sort((a, b) => b.coverage_count - a.coverage_count || b.seed_task_count - a.seed_task_count)
}

function buildSuite(spec) {
  const datasetMap = byId(spec.datasets)
  return spec.seed_tasks.map((task) => ({
    id: task.id,
    category: task.category,
    question_template: task.question_template,
    answer_contract: {
      required_fields: [
        'answer',
        'citations',
        'evidence_assessment',
        'confidence',
      ],
      citation_rule: 'Every non-abstention answer sentence must cite evidence that directly supports that sentence.',
      abstention_rule: 'If required evidence is missing, answer must be ABSTAIN and list missing evidence.',
    },
    source_plan: task.dataset_ids.map((id) => {
      const dataset = datasetMap.get(id)
      return {
        dataset_id: id,
        url: dataset.url,
        viewer: dataset.viewer,
        native_signals: dataset.native_signals,
        role: dataset.construction_role,
      }
    }),
    expected_failure: task.expected_failure,
    scoring_focus: task.scoring_focus,
  }))
}

function coverageMatrix(spec) {
  return spec.categories.map((category) => {
    const datasets = spec.datasets.filter((dataset) => dataset.covers.includes(category)).map((dataset) => dataset.id)
    const tasks = spec.seed_tasks.filter((task) => task.category === category).map((task) => task.id)
    return {
      category,
      dataset_count: datasets.length,
      datasets,
      task_count: tasks.length,
      tasks,
    }
  })
}

const adversarialCategories = new Set([
  'stale-vs-current document conflicts',
  'appended document lifecycle changes',
  'source authority conflicts',
  'evidence insufficiency / abstention',
  'citation supports fact but not conclusion',
  'temporal questions: as of date X',
  'cross-document contradiction',
])

function sequenceAt(value, index) {
  if (Array.isArray(value)) return value[index]
  return value
}

function compactText(value, maxLength = 700) {
  if (value === null || value === undefined) return ''
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trim()}…`
}

function firstArrayValue(value) {
  if (Array.isArray(value)) return value[0]
  return value
}

function climateFeverLabel(value) {
  const labels = ['SUPPORTS', 'REFUTES', 'NOT_ENOUGH_INFO', 'DISPUTED']
  if (Number.isInteger(value) && labels[value]) return labels[value]
  return value
}

function buildChallenge(category, sourceExamples, index) {
  const primary = sourceExamples[0]
  const secondary = sourceExamples[1] || sourceExamples[0]
  const primaryEvidence = primary.evidence_units?.[0]
  const secondaryEvidence = secondary.evidence_units?.[0]
  const asOfYear = 2018 + index

  if (category === 'stale-vs-current document conflicts') {
    return {
      type: 'stale_current_conflict',
      older_document: {
        synthetic_date: `${asOfYear - 4}-01-01`,
        claim: primary.native_question,
        status: 'stale_candidate',
      },
      current_document: {
        synthetic_date: `${asOfYear}-01-01`,
        evidence_id: primaryEvidence?.id,
        status: 'current_controlling_evidence',
      },
      required_behavior: 'Use the current document for the answer and explicitly mark the older document as stale if it conflicts.',
      trap: 'Treating the older claim text as equally current evidence.',
    }
  }

  if (category === 'appended document lifecycle changes') {
    return {
      type: 'document_lifecycle_appendix',
      original_body: {
        evidence_id: primaryEvidence?.id,
        interpretation: 'candidate_original_claim',
      },
      appended_update: {
        synthetic_section: 'Appendix Z / erratum',
        synthetic_date: `${asOfYear}-06-30`,
        evidence_id: primary.evidence_units?.find((evidence) => String(evidence.id).includes(':appendix-update:'))?.id,
        instruction: 'This appended section controls the final answer when it narrows or supersedes the original body.',
      },
      required_behavior: 'Distinguish original-body evidence from appended evidence before answering.',
      trap: 'Citing original-body text for a conclusion that the appended section qualifies.',
    }
  }

  if (category === 'source authority conflicts') {
    return {
      type: 'authority_conflict',
      authority_order: [
        'expert-reviewed evidence',
        'dataset claim label',
        'community explanation',
      ],
      high_authority_evidence_id: primaryEvidence?.id,
      lower_authority_evidence_id: secondaryEvidence?.id,
      required_behavior: 'Resolve conflicts by applying the authority order and naming the lower-authority source if rejected.',
      trap: 'Choosing the clearest prose rather than the highest-authority evidence.',
    }
  }

  if (category === 'evidence insufficiency / abstention') {
    return {
      type: 'insufficiency_probe',
      missing_evidence: [
        'independent confirmation of the requested conclusion',
        'direct evidence tying the cited fact to the final claim',
      ],
      candidate_evidence_id: primaryEvidence?.id,
      required_behavior: 'Answer only if the evidence establishes the requested conclusion; otherwise abstain and name the missing evidence.',
      trap: 'Answering from a plausible but under-supported related fact.',
    }
  }

  if (category === 'citation supports fact but not conclusion') {
    return {
      type: 'citation_overreach_probe',
      supported_fact_evidence_id: primaryEvidence?.id,
      unsupported_conclusion_template: 'Because the cited fact is true, the broader comparative or causal conclusion is also true.',
      required_behavior: 'Separate supported premises from conclusions and refuse unsupported inferences.',
      trap: 'Using a true citation as post-hoc support for a conclusion it does not entail.',
    }
  }

  if (category === 'temporal questions: as of date X') {
    return {
      type: 'as_of_date_constraint',
      as_of_date: `${asOfYear}-12-31`,
      future_evidence_policy: 'Future evidence is unavailable and must not be used in the answer.',
      valid_evidence_ids: [primaryEvidence?.id].filter(Boolean),
      excluded_future_evidence_ids: sourceExamples.slice(1).flatMap((source) => (source.evidence_units || []).map((evidence) => evidence.id)),
      required_behavior: 'Answer as of the requested date and disclose excluded future evidence if mentioned.',
      trap: 'Leaking later evidence into an as-of answer.',
    }
  }

  if (category === 'cross-document contradiction') {
    return {
      type: 'cross_document_contradiction',
      document_a_evidence_id: primaryEvidence?.id,
      document_b_evidence_id: secondaryEvidence?.id,
      contradiction_policy: 'If documents cannot be reconciled by authority or date, report CONFLICT rather than synthesizing consensus.',
      required_behavior: 'Partition evidence into supporting/refuting/insufficient groups before final answer.',
      trap: 'Flattening incompatible evidence into a single smooth answer.',
    }
  }

  return null
}

function withLifecycleAppendixEvidence(sourceExample, index) {
  const originalEvidence = sourceExample.evidence_units?.[0]
  if (!originalEvidence) return sourceExample
  const syntheticDate = `${2018 + index}-06-30`
  const appendixEvidence = {
    id: `${sourceExample.source_row_id}:appendix-update:${index}`,
    title: sourceExample.paper_title || originalEvidence.title || 'Appendix update',
    locator: `Appendix Z / erratum ${syntheticDate}`,
    text: compactText(
      `Appendix Z, dated ${syntheticDate}, supersedes the original body for this question. The final answer remains "${sourceExample.native_answer}", but reviewers must cite this appendix update together with the original evidence because the original body alone is not the controlling document state.`,
      500,
    ),
  }
  return {
    ...sourceExample,
    evidence_units: [
      originalEvidence,
      appendixEvidence,
      ...(sourceExample.evidence_units || []).slice(1),
    ],
    hard_grounding_signals: unique([
      ...(sourceExample.hard_grounding_signals || []),
      'synthetic-appendix-update',
      'document-lifecycle',
    ]),
  }
}

function prepareSourceExamplesForTask(task, sourceExamples, index) {
  if (task.category !== 'appended document lifecycle changes') return sourceExamples
  return sourceExamples.map((sourceExample) => withLifecycleAppendixEvidence(sourceExample, index))
}

function normalizeQasperAnswer(qas, index) {
  const answers = qas.answers?.[index]
  const answerGroup = firstArrayValue(answers?.answer)
  return {
    question: sequenceAt(qas.question, index),
    question_id: sequenceAt(qas.question_id, index),
    unanswerable: Boolean(answerGroup?.unanswerable),
    answer: compactText(
      answerGroup?.free_form_answer ||
        firstArrayValue(answerGroup?.extractive_spans) ||
        (answerGroup?.yes_no === null || answerGroup?.yes_no === undefined ? '' : answerGroup.yes_no),
      240,
    ),
    evidence: compactText(firstArrayValue(answerGroup?.highlighted_evidence) || firstArrayValue(answerGroup?.evidence), 700),
  }
}

function normalizeDatasetRows(dataset, rows) {
  return rows.slice(0, 3).map(({ row }, index) => {
    if (dataset.id === 'hotpotqa/hotpot_qa') {
      const supportTitles = row.supporting_facts?.title || []
      return {
        source_dataset: dataset.id,
        source_row_id: row.id,
        row_offset: index,
        native_question: row.question,
        native_answer: row.answer,
        evidence_units: supportTitles.map((title, evidenceIndex) => ({
          id: `${row.id}:support:${evidenceIndex}`,
          title,
          locator: `sentence ${row.supporting_facts?.sent_id?.[evidenceIndex] ?? 'unknown'}`,
          text: compactText(row.context?.sentences?.[row.context?.title?.indexOf(title)]?.join(' '), 500),
        })),
        hard_grounding_signals: ['multi-hop', 'distractor-context', row.type, row.level].filter(Boolean),
      }
    }

    if (dataset.id === 'allenai/qasper') {
      const normalized = normalizeQasperAnswer(row.qas || {}, 0)
      return {
        source_dataset: dataset.id,
        source_row_id: row.id,
        row_offset: index,
        paper_title: row.title,
        native_question: normalized.question,
        native_answer: normalized.unanswerable ? 'ABSTAIN' : normalized.answer,
        evidence_units: [
          {
            id: `${row.id}:${normalized.question_id || 'question'}:evidence:0`,
            title: row.title,
            locator: normalized.question_id,
            text: normalized.evidence || compactText(row.abstract, 500),
          },
        ],
        hard_grounding_signals: [
          'long-document',
          normalized.unanswerable ? 'unanswerable' : 'extractive-evidence',
          row.figures_and_tables?.caption?.length ? 'figures-or-tables' : '',
        ].filter(Boolean),
      }
    }

    if (dataset.id === 'danwakeem/wikitablequestions-wtq') {
      return {
        source_dataset: dataset.id,
        source_row_id: row.id,
        row_offset: index,
        native_question: row.question,
        native_answer: (row.answers || []).join('; '),
        evidence_units: [
          {
            id: `${row.id}:table`,
            title: row.table?.name || 'table',
            locator: row.answer_coordinates ? `answer_coordinates=${JSON.stringify(row.answer_coordinates)}` : 'table',
            text: compactText(
              [
                `header: ${(row.table?.header || []).join(' | ')}`,
                ...(row.table?.rows || []).slice(0, 3).map((tableRow) => `row: ${tableRow.join(' | ')}`),
              ].join(' / '),
              700,
            ),
          },
        ],
        hard_grounding_signals: ['table-denotation', row.aggregation_label ? `aggregation:${row.aggregation_label}` : 'no-aggregation'],
      }
    }

    if (dataset.id === 'tdiggelm/climate_fever') {
      const evidence = firstArrayValue(row.evidences) || {}
      const claimLabel = climateFeverLabel(row.claim_label)
      const evidenceLabel = climateFeverLabel(evidence.evidence_label)
      return {
        source_dataset: dataset.id,
        source_row_id: row.claim_id,
        row_offset: index,
        native_question: `Verify this claim: ${row.claim}`,
        native_answer: claimLabel,
        evidence_units: [
          {
            id: evidence.evidence_id || `${row.claim_id}:evidence:0`,
            title: evidence.article || 'evidence',
            locator: evidenceLabel || claimLabel,
            text: compactText(evidence.evidence, 700),
          },
        ],
        hard_grounding_signals: ['claim-verification', claimLabel, evidenceLabel].filter(Boolean),
      }
    }

    if (dataset.id === 'Pavithree/eli5') {
      const bestAnswerIndex = row.answers?.score?.reduce(
        (best, score, answerIndex) => (score > (row.answers?.score?.[best] ?? -Infinity) ? answerIndex : best),
        0,
      ) ?? 0
      return {
        source_dataset: dataset.id,
        source_row_id: row.q_id,
        row_offset: index,
        native_question: row.title,
        native_answer: compactText(row.answers?.text?.[bestAnswerIndex], 350),
        evidence_units: [
          {
            id: `${row.q_id}:answer:${row.answers?.a_id?.[bestAnswerIndex] || bestAnswerIndex}`,
            title: row.subreddit || 'explainlikeimfive',
            locator: row.url,
            text: compactText(row.answers?.text?.[bestAnswerIndex], 700),
          },
        ],
        hard_grounding_signals: ['long-form-explanation', 'community-answer', row.answers_urls?.[bestAnswerIndex]?.length ? 'linked-source' : 'no-linked-source'],
      }
    }

    return {
      source_dataset: dataset.id,
      source_row_id: row.id || row.q_id || row.claim_id || `row-${index}`,
      row_offset: index,
      native_question: row.question || row.title || row.claim || 'unknown',
      native_answer: row.answer || row.answers || row.claim_label || '',
      evidence_units: [],
      hard_grounding_signals: ['untyped-row'],
    }
  })
}

async function fetchFirstRows(dataset) {
  const params = new URLSearchParams({
    dataset: dataset.id,
    config: dataset.viewer.config,
    split: dataset.viewer.split,
  })
  const url = `${viewerBaseUrl}/first-rows?${params}`
  const response = await fetch(url)
  const payload = await response.json()
  if (!response.ok || payload.error) {
    throw new Error(`Dataset Viewer failed for ${dataset.id}: ${payload.error || response.statusText}`)
  }
  assert(Array.isArray(payload.rows) && payload.rows.length > 0, `Dataset Viewer returned no rows for ${dataset.id}`)
  return {
    dataset_id: dataset.id,
    viewer_url: url,
    config: dataset.viewer.config,
    split: dataset.viewer.split,
    features: (payload.features || []).map((feature) => feature.name),
    examples: normalizeDatasetRows(dataset, payload.rows),
  }
}

async function materializeLiveExamples(spec) {
  const materialized = []
  for (const dataset of spec.datasets) {
    materialized.push(await fetchFirstRows(dataset))
  }

  const examplesByDataset = new Map(materialized.map((entry) => [entry.dataset_id, entry.examples]))
  const taskExamples = spec.seed_tasks.map((task) => ({
    task_id: task.id,
    category: task.category,
    question_template: task.question_template,
    source_examples: task.dataset_ids.map((datasetId) => {
      const examples = examplesByDataset.get(datasetId) || []
      assert(examples.length > 0, `No materialized examples for ${task.id} from ${datasetId}`)
      return examples[0]
    }),
    expected_failure: task.expected_failure,
    scoring_focus: task.scoring_focus,
  }))

  return {
    source: 'Hugging Face Dataset Viewer first-rows API',
    materialized_datasets: materialized,
    task_examples: taskExamples,
  }
}

function buildPilotSuite(spec, materializedExamples) {
  const examplesByDataset = new Map(materializedExamples.materialized_datasets.map((entry) => [entry.dataset_id, entry.examples]))
  const pilotItems = []

  for (const task of spec.seed_tasks) {
    const taskExampleSets = task.dataset_ids.map((datasetId) => {
      const examples = examplesByDataset.get(datasetId) || []
      assert(examples.length > 0, `No pilot examples for ${task.id} from ${datasetId}`)
      return examples
    })
    const maxExamples = Math.max(...taskExampleSets.map((examples) => examples.length))

    for (let index = 0; index < maxExamples; index += 1) {
      const sourceExamples = prepareSourceExamplesForTask(
        task,
        taskExampleSets.map((examples) => examples[index % examples.length]),
        index,
      )
      const construction = task.dataset_ids.length > 1 ? 'composed_corpus_suite' : 'reuse_native_labels'
      const transform = adversarialCategories.has(task.category) ? 'adversarial_wrapper' : 'native_row'
      const challenge = buildChallenge(task.category, sourceExamples, index)
      const suffix = String(index + 1).padStart(3, '0')
      pilotItems.push({
        id: `${task.id}_pilot_${suffix}`,
        seed_task_id: task.id,
        category: task.category,
        construction,
        transform,
        challenge,
        question: `${task.question_template} Native prompt: ${sourceExamples[0].native_question}`,
        source_examples: sourceExamples,
        expected_answer: sourceExamples.some((source) => String(source.native_answer).toUpperCase() === 'ABSTAIN')
          ? 'ABSTAIN'
          : sourceExamples[0].native_answer,
        expected_failure: task.expected_failure,
        review_status: 'machine_seed_needs_human_adjudication',
        scoring_focus: task.scoring_focus,
      })
    }
  }

  return {
    version: '0.1.0',
    source: 'Expanded from materialized HF Dataset Viewer examples',
    item_count: pilotItems.length,
    category_counts: Object.fromEntries(
      spec.categories.map((category) => [
        category,
        pilotItems.filter((item) => item.category === category).length,
      ]),
    ),
    construction_counts: Object.fromEntries(
      ['reuse_native_labels', 'composed_corpus_suite'].map((construction) => [
        construction,
        pilotItems.filter((item) => item.construction === construction).length,
      ]),
    ),
    transform_counts: Object.fromEntries(
      ['native_row', 'adversarial_wrapper'].map((transform) => [
        transform,
        pilotItems.filter((item) => item.transform === transform).length,
      ]),
    ),
    items: pilotItems,
  }
}

function buildAdjudicationQueue(pilotSuite, rubrics) {
  const categoryRubrics = rubrics.category_rubrics || {}
  return pilotSuite.items.map((item) => {
    const rubric = categoryRubrics[item.category]
    assert(rubric, `Missing adjudication rubric for ${item.category}`)
    return {
      item_id: item.id,
      category: item.category,
      review_status: 'needs_review',
      construction: item.construction,
      transform: item.transform,
      challenge: item.challenge,
      question: item.question,
      expected_answer_candidate: item.expected_answer,
      required_dimensions: rubric.required_dimensions,
      strong_answer: rubric.strong_answer,
      near_miss: rubric.near_miss,
      hard_negative: rubric.hard_negative,
      evidence_units: item.source_examples.flatMap((source) =>
        (source.evidence_units || []).map((evidence) => ({
          id: evidence.id,
          dataset: source.source_dataset,
          title: evidence.title,
          locator: evidence.locator,
          text: evidence.text,
        })),
      ),
      reviewer_fields: {
        final_label: '',
        final_answer: '',
        required_citation_ids: [],
        insufficient_or_conflicting_evidence: false,
        notes: '',
      },
    }
  })
}

function buildAdjudicationSummary(pilotSuite, adjudicationQueue) {
  const categoryCounts = pilotSuite.category_counts
  const needsReview = adjudicationQueue.filter((item) => item.review_status === 'needs_review').length
  return {
    version: '0.1.0',
    item_count: pilotSuite.item_count,
    category_counts: categoryCounts,
    review_status_counts: {
      needs_review: needsReview,
      reviewed: 0,
    },
    gold_ready: false,
    gold_ready_blockers: [
      'All machine-seeded items require independent human adjudication.',
      'Adjudicators must confirm final answers, required citation ids, and insufficiency/conflict labels.',
      'At least one disagreement/adjudication pass is required before paper claims.',
    ],
  }
}

function buildAdjudicationBatches(adjudicationQueue) {
  const reviewerSlots = ['reviewer_a', 'reviewer_b']
  const categories = [...new Set(adjudicationQueue.map((item) => item.category))]
  const batches = categories.map((category, categoryIndex) => {
    const items = adjudicationQueue.filter((item) => item.category === category)
    return {
      batch_id: `hgr_review_batch_${String(categoryIndex + 1).padStart(2, '0')}`,
      category,
      item_count: items.length,
      reviewer_slots: reviewerSlots,
      double_review_required: true,
      adjudication_required_on_disagreement: true,
      items: items.map((item, itemIndex) => ({
        item_id: item.item_id,
        primary_reviewer_slot: reviewerSlots[itemIndex % reviewerSlots.length],
        secondary_reviewer_slot: reviewerSlots[(itemIndex + 1) % reviewerSlots.length],
        review_status: item.review_status,
        challenge_type: item.challenge?.type || 'native_row',
      })),
    }
  })

  return {
    version: '0.1.0',
    source_queue: 'generated/adjudication-queue.jsonl',
    policy: {
      target_items_per_category_for_paper: '30-50 reviewed items',
      current_items_per_category: 3,
      independent_reviews_per_item: 2,
      disagreement_resolution: 'required before gold promotion',
      publishable_gold_requires: [
        'all items validly reviewed',
        'minimal required citation ids confirmed',
        'insufficiency/conflict labels confirmed',
        'reviewer disagreement adjudicated',
      ],
    },
    total_batches: batches.length,
    total_items: adjudicationQueue.length,
    total_review_assignments: adjudicationQueue.length * reviewerSlots.length,
    batches,
  }
}

function renderAdjudicationBatches(batches) {
  const rows = batches.batches.map((batch) => [
    batch.batch_id,
    batch.category,
    String(batch.item_count),
    batch.reviewer_slots.join(', '),
    batch.double_review_required ? 'yes' : 'no',
  ])

  return `# Hard Grounded Research Review Batches

This file is generated from \`generated/adjudication-queue.jsonl\`. It is an operations manifest for human review, not gold data.

## Policy

- Target paper scale: ${batches.policy.target_items_per_category_for_paper}
- Current pilot scale: ${batches.policy.current_items_per_category} items per category
- Independent reviews per item: ${batches.policy.independent_reviews_per_item}
- Disagreement resolution: ${batches.policy.disagreement_resolution}
- Total review assignments in this pilot: ${batches.total_review_assignments}

## Batches

${markdownTable(['Batch', 'Category', 'Items', 'Reviewer slots', 'Double review'], rows)}
`
}

function buildReviewWorkbookRows(batch, slot, queueById) {
  return batch.items
    .filter((item) => item.primary_reviewer_slot === slot || item.secondary_reviewer_slot === slot)
    .map((assignment) => {
      const item = queueById.get(assignment.item_id)
      return {
        batch_id: batch.batch_id,
        reviewer_slot: slot,
        item_id: item.item_id,
        category: item.category,
        challenge_type: assignment.challenge_type,
        question: item.question,
        candidate_answer: item.expected_answer_candidate,
        required_dimensions: item.required_dimensions,
        rubric: {
          strong_answer: item.strong_answer,
          near_miss: item.near_miss,
          hard_negative: item.hard_negative,
        },
        evidence_units: item.evidence_units,
        reviewer_fields: {
          final_label: '',
          final_answer: '',
          required_citation_ids: [],
          insufficient_or_conflicting_evidence: false,
          notes: '',
          reviewer_confidence: '',
        },
      }
    })
}

function buildReviewWorkbooks(adjudicationBatches, adjudicationQueue) {
  const queueById = new Map(adjudicationQueue.map((item) => [item.item_id, item]))
  const workbooks = adjudicationBatches.batches.flatMap((batch) =>
    batch.reviewer_slots.map((slot) => {
      const filename = `${batch.batch_id}.${slot}.jsonl`
      const rows = buildReviewWorkbookRows(batch, slot, queueById)
      return {
        workbook_id: `${batch.batch_id}.${slot}`,
        batch_id: batch.batch_id,
        category: batch.category,
        reviewer_slot: slot,
        item_count: rows.length,
        path: `generated/review-workbooks/${filename}`,
        rows,
      }
    }),
  )

  return {
    version: '0.1.0',
    source_batches: 'generated/adjudication-batches.json',
    workbook_count: workbooks.length,
    total_review_rows: workbooks.reduce((sum, workbook) => sum + workbook.item_count, 0),
    merge_policy: {
      merge_target: 'generated/adjudication-queue.jsonl',
      require_two_reviews_per_item: true,
      disagreement_resolution_required: true,
      reviewer_fields_only: true,
    },
    workbooks: workbooks.map(({ rows, ...workbook }) => workbook),
  }
}

function renderReviewWorkbookIndex(index) {
  const rows = index.workbooks.map((workbook) => [
    workbook.workbook_id,
    workbook.category,
    workbook.reviewer_slot,
    String(workbook.item_count),
    workbook.path,
  ])

  return `# Hard Grounded Research Review Workbook Index

This file is generated from \`generated/adjudication-batches.json\`. Review workbooks are JSONL files intended for independent reviewer completion.

## Merge Policy

- Merge target: ${index.merge_policy.merge_target}
- Require two reviews per item: ${index.merge_policy.require_two_reviews_per_item}
- Disagreement resolution required: ${index.merge_policy.disagreement_resolution_required}
- Reviewers should edit reviewer fields only: ${index.merge_policy.reviewer_fields_only}
- Workbook count: ${index.workbook_count}
- Total review rows: ${index.total_review_rows}

## Workbooks

${markdownTable(['Workbook', 'Category', 'Reviewer slot', 'Rows', 'Path'], rows)}
`
}

function renderAdjudicationPacket(adjudicationQueue, summary) {
  const sampleLines = adjudicationQueue.slice(0, 10).map((item) => {
    const evidence = item.evidence_units.slice(0, 2).map((unit) => `    - ${unit.id}: ${compactText(unit.text, 180)}`).join('\n')
    return `### ${item.item_id}

- Category: ${item.category}
- Construction: ${item.construction}
- Transform: ${item.transform}
- Candidate answer: ${item.expected_answer_candidate}
- Required dimensions: ${item.required_dimensions.join(', ')}
- Review status: ${item.review_status}
- Evidence:
${evidence}
`
  }).join('\n')

  return `# Hard Grounded Research Adjudication Packet

This packet is generated from \`generated/pilot-suite.json\` and is not gold data. It is a reviewer work queue for turning machine-seeded items into defensible benchmark items.

## Summary

- Items: ${summary.item_count}
- Needs review: ${summary.review_status_counts.needs_review}
- Reviewed: ${summary.review_status_counts.reviewed}
- Gold ready: ${summary.gold_ready}

## Reviewer Instructions

For each item, decide whether the candidate answer is supported by the evidence under the category rubric. Fill the JSONL reviewer fields with:

- \`final_label\`: one of \`SUPPORTED\`, \`REFUTED\`, \`INSUFFICIENT\`, \`CONFLICT\`, or \`INVALID_ITEM\`.
- \`final_answer\`: the adjudicated answer, or \`ABSTAIN\` / \`CONFLICT\`.
- \`required_citation_ids\`: minimal evidence ids that directly support the final answer.
- \`insufficient_or_conflicting_evidence\`: true when the item should abstain or report conflict.
- \`notes\`: short rationale, including any item-repair needed.

## Sample Queue Items

${sampleLines}
`
}

function renderReadme(spec, matrix, approaches) {
  const datasetLines = spec.datasets
    .map((dataset) => `| ${dataset.id} | ${dataset.license} | ${dataset.covers.join('; ')} |`)
    .join('\n')
  const matrixLines = matrix
    .map((row) => `| ${row.category} | ${row.datasets.join('<br>')} | ${row.tasks.join('<br>')} |`)
    .join('\n')
  const approachLines = approaches
    .map((approach) => `| ${approach.name} | ${approach.coverage_count}/10 | ${approach.covered_categories.join('; ')} |`)
    .join('\n')

  return `# ${spec.title}

This benchmark asks: **${spec.paper_question}**

The working artifact is a seed suite for large-corpus grounded research QA. It is intentionally not another simple fact lookup benchmark: every item targets a failure where the answer may be easy to state but hard to justify with the right evidence.

## Hugging Face Grounding

| Dataset | License | Benchmark role |
| --- | --- | --- |
${datasetLines}

## Construction Approaches Tried

| Approach | Category coverage | Covered categories |
| --- | ---: | --- |
${approachLines}

The current recommendation is to ship the composed corpus suite as the paper benchmark frame, use native labels for smoke tests and baselines, and use adversarial transforms for the hard slices that native datasets do not expose directly.

## Category Matrix

| Category | HF datasets | Seed tasks |
| --- | --- | --- |
${matrixLines}

## Generated Files

- \`DECISION_LOG.md\`: one-decision-per-iteration project decision log.
- \`NOVELTY_AUDIT.md\`: current literature comparison and novelty release gate.
- \`rubrics.json\`: category-specific scoring dimensions, strong-answer criteria, near misses, and hard negatives.
- \`generated/seed-suite.json\`: runnable seed task contract.
- \`generated/coverage-matrix.json\`: category to dataset/task coverage.
- \`generated/approach-scores.json\`: comparison of construction approaches.
- \`generated/materialized-examples.json\`: concrete HF Dataset Viewer rows normalized into benchmark evidence examples.
- \`generated/pilot-suite.json\`: expanded 30-item pilot suite with native, composed, and adversarial-wrapper items, including explicit challenge payloads for hard categories.
- \`generated/adjudication-queue.jsonl\`, \`generated/adjudication-summary.json\`, and \`ADJUDICATION_PACKET.md\`: human review path from machine-seeded pilot to gold data.
- \`generated/adjudication-batches.json\` and \`ADJUDICATION_BATCHES.md\`: double-review batch manifest for scaling pilot rows into reviewed gold data.
- \`generated/review-workbooks/\` and \`REVIEW_WORKBOOKS.md\`: per-batch reviewer JSONL workbooks and merge policy.
- \`generated/review-merge-report.json\` and \`REVIEW_MERGE_REPORT.md\`: pre-merge validation report for completed reviewer workbooks.
- \`generated/gold-suite-summary.json\`: adjudication readiness report; \`generated/gold-suite.json\` is emitted only after every row has valid reviewer labels.
- \`generated/calibration-suite.json\` and \`generated/calibration-suite-summary.json\`: mechanically labeled, explicitly non-gold scorer calibration suite.
- \`generated/baseline-submission.json\` and \`generated/baseline-report.json\`: deterministic scorer smoke artifacts from \`benchmark:hard-grounded:evaluate\`.
- \`generated/baseline-comparisons.json\`: non-oracle diagnostic baseline comparison for answer-only and first-evidence systems.
- \`generated/calibration-baseline-report.json\`: gold-style evaluator smoke report from \`benchmark:hard-grounded:evaluate -- --calibration\`.
- Evaluator reports include \`conclusion_support\`, a citation-overreach diagnostic that distinguishes supporting a cited fact from supporting the submitted conclusion.
- \`scripts/hard-grounded-research-evaluate.mjs --gold\`: gold-aware scorer mode that uses adjudicated \`final_answer\` and \`required_citation_ids\` from \`generated/gold-suite.json\` once human review is complete.
- \`runs/local-rule-agent-v1/submission.json\` and \`runs/local-rule-agent-v1/report.json\`: reproducible local runner output using the same external submission contract expected from model systems.
- \`runs/lexical-evidence-baseline-v1/submission.json\` and \`runs/lexical-evidence-baseline-v1/report.json\`: non-oracle lexical evidence baseline that does not read gold answers.
- \`runs/citation-aware-verifier-v1/submission.json\` and \`runs/citation-aware-verifier-v1/report.json\`: non-oracle verifier baseline that abstains when selected citations do not support the answer.
- \`runs/openai-grounded-baseline-v1/prompt-packet.jsonl\`: dry-run prompt packet for an auditable OpenAI-compatible model baseline; scored reports are emitted only when run with \`--run\`.
- \`runs/openai-grounded-baseline-v1-calibration/prompt-packet.jsonl\`: dry-run prompt packet for the same model baseline against provisional calibration labels.
- \`BASELINE_ANALYSIS.md\` and \`generated/baseline-analysis.json\`: reproducible pilot results and failure-analysis summary across scored runs, gold readiness, and model-baseline readiness.
- \`ITEM_QUALITY_AUDIT.md\` and \`generated/item-quality-audit.json\`: pre-adjudication item repair queue for machine-seeded pilot examples.

Run:

\`\`\`bash
pnpm run benchmark:hard-grounded
pnpm run benchmark:hard-grounded:calibrate
pnpm run benchmark:hard-grounded:adjudicate
pnpm run benchmark:hard-grounded:review-merge
pnpm run benchmark:hard-grounded:evaluate
pnpm run benchmark:hard-grounded:run
pnpm run benchmark:hard-grounded:lexical
pnpm run benchmark:hard-grounded:verify-citations
pnpm run benchmark:hard-grounded:openai
pnpm run benchmark:hard-grounded:openai:calibration
pnpm run benchmark:hard-grounded:report
pnpm run benchmark:hard-grounded:audit
\`\`\`
`
}

const spec = readJson(specPath)
const rubrics = readJson(join(experimentDir, 'rubrics.json'))
validateSpec(spec)

const matrix = coverageMatrix(spec)
const approaches = scoreApproaches(spec)
const suite = buildSuite(spec)

for (const row of matrix) {
  assert(row.dataset_count > 0, `No dataset covers category: ${row.category}`)
  assert(row.task_count > 0, `No task covers category: ${row.category}`)
}

writeJson(join(outDir, 'coverage-matrix.json'), matrix)
writeJson(join(outDir, 'approach-scores.json'), approaches)
writeJson(join(outDir, 'seed-suite.json'), suite)
const materializedExamples = await materializeLiveExamples(spec)
writeJson(join(outDir, 'materialized-examples.json'), materializedExamples)
const pilotSuite = buildPilotSuite(spec, materializedExamples)
writeJson(join(outDir, 'pilot-suite.json'), pilotSuite)
const adjudicationQueue = buildAdjudicationQueue(pilotSuite, rubrics)
const adjudicationSummary = buildAdjudicationSummary(pilotSuite, adjudicationQueue)
const adjudicationBatches = buildAdjudicationBatches(adjudicationQueue)
const reviewWorkbooks = buildReviewWorkbooks(adjudicationBatches, adjudicationQueue)
writeJsonl(join(outDir, 'adjudication-queue.jsonl'), adjudicationQueue)
writeJson(join(outDir, 'adjudication-summary.json'), adjudicationSummary)
writeJson(join(outDir, 'adjudication-batches.json'), adjudicationBatches)
writeJson(join(outDir, 'review-workbooks/index.json'), reviewWorkbooks)
for (const workbook of reviewWorkbooks.workbooks) {
  const source = buildReviewWorkbookRows(
    adjudicationBatches.batches.find((batch) => batch.batch_id === workbook.batch_id),
    workbook.reviewer_slot,
    new Map(adjudicationQueue.map((item) => [item.item_id, item])),
  )
  writeJsonl(join(experimentDir, workbook.path), source)
}
writeText(join(experimentDir, 'ADJUDICATION_PACKET.md'), renderAdjudicationPacket(adjudicationQueue, adjudicationSummary))
writeText(join(experimentDir, 'ADJUDICATION_BATCHES.md'), renderAdjudicationBatches(adjudicationBatches))
writeText(join(experimentDir, 'REVIEW_WORKBOOKS.md'), renderReviewWorkbookIndex(reviewWorkbooks))
writeText(join(experimentDir, 'README.md'), renderReadme(spec, matrix, approaches))

console.log(`Validated ${spec.categories.length} categories across ${spec.datasets.length} Hugging Face datasets.`)
console.log(`Generated ${suite.length} seed tasks in ${outDir}.`)
console.log(`Materialized ${materializedExamples.task_examples.length} HF-grounded task examples.`)
console.log(`Built ${pilotSuite.item_count} pilot items across ${spec.categories.length} categories.`)
console.log(`Prepared ${adjudicationQueue.length} adjudication queue items; gold_ready=${adjudicationSummary.gold_ready}.`)
console.log(`Best approach: ${approaches[0].name} (${approaches[0].coverage_count}/${spec.categories.length} categories).`)
