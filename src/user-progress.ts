export type UserProgressKind = 'activity' | 'heartbeat' | 'status'

export type UserProgressCandidate = {
  text: string
  kind: UserProgressKind
  phase?: string | null
  meaningful?: boolean
}

export type RunEventLike = {
  id: string
  message: string
  level: string
  createdAt: string
}

type ProgressEventInput = {
  event: string
  data: Record<string, unknown>
  lastMeaningfulText?: string | null
}

type DerivedRunProgress = UserProgressCandidate & {
  id: string
  createdAt: string
  rawMessage: string
  level: string
}

function safeRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function truncateText(value: string, maxChars = 160) {
  const normalized = value.replace(/\s+/gu, ' ').trim()
  if (normalized.length <= maxChars) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

function stripSurroundingQuotes(value: string) {
  return value.replace(/^['"]+|['"]+$/gu, '').trim()
}

function extractQuotedTerms(command: string) {
  const matches = [...command.matchAll(/'([^']{2,120})'|"([^"]{2,120})"/gu)]
  const rawTerms = matches.flatMap((match) => [match[1], match[2]].filter((value): value is string => Boolean(value)))
  const terms = rawTerms
    .flatMap((term) => term.split('|'))
    .map((term) => stripSurroundingQuotes(term.replace(/\\x27/giu, "'").replace(/\\n/gu, ' ')))
    .filter((term) =>
      term.length > 1
      && !term.startsWith('/bin/')
      && !term.includes("<<'PY'")
      && !/[\\/]/u.test(term)
      && !/^(?:head|sed|rg|python3?|bash|sh|py|json|utf-8|in_progress|completed)$/iu.test(term),
    )
  return [...new Set(terms)].slice(0, 6)
}

function extractFlagValue(command: string, flag: string) {
  const escaped = flag.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const match = command.match(new RegExp(`${escaped}\\s+(?:'([^']+)'|"([^"]+)"|(\\S+))`, 'u'))
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim() || null
}

function formatSearchTerms(rawPattern: string | null) {
  if (!rawPattern) {
    return null
  }
  const cleaned = rawPattern
    .replace(/\\[bBsSdDwW]/gu, ' ')
    .replace(/[()[\]^$+*?]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  const terms = cleaned
    .split('|')
    .map((part) => stripSurroundingQuotes(part))
    .map((part) => part.replace(/\s+/gu, ' ').trim())
    .filter((part) => part.length > 1)
    .filter((part) => !/[\\/]/u.test(part))
    .slice(0, 6)
  return terms.length > 0 ? terms.join('; ') : null
}

function commandLooksLikeJsonFragment(line: string) {
  return /^[\[\]{}],?$/u.test(line)
    || /^"(?:path|bytes|updated_at|started_at|finished_at|name|run_id|timestamp|wrapper_run_dir|inner_run_dir|status)"\s*:/u.test(line)
}

function stripLogTimestampPrefix(value: string) {
  return value
    .replace(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\]\s*/u, '')
    .replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+/u, '')
    .trim()
}

function normalizeProgressLine(value: string) {
  return stripLogTimestampPrefix(value.replace(/\s+/gu, ' ').trim())
}

function genericProgressNoise(text: string) {
  const normalized = normalizeProgressLine(text).toLowerCase()
  if (!normalized) {
    return true
  }
  return (
    /^(?:no user-meaningful activity (?:captured|recorded))\.?$/u.test(normalized)
    || /^(?:launching the analysis workspace|working through launching|started a workspace task|workspace task started|task run initialized|task status: running|task is running|workspace task heartbeat(?:: .*?)?|task heartbeat received(?:: .*?)?|still working: pid=\d+ status=alive|pid=\d+ status=alive)\.?$/u.test(normalized)
    || /^(?:preparing|prepared)\s+(?:the\s+)?(?:terminal|skills list|list of skills|code execution(?: environment| step)?|run environment|prompt input file|working directory|output folder structure|analysis workspace)\.?$/u.test(normalized)
    || /^(?:a|an)\s+(?:log file|process log file|inner run directory record|manifest file|session snapshot)\s+(?:was referenced|was created|was prepared|was generated).?$/u.test(normalized)
    || /^(?:generated|created)\s+(?:status\.json|run\.log|manifest\.json|scoped-files\.tsv|the output folder structure).?$/u.test(normalized)
    || /^(?:requested|sent|prepared)\s+.*\bopenai proxy\b.*$/u.test(normalized)
    || /^(?:used|selected|prepared).*\bgpt-[\w.:-]+\b.*$/u.test(normalized)
    || /^(?:openai request logging was enabled|used the openai proxy service|a new session was created and a session snapshot was prepared)\.?$/u.test(normalized)
  )
}

function humanizeAgentText(text: string) {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  if (!normalized) {
    return null
  }
  const firstSentence = normalized.split(/(?<=[.!?])\s+/u)[0] ?? normalized
  const cleaned = firstSentence
    .replace(/^I(?:'m| am)\s+/iu, '')
    .replace(/^Next,\s*I(?:'m| am)\s+/iu, '')
    .replace(/^Next I(?:'m| am)\s+/iu, '')
    .replace(/^I have\s+/iu, 'Found ')
    .replace(/^I’ve\s+/iu, '')
    .replace(/^I've\s+/iu, '')
    .replace(/^The workspace is\s+/iu, 'Workspace is ')
    .trim()
  if (!cleaned) {
    return null
  }
  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  return truncateText(capitalized.endsWith('.') ? capitalized : `${capitalized}.`)
}

function summarizeCommand(command: string) {
  const normalized = command.replace(/\s+/gu, ' ').trim()
  const quotedTerms = extractQuotedTerms(normalized)
  const explicitPattern = formatSearchTerms(extractFlagValue(normalized, '--pattern'))

  if (/\brg\b/u.test(normalized)) {
    const rgTerms = explicitPattern ?? (quotedTerms.length > 0 ? quotedTerms.join('; ') : null)
    if (rgTerms) {
      return truncateText(`Searching for: ${rgTerms}`)
    }
    return 'Searching the dataset.'
  }
  if (/\b(?:sed|head|cat)\b/u.test(normalized)) {
    if (normalized.includes('manifest.json')) {
      return 'Reviewing the dataset manifest.'
    }
    return 'Reading sampled dataset content.'
  }
  if (/\bpython(?:3)?\b/u.test(normalized)) {
    if (/<<['"]?PY['"]?/iu.test(normalized) || normalized.includes('.jsonl.gz')) {
      return 'Running a scripted analysis step across the dataset.'
    }
    return null
  }
  if (/\bls\b/u.test(normalized) || normalized.includes('find ')) {
    return 'Inspecting available dataset files.'
  }
  return null
}

function summarizePrettyCliLine(text: string) {
  const normalized = text.trim()
  if (!normalized.startsWith('┊')) {
    return null
  }
  const shell = normalized.match(/^┊\s+[\p{Emoji}\u{1F300}-\u{1FAFF}]?\s*\$\s+(.+)$/u)
  if (shell?.[1]) {
    return summarizeCommand(shell[1])
  }
  return null
}

function summarizeHeartbeat(lastMeaningfulText?: string | null) {
  if (lastMeaningfulText && lastMeaningfulText.trim().length > 0) {
    const trimmed = lastMeaningfulText.replace(/[.]+$/u, '').trim()
    return truncateText(`Still working: ${trimmed}.`)
  }
  return 'Still working on the current analysis step.'
}

function parseJsonLine(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

function summarizePartialCodexJson(text: string) {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  const commandMatch = normalized.match(/"type":"command_execution","command":"(.+?)(?<!\\)"/u)
  if (commandMatch?.[1]) {
    const command = commandMatch[1].replace(/\\"/gu, '"').replace(/\\n/gu, ' ')
    const candidate = summarizeCommand(command)
    if (candidate) {
      return candidate
    }
  }
  return null
}

function summarizeLogLine(
  text: string,
  data: Record<string, unknown>,
  lastMeaningfulText?: string | null,
): UserProgressCandidate | null {
  const trimmed = normalizeProgressLine(text)
  if (!trimmed || genericProgressNoise(trimmed) || commandLooksLikeJsonFragment(trimmed)) {
    return null
  }
  if (trimmed.length > 320 || /^##\s+/u.test(trimmed)) {
    return null
  }
  if (/pid=\d+\s+alive$/iu.test(trimmed)) {
    return {
      text: summarizeHeartbeat(lastMeaningfulText),
      kind: 'heartbeat',
      meaningful: false,
    }
  }

  const prettyCliLine = summarizePrettyCliLine(trimmed)
  if (prettyCliLine) {
    return {
      text: prettyCliLine,
      kind: 'activity',
      meaningful: true,
    }
  }

  const partialJson = summarizePartialCodexJson(trimmed)
  if (partialJson) {
    return {
      text: partialJson,
      kind: 'activity',
      meaningful: true,
    }
  }

  const parsed = parseJsonLine(trimmed)
  if (parsed) {
    if (parsed.type === 'thread.started' || parsed.type === 'turn.started') {
      return null
    }
    const item = safeRecord(parsed.item)
    const itemType = typeof item?.type === 'string' ? item.type : ''
    if (itemType === 'agent_message' && typeof item?.text === 'string') {
      const humanized = humanizeAgentText(item.text)
      return humanized
        ? { text: humanized, kind: 'activity', meaningful: true }
        : null
    }
    if (itemType === 'command_execution' && typeof item?.command === 'string') {
      const summary = summarizeCommand(item.command)
      if (!summary) {
        return null
      }
      return {
        text: summary,
        kind: 'activity',
        meaningful: true,
      }
    }
    if (parsed.type === 'item.updated' && itemType === 'todo_list') {
      return {
        text: 'Updating the analysis plan.',
        kind: 'activity',
        meaningful: true,
      }
    }
    return null
  }

  if (data.level === 'error') {
    return {
      text: truncateText(trimmed),
      kind: 'status',
      meaningful: true,
    }
  }

  return null
}

export function deriveUserProgressCandidate(input: ProgressEventInput): UserProgressCandidate | null {
  const { event, data, lastMeaningfulText } = input
  if ((event === 'job.log' || event === 'tool.progress') && typeof data.text === 'string') {
    return summarizeLogLine(data.text, data, lastMeaningfulText)
  }
  if (event === 'assistant.completed') {
    return {
      text: 'Answer ready.',
      kind: 'status',
      meaningful: true,
    }
  }
  if (event === 'run.completed') {
    const status = typeof data.status === 'string' ? data.status : 'completed'
    if (status === 'completed' || status === 'ready') {
      return {
        text: 'Run completed.',
        kind: 'status',
        meaningful: true,
      }
    }
    const error = typeof data.error === 'string' && data.error.trim().length > 0
      ? truncateText(data.error)
      : 'Run failed.'
    return {
      text: error,
      kind: 'status',
      meaningful: true,
    }
  }
  return null
}

export function deriveRunProgress(events: RunEventLike[]) {
  const derived: DerivedRunProgress[] = []
  let lastMeaningfulText: string | null = null
  for (const event of events) {
    const candidate = deriveUserProgressCandidate({
      event: 'job.log',
      data: {
        text: event.message,
        level: event.level,
      },
      lastMeaningfulText,
    })
    if (!candidate) {
      continue
    }
    if (candidate.meaningful !== false) {
      lastMeaningfulText = candidate.text
    }
    derived.push({
      ...candidate,
      id: event.id,
      createdAt: event.createdAt,
      rawMessage: event.message,
      level: event.level,
    })
  }
  return derived
}
