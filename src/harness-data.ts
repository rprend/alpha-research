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
    id: 'dataset-alpha-book',
    name: 'Alpha Book Sample',
    sourceType: 'public_corpus',
    sourceFilename: 'project-gutenberg-sample.csv',
    sourceSizeBytes: 128_400_000,
    mode: 'public',
    description: 'Deterministic Project Gutenberg sample for harness QA.',
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
      ],
      notes: 'Harness profile for UI and agent validation.',
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
    description: 'Synthetic Census/BLS-style economic indicators for dashboard harness tests.',
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
    outputPreview: 'Dataset briefing completed with schema, provenance, and recommended queries.',
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
    status: 'failed',
    prompt: 'Find novels that reference railways before 1850.',
    outputPreview: 'Run marked failed because the remote droplet stopped heartbeating.',
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
        content: 'I created a describe run and will track artifacts in the run view.',
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
        content: 'Created summary.md and result.json in the artifact directory.',
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
    id: 'artifact-harness-result',
    runId: 'run-harness-completed',
    type: 'structured_result',
    title: 'result.json',
    content: {
      rowCount: 75000,
      recommendedQueries: ['genre over time', 'named entity frequency', 'publication date coverage'],
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
    message: 'Run marked failed because the remote droplet stopped heartbeating.',
    level: 'error',
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
        { type: 'remote_agent_summary', title: 'Remote Agent Summary' },
        { type: 'structured_result', title: 'result.json' },
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
      terminal: ['ready', 'completed', 'failed', 'cancelled', 'canceled', 'error'].includes(results.run.status),
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
      health: results.run.status === 'running' ? 'active' : results.run.status === 'failed' ? 'failed' : 'terminal',
    },
  }
}
