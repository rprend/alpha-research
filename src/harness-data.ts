const now = new Date('2026-04-27T16:00:00.000Z')

function iso(minutesAgo: number) {
  return new Date(now.getTime() - minutesAgo * 60_000).toISOString()
}

export const harnessSession = {
  authenticated: true,
  configured: true,
  user: { email: 'harness@alpharesearch.local' },
}

export const harnessDatasets = [
  {
    id: 'dataset-city-housing-archive',
    name: 'City Housing Archive',
    sourceType: 'uploaded_files',
    sourceFilename: 'housing-leases-and-listings.parquet',
    sourceSizeBytes: 86_400_000,
    mode: 'private',
    description: 'Private lease records and listing history covering rents, unit traits, and neighborhood changes.',
    inventorySummary: 'Lease and listing records for tracking rent levels, vacancies, and neighborhood change over time.',
    inventoryUseCase: 'Best for: housing affordability, rent growth, and neighborhood-level supply questions.',
    inventoryReadinessNote: 'Ready now for private research inside your workspace.',
    manifestPath: '/mnt/alpha-research/dataset-city-housing-archive/manifest.json',
    deploymentStatus: 'ready',
    status: 'ready',
    volume: {
      id: 'vol-harness-city-housing',
      name: 'city-housing-archive',
      region: 'nyc3',
      mountPath: '/mnt/alpha-research/dataset-city-housing-archive',
    },
    ingestConfig: {
      parser: 'parquet',
      normalizedFormat: 'parquet',
      rowCount: 128000,
    },
    profile: {
      profile: {
        summary: 'Private housing records with monthly rent, unit features, and neighborhood identifiers.',
      },
      updatedAt: iso(14),
    },
    createdAt: iso(1440),
    updatedAt: iso(14),
  },
  {
    id: 'dataset-alpha-book',
    name: 'Alpha Book Sample',
    sourceType: 'public_corpus',
    sourceFilename: 'project-gutenberg-sample.csv',
    sourceSizeBytes: 128_400_000,
    mode: 'public',
    description: 'A curated sample of public-domain books with title, author, year, and text references.',
    inventorySummary: 'Public-domain books prepared for quick experiments on themes, authors, and historical language.',
    inventoryUseCase: 'Best for: literary themes, author comparisons, and historical text exploration.',
    inventoryReadinessNote: 'Ready now with a stable schema, visible sample rows, and a current briefing.',
    manifestPath: '/mnt/alpha-research/dataset-alpha-book/manifest.json',
    deploymentStatus: 'ready',
    status: 'ready',
    volume: {
      id: 'vol-harness-alpha-book',
      name: 'alpha-book-harness',
      region: 'nyc3',
      mountPath: '/mnt/alpha-research/dataset-alpha-book',
    },
    ingestConfig: {
      parser: 'csv',
      normalizedFormat: 'parquet',
      rowCount: 75000,
    },
    profile: {
      schema: {
        columns: ['title', 'author', 'year', 'text_path'],
      },
      sampleRows: [
        { title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813 },
        { title: 'Narrative of the Life of Frederick Douglass', author: 'Frederick Douglass', year: 1845 },
        { title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman', year: 1892 },
      ],
      notes: null,
      briefingMarkdown: [
        '# Dataset Briefing',
        '',
        '## Overview',
        'A curated Project Gutenberg sample with public-domain book metadata and normalized text references.',
        '',
        '## Data Inventory',
        '- books.csv: 75,000 rows at one row per work.',
        '- text_path values point to normalized text files stored with the corpus.',
        '',
        '## Sources',
        '- Project Gutenberg public-domain catalog sample retrieved for Alpha Research.',
        '',
        '## Schemas',
        '- title: string',
        '- author: string',
        '- year: integer',
        '- text_path: string',
        '',
        '## Time Coverage',
        'Publication years in the sample span historical literature records across the included works.',
        '',
        '## Geography Coverage',
        'No geographic grain is modeled in this sample.',
        '',
        '## Formats',
        'CSV metadata with normalized text file references.',
        '',
        '## Transformations & Derived Fields',
        'The normalizer preserves source metadata and creates stable text paths.',
        '',
        '## Quality & Validation',
        'Row-count and required-column checks pass for this sample.',
        '',
        '## Limitations & Known Gaps',
        'This is a deterministic sample, not the full Gutenberg corpus.',
      ].join('\n'),
      profile: {
        summary: 'Public-domain book metadata and text references for fast literary exploration before deeper corpus work.',
        sources: [{ provider: 'Project Gutenberg', status: 'direct' }],
        tables: [{ name: 'books', rows: 75000 }],
        formats: ['csv', 'txt'],
        limitations: ['Sample only, not the full Gutenberg corpus'],
      },
      briefingArtifactId: 'artifact-harness-briefing',
      profileArtifactId: 'artifact-harness-profile',
      describedRunId: 'run-harness-completed',
      describedAt: iso(22),
      updatedAt: iso(18),
    },
    createdAt: iso(1200),
    updatedAt: iso(18),
  },
  {
    id: 'dataset-alpha-econ',
    name: 'Alpha Econ Prototype',
    sourceType: 'public_api',
    sourceFilename: null,
    sourceSizeBytes: 42_000_000,
    mode: 'public',
    description: 'Economic indicators combining labor, income, and population trends from public sources.',
    inventorySummary: 'Public economic indicators being assembled for questions about jobs, wages, inflation, and regional change.',
    inventoryUseCase: 'Best for: labor market shifts, local economic conditions, and trend comparisons.',
    inventoryReadinessNote: 'Still ingesting public source tables and normalizing the final schema.',
    manifestPath: '/mnt/alpha-research/dataset-alpha-econ/manifest.json',
    deploymentStatus: 'processing',
    status: 'running',
    volume: null,
    ingestConfig: {
      publicSources: ['census', 'bls'],
    },
    profile: null,
    createdAt: iso(860),
    updatedAt: iso(6),
  },
]

export const harnessRuns = [
  {
    id: 'run-harness-completed',
    datasetId: 'dataset-alpha-book',
    type: 'describe',
    status: 'ready',
    prompt: 'Describe the Alpha Book sample and identify research-ready fields.',
    outputPreview: 'Dataset briefing ready with a markdown briefing and structured dataset profile.',
    createdAt: iso(80),
    updatedAt: iso(22),
  },
  {
    id: 'run-harness-running',
    datasetId: 'dataset-alpha-econ',
    type: 'public_environment',
    status: 'running',
    prompt: 'Build a public-data environment for housing and labor indicators.',
    outputPreview: 'Remote agent running. Last activity 90s ago.',
    createdAt: iso(12),
    updatedAt: iso(2),
  },
  {
    id: 'run-harness-failed',
    datasetId: 'dataset-alpha-book',
    type: 'query',
    status: 'worker_unreachable',
    prompt: 'Find novels that reference railways before 1850.',
    outputPreview: 'Worker heartbeat timed out before the run reported a terminal result.',
    createdAt: iso(240),
    updatedAt: iso(180),
  },
]

export const harnessSessions = [
  {
    id: 'session-harness-cli',
    kind: 'cli_orchestration',
    title: 'Alpha Book research planning',
    status: 'ready',
    datasetId: 'dataset-alpha-book',
    runId: 'run-harness-completed',
    createdAt: iso(90),
    updatedAt: iso(22),
    entries: [
      {
        id: 'entry-harness-user',
        sessionId: 'session-harness-cli',
        role: 'user',
        kind: 'prompt',
        title: 'User request',
        content: 'Describe this corpus and suggest first research questions.',
        createdAt: iso(90),
      },
      {
        id: 'entry-harness-assistant',
        sessionId: 'session-harness-cli',
        role: 'assistant',
        kind: 'assistant_message',
        title: 'Assistant response',
        content: 'I created a describe run. The run view will show progress, transcript updates, and the generated briefing artifacts.',
        createdAt: iso(88),
      },
    ],
  },
  {
    id: 'session-harness-remote',
    kind: 'remote_codex',
    title: 'Remote Codex session',
    status: 'ready',
    datasetId: 'dataset-alpha-book',
    runId: 'run-harness-completed',
    createdAt: iso(78),
    updatedAt: iso(22),
    entries: [
      {
        id: 'entry-harness-command',
        sessionId: 'session-harness-remote',
        role: 'assistant',
        kind: 'command_completed',
        title: 'Command completed',
        content: 'Command completed.\n\n```bash\npython inspect_manifest.py\n```\n\nOutput: 75,000 records, 4 core columns.',
        createdAt: iso(74),
      },
      {
        id: 'entry-harness-summary',
        sessionId: 'session-harness-remote',
        role: 'assistant',
        kind: 'final_summary',
        title: 'Synthesis',
        content: 'Created the Dataset Briefing markdown and Dataset Profile JSON artifacts.',
        createdAt: iso(22),
      },
    ],
  },
]

const harnessArtifacts = [
  {
    id: 'artifact-harness-session',
    runId: 'run-harness-completed',
    type: 'remote_agent_session',
    title: 'Remote Agent Session',
    content: { sessionId: '00000000-0000-4000-8000-000000000001' },
    createdAt: iso(78),
  },
  {
    id: 'artifact-harness-summary',
    runId: 'run-harness-completed',
    type: 'remote_agent_summary',
    title: 'Remote Agent Summary',
    content: {
      text: 'The corpus is ready for search, literary classification, and provenance-aware sampling.',
    },
    createdAt: iso(22),
  },
  {
    id: 'artifact-harness-briefing',
    runId: 'run-harness-completed',
    type: 'file',
    title: 'Dataset Briefing',
    content: {
      path: '/workspace/artifacts/summary.md',
      text: [
        '# Dataset Briefing',
        '',
        'The corpus is ready for search, literary classification, and provenance-aware sampling.',
        '',
        '## Suggested first passes',
        '- Validate row counts against the manifest.',
        '- Sample texts by publication year.',
        '- Build author and genre facets before deeper modeling.',
      ].join('\n'),
    },
    createdAt: iso(22),
  },
  {
    id: 'artifact-harness-result',
    runId: 'run-harness-completed',
    type: 'structured_result',
    title: 'Dataset Profile',
    content: {
      path: '/workspace/artifacts/result.json',
      rowCount: 75000,
      sources: [{ provider: 'Project Gutenberg', status: 'direct' }],
      tables: [{ name: 'books', rows: 75000 }],
    },
    createdAt: iso(22),
  },
  {
    id: 'artifact-harness-script',
    runId: 'run-harness-completed',
    type: 'script',
    title: 'scripts/inspect_manifest.py',
    content: {
      path: '/workspace/artifacts/scripts/inspect_manifest.py',
      text: 'import json\nfrom pathlib import Path\n\nmanifest = json.loads(Path("manifest.json").read_text())\nprint(manifest.get("rowCount"))\n',
    },
    createdAt: iso(22),
  },
]

const harnessEvents = [
  {
    id: 'event-harness-1',
    runId: 'run-harness-completed',
    message: 'Preparing remote agent droplet launch.',
    level: 'info',
    createdAt: iso(79),
  },
  {
    id: 'event-harness-2',
    runId: 'run-harness-completed',
    message: 'Remote agent session 00000000-0000-4000-8000-000000000001 started.',
    level: 'info',
    createdAt: iso(78),
  },
  {
    id: 'event-harness-3',
    runId: 'run-harness-completed',
    message: 'Remote agent run completed with 3 artifact(s).',
    level: 'info',
    createdAt: iso(22),
  },
  {
    id: 'event-harness-running-1',
    runId: 'run-harness-running',
    message: 'Assigned warm runner alpha-research-warm-medium-1.',
    level: 'info',
    createdAt: iso(11),
  },
  {
    id: 'event-harness-running-2',
    runId: 'run-harness-running',
    message: 'Remote agent heartbeat: fetching public data sources.',
    level: 'info',
    createdAt: iso(2),
  },
  {
    id: 'event-harness-failed-1',
    runId: 'run-harness-failed',
    message: 'Run marked worker_unreachable because the remote droplet stopped heartbeating before reporting a terminal result.',
    level: 'warning',
    createdAt: iso(180),
  },
]

export function isHarnessMode() {
  if (import.meta.env.VITE_ALPHA_RESEARCH_HARNESS === '1') {
    return true
  }
  return new URL(window.location.href).searchParams.get('harness') === '1'
}

export function getHarnessDataset(datasetId: string) {
  return harnessDatasets.find((dataset) => dataset.id === datasetId) ?? null
}

export function getHarnessSession(sessionId: string) {
  return harnessSessions.find((session) => session.id === sessionId) ?? null
}

export function getHarnessRunResults(runId: string) {
  const run = harnessRuns.find((candidate) => candidate.id === runId)
  if (!run) {
    throw new Error(`Harness run not found: ${runId}`)
  }
  return {
    run,
    metadata: {
      config: { harness: true },
      artifactSpec: [
        { type: 'markdown', title: 'Dataset Briefing' },
        { type: 'json', title: 'Dataset Profile' },
      ],
    },
    artifacts: harnessArtifacts.filter((artifact) => artifact.runId === runId),
    events: harnessEvents.filter((event) => event.runId === runId),
    sessions: harnessSessions.filter((session) => session.runId === runId),
  }
}

export function getHarnessDebugView(runId: string) {
  const results = getHarnessRunResults(runId)
  const lastEvent = results.events.at(-1) ?? null
  const remoteSessionArtifact = results.artifacts.find((artifact) => artifact.type === 'remote_agent_session')
  const remoteSessionId =
    remoteSessionArtifact && typeof remoteSessionArtifact.content?.sessionId === 'string'
      ? remoteSessionArtifact.content.sessionId
      : null
  return {
    run: results.run,
    debugView: {
      remoteSessionId,
      hasRemoteLogs: results.sessions.some((session) => session.kind === 'remote_codex'),
      defaultView: 'remote',
      terminal: ['ready', 'completed', 'failed', 'cancelled', 'canceled', 'error', 'worker_unreachable'].includes(results.run.status),
      eventCount: results.events.length,
      lastEvent,
      requestedArtifacts: results.metadata.artifactSpec,
      producedArtifacts: results.artifacts.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        type: artifact.type,
      })),
      sessionKinds: results.sessions.map((session) => ({
        id: session.id,
        kind: session.kind,
        status: session.status,
        entryCount: session.entries?.length ?? 0,
      })),
      health: results.run.status === 'running' ? 'active' : results.run.status,
    },
  }
}
