const now = new Date('2026-04-27T16:00:00.000Z')

function iso(minutesAgo: number) {
  return new Date(now.getTime() - minutesAgo * 60_000).toISOString()
}

export const harnessSession = {
  authenticated: true,
  configured: true,
  user: { email: 'harness@alpharesearch.local' },
  billing: {
    subscription: {
      tier: 'free' as const,
      status: 'active',
      checkoutEligible: true,
      manageEligible: false,
      cancelAtPeriodEnd: false,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    },
    usage: {
      monthlyCredits: 1_000_000,
      usedCredits: 0,
      remainingCredits: 1_000_000,
      windowStartedAt: iso(60 * 24 * 7),
      windowEndsAt: '2026-05-13T16:00:00.000Z',
    },
  },
}

export const harnessDatasets = [
  {
    id: 'housing-affordability',
    name: 'Housing Affordability',
    sourceType: 'public_data',
    sourceFilename: 'hud-fmr-acs-affordability-panel.parquet',
    sourceSizeBytes: 64_200_000,
    mode: 'public',
    description: 'Public county-level housing affordability panel combining HUD Fair Market Rents with Census/ACS income and rent-burden context.',
    inventorySummary: 'County-year housing affordability indicators for comparing rent pressure, income context, and metro outliers.',
    inventoryUseCase: 'Best for: housing affordability, rent-to-income pressure, rent burden, metro outliers, and policy briefing questions.',
    inventoryReadinessNote: 'Ready now for the canonical agent demo with a polished briefing, known-good questions, and seeded run artifacts.',
    inventoryCoverage: 'Representative four-county panel using HUD FY2024 Fair Market Rent and ACS/CHAS 2016-2020 renter burden context.',
    inventoryFreshness: 'Canonical demo fixture refreshed for the Phase 1 agent workflow.',
    inventoryLimitations: [
      'Demo fixture contains representative known-good outputs, not a full national production panel.',
      'HUD FMR is a policy benchmark and should not be interpreted as observed lease microdata.',
    ],
    inventoryTopics: ['housing', 'affordability', 'rent', 'fair market rent', 'ACS', 'public finance', 'metro outliers'],
    manifestPath: '/mnt/alpha-research/datasets/housing-affordability/manifest.json',
    deploymentStatus: 'ready',
    status: 'ready',
    volume: {
      id: 'vol-harness-housing-affordability',
      name: 'housing-affordability',
      region: 'nyc3',
      mountPath: '/mnt/alpha-research/datasets/housing-affordability',
    },
    ingestConfig: {
      parser: 'parquet',
      normalizedFormat: 'parquet',
      rowCount: 84,
    },
    profile: {
      schema: {
        columns: ['county_fips', 'state', 'county_name', 'cbsa_name', 'year', 'fmr_2br', 'renter_median_income', 'rent_to_income_ratio', 'severe_rent_burden_share', 'pressure_score'],
      },
      sampleRows: [
        { county_fips: '12086', county_name: 'Miami-Dade County', state: 'FL', year: 2024, rent_to_income_ratio: 0.49, pressure_score: 91.4 },
        { county_fips: '04013', county_name: 'Maricopa County', state: 'AZ', year: 2024, rent_to_income_ratio: 0.43, pressure_score: 86.2 },
        { county_fips: '48201', county_name: 'Harris County', state: 'TX', year: 2024, rent_to_income_ratio: 0.36, pressure_score: 72.8 },
      ],
      notes: null,
      briefingMarkdown: [
        '# Housing Affordability Dataset Briefing',
        '',
        'County-level public housing affordability panel for investigating current demo-county rental pressure using FY2024 FMR and ACS/CHAS burden context.',
        '',
        '## Sources',
        '- HUD Fair Market Rents: annual county and metro rent benchmarks by bedroom size.',
        '- Census ACS 5-year estimates: county household income, renter household counts, gross rent, and rent-burden indicators.',
        '- Census geography crosswalk: stable county FIPS, state, county, and CBSA labels used for joins.',
        '',
        '## Known-good outputs',
        '- Travis County, TX ranks first on cost-burden and severe-burden rates; Miami-Dade County, FL has the highest FY2024 two-bedroom FMR and a severe-share ratio above 57 percent.',
        '- Miami-Dade County, FL combines the highest FY2024 two-bedroom FMR in the demo with a severe-share ratio above 57 percent.',
        '- Miami-Fort Lauderdale, Phoenix-Mesa, and Tampa-St. Petersburg are the top three metro contexts.',
        '',
        '## Limitations',
        'Fair Market Rent is a policy benchmark, not observed lease microdata. ACS estimates are lagged and can carry sampling error.',
      ].join('\n'),
      profile: {
        summary: 'Public-source housing affordability demo panel with HUD FMR benchmarks, ACS income context, county-year joins, and pinned known-good outputs for agent workflow validation.',
        sources: [
          { provider: 'HUD Fair Market Rents', status: 'modeled fixture' },
          { provider: 'Census ACS 5-year estimates', status: 'modeled fixture' },
        ],
        tables: [
          { name: 'county_affordability_panel', rows: 84 },
          { name: 'metro_outliers', rows: 12 },
          { name: 'source_inventory', rows: 3 },
        ],
        formats: ['parquet', 'csv', 'json', 'markdown'],
        limitations: ['Representative fixture, not complete national coverage', 'FMR is a benchmark, not observed lease microdata'],
      },
      briefingArtifactId: 'artifact-harness-housing-briefing',
      profileArtifactId: 'artifact-harness-housing-result',
      describedRunId: 'run-harness-housing-completed',
      describedAt: iso(16),
      updatedAt: iso(12),
    },
    createdAt: iso(1500),
    updatedAt: iso(12),
  },
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
    inventoryCoverage: 'New York City leases and listings from 2018 to 2025 with neighborhood-level detail.',
    inventoryFreshness: 'Updated 14 minutes ago from the latest normalized workspace snapshot.',
    inventoryLimitations: ['Private workspace data only, so it will not reflect markets outside New York City.'],
    inventoryTopics: ['housing', 'rent', 'affordability', 'neighborhood change', 'supply'],
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
    description: 'Project Gutenberg book metadata with title, author, year, and normalized text references.',
    inventorySummary: 'Project Gutenberg works prepared for quick exploration of themes, authors, and historical language.',
    inventoryUseCase: 'Best for: literary themes, author comparisons, and historical text exploration.',
    inventoryReadinessNote: 'Ready now with source provenance, a stable schema, visible sample rows, and a current briefing.',
    inventoryCoverage: '75,000 Project Gutenberg works with title, author, publication year, and normalized text references.',
    inventoryFreshness: 'Refreshed 18 minutes ago from the current Project Gutenberg sample snapshot.',
    inventoryLimitations: ['No housing, geography, rent, or cost-of-living fields.'],
    inventoryTopics: ['books', 'literature', 'authors', 'historical text'],
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
        'Project Gutenberg metadata sample with public-domain book records and normalized text references.',
        '',
        '## Data Inventory',
        '- books.csv: 75,000 rows at one row per work.',
        '- text_path values point to normalized text files stored with the corpus.',
        '',
        '## Sources',
        '- Direct Project Gutenberg catalog extract retrieved for Alpha Research.',
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
        'The normalizer preserves source metadata and creates stable text_path values for linked text files.',
        '',
        '## Quality & Validation',
        'Row-count and required-column checks pass for this sample, and the visible schema matches the deployed dataset profile.',
        '',
        '## Limitations & Known Gaps',
        'This is a curated sample for fast exploration, not the full Gutenberg corpus or a representative census of all works.',
      ].join('\n'),
      profile: {
        summary: 'Direct Project Gutenberg sample with validated row counts, visible schema, and sample rows for quick trust checks before deeper corpus work.',
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
    inventoryCoverage: 'Public Census and BLS indicators across regions, with housing inputs still being assembled.',
    inventoryFreshness: 'Active refresh in progress from public sources within the last 10 minutes.',
    inventoryLimitations: ['Not ready yet, and housing-specific tables are not complete.'],
    inventoryTopics: ['economy', 'wages', 'labor', 'inflation', 'housing'],
    manifestPath: '/mnt/alpha-research/dataset-alpha-econ/manifest.json',
    deploymentStatus: 'processing',
    status: 'running',
    activeRunId: 'run-harness-running',
    leaseAcquiredAt: iso(12),
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
    id: 'run-harness-housing-completed',
    datasetId: 'housing-affordability',
    type: 'analysis',
    status: 'ready',
    title: 'Housing Affordability Pressure',
    description: 'The run identified where rental affordability pressure is highest in the demo counties and produced a report, work log, and structured result.',
    prompt: 'Use Alpha Research to investigate where rental affordability pressure is highest in the canonical demo counties, using the canonical housing affordability dataset. Produce a stakeholder-readable report, a structured JSON result, and a short limitations section that makes source coverage clear.',
    outputPreview: 'Travis ranks highest on burden pressure, while Miami-Dade pairs the highest FY2024 two-bedroom FMR with a high severe-burden share; limitations are explicitly tied to HUD FMR and ACS/CHAS coverage.',
    artifactCount: 5,
    sessionCount: 2,
    createdAt: iso(64),
    updatedAt: iso(16),
  },
  {
    id: 'run-harness-housing-running',
    datasetId: 'housing-affordability',
    type: 'analysis',
    status: 'running',
    title: 'Housing Affordability Live Demo',
    description: 'The remote agent is validating HUD and ACS joins before writing the final affordability-pressure report.',
    prompt: 'Investigate where rental affordability pressure is highest in the canonical demo counties.',
    outputPreview: 'Remote agent running. Join checks and source inventory are saved; final report is still in progress.',
    artifactCount: 1,
    sessionCount: 1,
    createdAt: iso(9),
    updatedAt: iso(1),
  },
  {
    id: 'run-harness-completed',
    datasetId: 'dataset-alpha-book',
    type: 'describe',
    status: 'ready',
    title: 'Alpha Book Briefing',
    description: 'The run produced a dataset briefing and structured profile for the Alpha Book sample.',
    prompt: 'Describe the Alpha Book sample and identify research-ready fields.',
    outputPreview: 'Run completed with a markdown briefing and structured dataset profile.',
    artifactCount: 4,
    sessionCount: 2,
    createdAt: iso(80),
    updatedAt: iso(22),
  },
  {
    id: 'run-harness-running',
    datasetId: 'dataset-alpha-econ',
    type: 'public_environment',
    status: 'running',
    title: 'Housing Labor Environment',
    description: 'The remote agent is building a public-data environment for housing and labor indicators.',
    prompt: 'Build a public-data environment for housing and labor indicators.',
    outputPreview: 'Remote agent running. One source inventory snapshot is already saved.',
    artifactCount: 1,
    sessionCount: 0,
    createdAt: iso(12),
    updatedAt: iso(2),
  },
  {
    id: 'run-harness-failed',
    datasetId: 'dataset-alpha-book',
    type: 'query',
    status: 'worker_unreachable',
    title: 'Railway Novel Search',
    description: 'The run searched for early railway references but stopped before reporting a terminal result.',
    prompt: 'Find novels that reference railways before 1850.',
    outputPreview: 'Worker heartbeat timed out before the run reported a terminal result.',
    artifactCount: 0,
    sessionCount: 0,
    createdAt: iso(240),
    updatedAt: iso(180),
  },
]

export const harnessSessions = [
  {
    id: 'session-harness-housing-agent',
    kind: 'cli_orchestration',
    title: 'Housing affordability agent demo',
    status: 'ready',
    datasetId: 'housing-affordability',
    runId: 'run-harness-housing-completed',
    createdAt: iso(70),
    updatedAt: iso(16),
    entries: [
      {
        id: 'entry-harness-housing-user',
        sessionId: 'session-harness-housing-agent',
        role: 'user',
        kind: 'prompt',
        title: 'User request',
        content: 'Use Alpha Research to investigate where rental affordability pressure is highest in the canonical demo counties.',
        createdAt: iso(70),
      },
      {
        id: 'entry-harness-housing-list',
        sessionId: 'session-harness-housing-agent',
        role: 'tool',
        kind: 'tool_result',
        title: 'research_list_datasets',
        content: 'Found matching datasets. Recommended: Housing Affordability (ready, public) because it contains HUD Fair Market Rent, ACS income, renter burden, county-year coverage, and a current dataset briefing.',
        createdAt: iso(69),
      },
      {
        id: 'entry-harness-housing-plan',
        sessionId: 'session-harness-housing-agent',
        role: 'assistant',
        kind: 'assistant_message',
        title: 'Remote run plan',
        content: 'I selected Housing Affordability, drafted a remote run prompt, and requested approval before spending remote worker time. Expected artifacts: report.html, work.md, result.json, and source_inventory.csv.',
        metadata: {
          datasetId: 'housing-affordability',
          plannedRunType: 'analysis',
          expectedArtifacts: 'report.html, work.md, result.json, source_inventory.csv',
        },
        createdAt: iso(68),
      },
      {
        id: 'entry-harness-housing-approved',
        sessionId: 'session-harness-housing-agent',
        role: 'user',
        kind: 'approval',
        title: 'User approved run',
        content: 'Approved the generated remote run prompt.',
        createdAt: iso(67),
      },
      {
        id: 'entry-harness-housing-summary',
        sessionId: 'session-harness-housing-agent',
        role: 'assistant',
        kind: 'final_summary',
        title: 'Artifact summary',
        content: 'The final artifacts show Travis County, TX as the highest burden-pressure county in the live run, with Miami-Dade County, FL called out for the highest FY2024 two-bedroom FMR and high severe-burden share.',
        metadata: {
          runId: 'run-harness-housing-completed',
          status: 'Ready',
        },
        createdAt: iso(16),
      },
    ],
  },
  {
    id: 'session-harness-housing-remote',
    kind: 'remote_codex',
    title: 'Housing affordability remote Codex session',
    status: 'ready',
    datasetId: 'housing-affordability',
    runId: 'run-harness-housing-completed',
    createdAt: iso(64),
    updatedAt: iso(16),
    entries: [
      {
        id: 'entry-harness-housing-command-1',
        sessionId: 'session-harness-housing-remote',
        role: 'assistant',
        kind: 'command_completed',
        title: 'Command completed',
        content: 'Command completed.\n\n```bash\npython scripts/inspect_housing_panel.py --manifest manifest.json\n```\n\nOutput: 84 county-year records, 12 counties, 7 annual snapshots, required fields present.',
        createdAt: iso(60),
      },
      {
        id: 'entry-harness-housing-command-2',
        sessionId: 'session-harness-housing-remote',
        role: 'assistant',
        kind: 'command_completed',
        title: 'Command completed',
        content: 'Command completed.\n\n```bash\npython scripts/rank_pressure.py --dataset housing-affordability\n```\n\nOutput: top burden-pressure county is Travis TX; Miami-Dade FL has the highest FY2024 two-bedroom FMR.',
        createdAt: iso(38),
      },
      {
        id: 'entry-harness-housing-remote-summary',
        sessionId: 'session-harness-housing-remote',
        role: 'assistant',
        kind: 'final_summary',
        title: 'Synthesis',
        content: 'Created `report.html`, `work.md`, `result.json`, and `source_inventory.csv`. The report leads with the ranked affordability-pressure answer and keeps source limitations attached to each claim.',
        createdAt: iso(16),
      },
    ],
  },
  {
    id: 'session-harness-housing-running',
    kind: 'remote_codex',
    title: 'Housing affordability live status',
    status: 'running',
    datasetId: 'housing-affordability',
    runId: 'run-harness-housing-running',
    createdAt: iso(9),
    updatedAt: iso(1),
    entries: [
      {
        id: 'entry-harness-housing-running-status',
        sessionId: 'session-harness-housing-running',
        role: 'assistant',
        kind: 'command_started',
        title: 'Join validation running',
        content: 'Validating HUD FMR and ACS county FIPS joins before writing the final report.',
        createdAt: iso(1),
      },
    ],
  },
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
        content: 'I created a describe run for Alpha Book Sample. The linked run contains the briefing artifacts, and the first useful next step is to open the dataset briefing before asking the next research question.',
        metadata: {
          runId: 'run-harness-completed',
          status: 'Ready',
          expectedArtifacts: 'Dataset Briefing, Dataset Profile',
        },
        createdAt: iso(88),
      },
    ],
  },
  {
    id: 'session-harness-remote',
    kind: 'remote_codex',
    title: 'Alpha Book describe terminal session',
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
        id: 'entry-harness-tool-output',
        sessionId: 'session-harness-remote',
        role: 'tool',
        kind: 'tool_result',
        title: 'list_remote_datasets',
        content: 'Found 10 remote datasets. Top matches for "alpha-book":\n\nAlpha Book Sample (ready, score 6) - name overlap\n[\n  {\n    "type": "function_call_output",\n    "call_id": "call_harness_raw_tool_output",\n    "output": "{\\"ok\\":true,\\"summary\\":\\"Found 10 remote datasets.\\"}"\n  }\n]',
        createdAt: iso(73),
      },
      {
        id: 'entry-harness-summary',
        sessionId: 'session-harness-remote',
        role: 'assistant',
        kind: 'final_summary',
        title: 'Synthesis',
        content: 'Created `report.html`, `work.md`, and `result.json` for this describe run. Open the session outputs above to inspect the durable files.',
        createdAt: iso(22),
      },
    ],
  },
]

const harnessArtifacts = [
  {
    id: 'artifact-harness-housing-live-inventory',
    runId: 'run-harness-housing-running',
    type: 'file',
    title: 'join-checks.json',
    content: {
      path: '/workspace/artifacts/join-checks.json',
      text: JSON.stringify({
        status: 'running',
        latestStep: 'Validating HUD FMR and ACS annual coverage before ranking pressure change.',
      }, null, 2),
    },
    createdAt: iso(1),
  },
  {
    id: 'artifact-harness-housing-session',
    runId: 'run-harness-housing-completed',
    type: 'remote_agent_session',
    title: 'Remote Agent Session',
    content: { sessionId: '00000000-0000-4000-8000-0000000000a1' },
    createdAt: iso(64),
  },
  {
    id: 'artifact-harness-housing-report',
    runId: 'run-harness-housing-completed',
    type: 'html_report',
    title: 'report.html',
    content: {
      path: '/workspace/artifacts/report.html',
      text: [
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Housing Affordability Pressure Report</title></head>',
        '<body style="font-family: system-ui; margin: 2rem; line-height: 1.5;">',
        '<h1>Housing Affordability Pressure</h1>',
        '<p><strong>Answer:</strong> Travis County, TX ranks highest on burden pressure in the verified production run; Miami-Dade County, FL has the highest FY2024 two-bedroom FMR and a severe-burden share above 57 percent.</p>',
        '<h2>Top Signals</h2><ul><li>Travis County, TX: highest cost-burden and severe-burden rates in the verified run.</li><li>Miami-Dade County, FL: highest FY2024 two-bedroom FMR and severe-share ratio above 57 percent.</li><li>Hillsborough County, FL and Maricopa County, AZ: ranked supporting comparison counties.</li></ul>',
        '<h2>Limitations</h2><p>HUD FMR is a benchmark rather than observed lease data. ACS estimates are lagged and can carry sampling error.</p>',
        '</body></html>',
      ].join(''),
    },
    createdAt: iso(16),
  },
  {
    id: 'artifact-harness-housing-briefing',
    runId: 'run-harness-housing-completed',
    type: 'markdown',
    title: 'work.md',
    content: {
      path: '/workspace/artifacts/work.md',
      text: [
        '# Work Log',
        '',
        '## Completed',
        '- Listed datasets and selected Housing Affordability as the public ready match.',
        '- Validated required fields and county-year coverage.',
        '- Ranked current demo-county affordability pressure from FY2024 FMR and ACS/CHAS burden indicators.',
        '- Wrote report.html, result.json, and dataset_coverage.json.',
        '',
        '## Key Result',
        'Travis County, TX ranks first on cost-burden and severe-burden rates; Miami-Dade County, FL has the highest FY2024 two-bedroom FMR and a severe-share ratio above 57 percent.',
      ].join('\n'),
    },
    createdAt: iso(16),
  },
  {
    id: 'artifact-harness-housing-result',
    runId: 'run-harness-housing-completed',
    type: 'structured_result',
    title: 'result.json',
    content: {
      path: '/workspace/artifacts/result.json',
      text: JSON.stringify({
        question: 'Where is rental affordability pressure highest in the demo counties?',
        datasetId: 'housing-affordability',
        topOutliers: [
          { rank: 1, county: 'Travis County', state: 'TX', signal: 'highest cost-burden and severe-burden rates' },
          { rank: 2, county: 'Miami-Dade County', state: 'FL', signal: 'highest FY2024 two-bedroom FMR and high severe-burden share' },
          { rank: 3, county: 'Hillsborough County', state: 'FL', signal: 'supporting high-burden comparison county' },
        ],
      }, null, 2),
    },
    createdAt: iso(16),
  },
  {
    id: 'artifact-harness-housing-source-inventory',
    runId: 'run-harness-housing-completed',
    type: 'file',
    title: 'source_inventory.csv',
    content: {
      path: '/workspace/artifacts/source_inventory.csv',
      text: [
        'source,provider,grain,years,role',
        'hud_fmr,HUD,county/metro,FY2024,rent benchmark',
        'chas_acs,Census ACS / HUD CHAS,county,2016-2020,income and burden context',
        'county_crosswalk,Census,county,2024,stable geography labels',
      ].join('\n'),
    },
    createdAt: iso(16),
  },
  {
    id: 'artifact-harness-housing-summary',
    runId: 'run-harness-housing-completed',
    type: 'remote_agent_summary',
    title: 'Remote Agent Summary',
    content: {
      text: 'Travis County, TX is the top burden-pressure county in the verified production run; Miami-Dade County, FL has the highest FY2024 two-bedroom FMR. The durable artifacts include a stakeholder report, work log, structured result, and source inventory.',
    },
    createdAt: iso(16),
  },
  {
    id: 'artifact-harness-running-inventory',
    runId: 'run-harness-running',
    type: 'file',
    title: 'Source Inventory Snapshot',
    content: {
      path: '/workspace/artifacts/source-inventory.json',
      text: JSON.stringify({
        providers: ['census', 'bls'],
        status: 'partial',
        note: 'Saved before final housing tables finish ingesting.',
      }, null, 2),
    },
    createdAt: iso(3),
  },
  {
    id: 'artifact-harness-session',
    runId: 'run-harness-completed',
    type: 'remote_agent_session',
    title: 'Remote Agent Session',
    content: { sessionId: '00000000-0000-4000-8000-000000000001' },
    createdAt: iso(78),
  },
  {
    id: 'artifact-harness-template',
    runId: 'run-harness-completed',
    type: 'html_report',
    title: 'Withdrawal Choice.html',
    content: {
      path: '/workspace/artifacts/econ_recession_experiments_v1/apps/otree_bankrun/templates/WithdrawalChoice.html',
      text: [
        "{% extends 'global/Page.html' %}",
        '{% block title %}Withdrawal Choice{% endblock %}',
        '{% block content %}',
        '{{ payoff_summary }}',
        '{{ formfields }}',
        '{% endblock %}',
      ].join('\n'),
    },
    createdAt: iso(21),
  },
  {
    id: 'artifact-harness-report',
    runId: 'run-harness-completed',
    type: 'html_report',
    title: 'report.html',
    content: {
      path: '/workspace/artifacts/report.html',
      text: [
        '<!doctype html>',
        '<html lang="en">',
        '<head><meta charset="utf-8"><title>Alpha Book Report</title></head>',
        '<body style="font-family: system-ui; margin: 2rem; line-height: 1.5;">',
        '<h1>Alpha Book Sample Report</h1>',
        '<h2>Executive Summary</h2>',
        '<p>The corpus is ready for search, literary classification, and provenance-aware sampling. The strongest immediate answer is that publication year, author, title, and genre fields are complete enough to support first-pass descriptive work.</p>',
        '<h2>Data/Methods</h2>',
        '<p>The run inspected the dataset manifest, counted the books table, reviewed required columns, and compared sample rows against the stored dataset profile. The method is descriptive validation rather than causal inference.</p>',
        '<h2>Evidence</h2>',
        '<p>The evidence is 75,000 visible records, four core columns, direct Project Gutenberg provenance, and matching manifest/profile metadata. The report treats these checks as sufficient for navigation and sampling tasks.</p>',
        '<h2>Limitations</h2>',
        '<p>The fixture does not validate OCR quality, full-text completeness, duplicate editions, or genre labels beyond the sample profile. Any publication-level inference should add deeper source validation.</p>',
        '<h2>Next Steps</h2>',
        '<p>Run row-count validation against the mounted files, sample texts by publication year, build author and genre facets, and create a coverage chart before deeper modeling.</p>',
        '</body>',
        '</html>',
      ].join(''),
    },
    createdAt: iso(22),
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
      path: '/workspace/artifacts/work.md',
      text: [
        '# Work Log',
        '',
        'The corpus is ready for search, literary classification, and provenance-aware sampling.',
        '',
        '## Commands Run',
        '- `python inspect_manifest.py`',
        '- `python validate_columns.py`',
        '',
        '## Intermediate Reasoning Summary',
        'The manifest, profile, and sample rows agree on row count, provenance, and the core fields needed for descriptive literary research.',
        '',
        '## Blockers',
        'No execution blockers remain. Full-text quality and duplicate edition checks are still outside this fixture.',
        '',
        '## Reproduction Notes',
        'Use the mounted dataset, run the manifest inspection script, compare the row count and required columns, then regenerate `report.html` and `result.json` from the observed profile.',
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
      answer: 'The Alpha Book sample is ready for first-pass descriptive research over publication year, author, title, and genre fields.',
      claims: [
        {
          claim: 'The books table exposes 75,000 records with the core research-ready fields.',
          evidenceRefs: ['manifest-row-count', 'profile-columns'],
        },
      ],
      evidence: [
        { id: 'manifest-row-count', type: 'manifest', summary: 'Manifest reports 75,000 records.' },
        { id: 'profile-columns', type: 'profile', summary: 'Profile exposes publication_year, author, title, and genre.' },
      ],
      tables: [{ id: 'books', name: 'books', rows: 75000 }],
      charts: [{ id: 'coverage', path: 'coverage.png', title: 'Coverage snapshot' }],
      confidence: 'medium',
      limitations: ['Full-text quality, duplicate editions, and label quality need deeper validation.'],
      sourceDatasetIds: ['dataset-alpha-book'],
      datasetCoverage: [
        {
          claimId: 'C1',
          datasetNeed: 'Books table row count and core metadata fields',
          matchedFiles: ['/data/manifest.json', '/data/profile.json'],
          status: 'available',
          rowCount: 75000,
          canDriveConclusion: true,
        },
      ],
      missingDatasets: [],
      provisionalWebSources: [],
      claimsAllowedToDriveConclusion: ['C1'],
      claimsNotAnswerableFromMountedData: [],
    },
    createdAt: iso(22),
  },
  {
    id: 'artifact-harness-dataset-coverage',
    runId: 'run-harness-completed',
    type: 'structured_result',
    title: 'dataset_coverage.json',
    content: {
      path: '/workspace/artifacts/dataset_coverage.json',
      requiredDatasets: [
        {
          claimId: 'C1',
          datasetNeed: 'Books table row count and core metadata fields',
          requiredFields: ['publication_year', 'author', 'title', 'genre'],
          mountedDatasetChecked: true,
          matchedFiles: ['/data/manifest.json', '/data/profile.json'],
          status: 'available',
          canDriveConclusion: true,
          acquisitionNote: 'No additional acquisition needed for the fixture profile claim.',
        },
      ],
    },
    createdAt: iso(22),
  },
  {
    id: 'artifact-harness-chart',
    runId: 'run-harness-completed',
    type: 'chart',
    title: 'coverage.png',
    content: {
      path: '/workspace/artifacts/coverage.png',
      mimeType: 'image/png',
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      sizeBytes: 68,
    },
    createdAt: iso(22),
  },
  {
    id: 'artifact-harness-pdf',
    runId: 'run-harness-completed',
    type: 'file',
    title: 'preregistration.pdf',
    content: {
      path: '/workspace/artifacts/analysis/preregistration.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      note: 'binary-too-large-for-inline-preview',
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
    id: 'event-harness-housing-1',
    runId: 'run-harness-housing-completed',
    message: 'Agent listed datasets and selected Housing Affordability as the ready public match.',
    level: 'info',
    createdAt: iso(69),
  },
  {
    id: 'event-harness-housing-2',
    runId: 'run-harness-housing-completed',
    message: 'User approved the generated remote run prompt.',
    level: 'info',
    createdAt: iso(67),
  },
  {
    id: 'event-harness-housing-3',
    runId: 'run-harness-housing-completed',
    message: 'Remote agent heartbeat: validating HUD FMR and ACS county-year joins.',
    level: 'info',
    createdAt: iso(52),
  },
  {
    id: 'event-harness-housing-4',
    runId: 'run-harness-housing-completed',
    message: 'Remote agent completed with report.html, work.md, result.json, and source_inventory.csv.',
    level: 'info',
    createdAt: iso(16),
  },
  {
    id: 'event-harness-housing-running-1',
    runId: 'run-harness-housing-running',
    message: 'Assigned warm runner alpha-research-warm-medium-3.',
    level: 'info',
    createdAt: iso(9),
  },
  {
    id: 'event-harness-housing-running-2',
    runId: 'run-harness-housing-running',
    message: 'Remote agent heartbeat: validating HUD FMR and ACS county FIPS joins.',
    level: 'info',
    createdAt: iso(1),
  },
  {
    id: 'event-harness-1',
    runId: 'run-harness-completed',
    message: 'Preparing Modal agent job.',
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
    message: 'Run marked worker_unreachable because the Modal worker stopped heartbeating before reporting a terminal result.',
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
      artifactSpec:
        runId === 'run-harness-specified'
          ? [
              { type: 'markdown', title: 'Executive Summary' },
              { type: 'csv', title: 'Cohort Comparison Table' },
              { type: 'json', title: 'Spec Preservation Record' },
            ]
          : runId.startsWith('run-harness-housing-')
            ? [
                { type: 'html_report', title: 'report.html' },
                { type: 'markdown', title: 'work.md' },
                { type: 'json', title: 'result.json' },
                { type: 'csv', title: 'source_inventory.csv' },
              ]
          : [
              { type: 'markdown', title: 'Dataset Briefing' },
              { type: 'json', title: 'Dataset Profile' },
            ],
    },
    artifacts: harnessArtifacts.filter((artifact) => artifact.runId === runId),
    events: harnessEvents.filter((event) => event.runId === runId),
    sessions: harnessSessions.filter((session) => session.runId === runId),
  }
}

function nowIso() {
  return new Date().toISOString()
}

function promptSignals(text: string) {
  return {
    hasVariables: /\bvariables?\b|\bcolumns?\b|\bfields?\b|\bcompare\b|\bsegment\b/iu.test(text),
    hasTimeWindow: /\b20\d{2}\b|\bbetween\b|\bfrom\b|\bto\b|\bwindow\b|\bq[1-4]\b|\bmonth\b|\byear\b/iu.test(text),
    hasMethod: /\bregression\b|\bdifference[- ]in[- ]differences\b|\bcohort\b|\btrend\b|\bmodel\b|\bmethod\b|\bpanel\b/iu.test(text),
    hasOutput: /\bartifacts?\b|\boutput\b|\bmemo\b|\bchart\b|\btable\b|\bcsv\b|\bsummary\b/iu.test(text),
  }
}

export function isHarnessPreparedRunPrompt(prompt: string) {
  const normalized = prompt.trim()
  if (!normalized) return false
  const hasDataset = harnessDatasets.some((dataset) => normalized.toLowerCase().includes(dataset.name.toLowerCase()))
    || /\bdataset\b:/iu.test(normalized)
  const signals = promptSignals(normalized)
  const signalCount = Object.values(signals).filter(Boolean).length
  return hasDataset && signalCount >= 3
}

export function launchHarnessPreparedRun(prompt: string) {
  const dataset =
    harnessDatasets.find((candidate) => prompt.toLowerCase().includes(candidate.name.toLowerCase()))
    ?? harnessDatasets.find((candidate) => candidate.id === 'dataset-city-housing-archive')
    ?? harnessDatasets[0]

  const runId = 'run-harness-specified'
  const sessionId = 'session-harness-specified'
  const createdAt = nowIso()
  const runIndex = harnessRuns.findIndex((candidate) => candidate.id === runId)
  const sessionIndex = harnessSessions.findIndex((candidate) => candidate.id === sessionId)

  const run = {
    id: runId,
    datasetId: dataset.id,
    type: 'analysis',
    status: 'running',
    title: 'Prepared Research Run',
    description: 'The run is preserving the approved request and preparing the first remote analysis pass.',
    prompt,
    outputPreview: 'Run accepted. Preserving the requested design and preparing the first analysis pass.',
    artifactCount: 0,
    sessionCount: 1,
    createdAt,
    updatedAt: createdAt,
  }

  const session = {
    id: sessionId,
    kind: 'cli_orchestration',
    title: 'Prepared launch request',
    status: 'running',
    datasetId: dataset.id,
    runId,
    createdAt,
    updatedAt: createdAt,
    entries: [
      {
        id: 'entry-harness-specified-user',
        sessionId,
        role: 'user',
        kind: 'prompt',
        title: 'Prepared research request',
        content: prompt,
        createdAt,
      },
      {
        id: 'entry-harness-specified-run',
        sessionId,
        role: 'assistant',
        kind: 'run_started',
        title: 'Run started',
        content: `Started run ${runId} for ${dataset.name}. The dashboard will show status, expected artifacts, and destination on the run page.`,
        metadata: {
          runId,
          status: 'Running',
          expectedArtifacts: 'Executive Summary, Cohort Comparison Table, Spec Preservation Record',
        },
        createdAt,
      },
    ],
  }

  const events = [
    {
      id: 'event-harness-specified-1',
      runId,
      message: 'Assigned warm runner alpha-research-warm-medium-2.',
      level: 'info',
      createdAt,
    },
    {
      id: 'event-harness-specified-2',
      runId,
      message: 'Remote agent heartbeat: validating requested fields against the dataset schema and preserving the launch specification.',
      level: 'info',
      createdAt,
    },
  ]

  if (runIndex >= 0) harnessRuns.splice(runIndex, 1, run)
  else harnessRuns.unshift(run)

  if (sessionIndex >= 0) harnessSessions.splice(sessionIndex, 1, session)
  else harnessSessions.unshift(session)

  for (let index = harnessEvents.length - 1; index >= 0; index -= 1) {
    if (harnessEvents[index]?.runId === runId) {
      harnessEvents.splice(index, 1)
    }
  }
  harnessEvents.push(...events)

  return { runId, sessionId, datasetId: dataset.id }
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
