type ModalEnv = {
  MODAL_AGENT_ENDPOINT_URL?: string
  MODAL_AGENT_SUBMIT_TOKEN?: string
  RESEARCH_INTERNAL_RUNNER_TOKEN?: string
  RESEARCH_AGENT_MODEL?: string
  REMOTE_AGENT_MODEL?: string
}

export type LaunchModalResearchParams = {
  datasetId: string
  runId: string
  runType: string
  prompt: string
  configJson?: string
  artifactSpecJson?: string
  remoteAgentSessionId?: string
  callbackOrigin: string
  datasetMountPath: string
  manifestPath: string
  datasetReadOnly?: boolean
  extraContext?: Record<string, unknown>
}

export type ModalLaunchResult = {
  id: string
  name: string
  provider: 'modal'
  resultPath: string
  callId?: string
}

function requireModalEndpoint(env: ModalEnv) {
  const endpoint = env.MODAL_AGENT_ENDPOINT_URL?.trim()
  if (!endpoint) {
    throw new Error('Missing MODAL_AGENT_ENDPOINT_URL')
  }
  return endpoint
}

function parseJsonObject(value: string | undefined) {
  if (!value) {
    return {}
  }
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function parseJsonArray(value: string | undefined) {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function launchModalResearchJob(
  env: ModalEnv,
  params: LaunchModalResearchParams,
): Promise<ModalLaunchResult> {
  const endpoint = requireModalEndpoint(env)
  const callbackOrigin = params.callbackOrigin.replace(/\/+$/u, '')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.MODAL_AGENT_SUBMIT_TOKEN
        ? { Authorization: `Bearer ${env.MODAL_AGENT_SUBMIT_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      jobId: params.runId,
      prompt: params.prompt,
      extraContext: {
        runId: params.runId,
        runType: params.runType,
        datasetId: params.datasetId,
        manifestPath: params.manifestPath || '/data/manifest.json',
        datasetMountPath: params.datasetMountPath || '/data',
        datasetReadOnly: params.datasetReadOnly ?? true,
        remoteAgentSessionId: params.remoteAgentSessionId ?? '',
        remoteAgentModel: env.REMOTE_AGENT_MODEL ?? env.RESEARCH_AGENT_MODEL ?? 'gpt-5-codex',
        runnerToken: env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? '',
        callbackEventsUrl: `${callbackOrigin}/api/internal/runs/${params.runId}/events`,
        callbackStatusUrl: `${callbackOrigin}/api/internal/runs/${params.runId}/status`,
        callbackArtifactsUrl: `${callbackOrigin}/api/internal/runs/${params.runId}/artifacts`,
        callbackSessionEntriesUrl: `${callbackOrigin}/api/internal/runs/${params.runId}/session-entries`,
        openAIProxyBaseUrl: `${callbackOrigin}/api/internal/runs/${params.runId}/openai`,
        config: parseJsonObject(params.configJson),
        artifacts: parseJsonArray(params.artifactSpecJson),
        ...(params.extraContext ?? {}),
      },
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Modal agent job submit failed (${response.status})${detail ? ` ${detail}` : ''}`)
  }
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  const callId = typeof payload.callId === 'string' ? payload.callId : undefined
  const resultPath = typeof payload.resultPath === 'string' ? payload.resultPath : `/results/${params.runId}`
  return {
    id: callId ?? params.runId,
    name: `modal-${params.runId}`,
    provider: 'modal',
    resultPath,
    callId,
  }
}
