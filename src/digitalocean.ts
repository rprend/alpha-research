type DigitalOceanEnv = {
  DIGITALOCEAN_API_TOKEN?: string
  DIGITALOCEAN_REGION?: string
  DIGITALOCEAN_VOLUME_SIZE_GIB?: string
  DIGITALOCEAN_VOLUME_MOUNT_ROOT?: string
  DIGITALOCEAN_INGEST_DROPLET_SIZE?: string
  DIGITALOCEAN_INGEST_IMAGE?: string
  DIGITALOCEAN_RESEARCH_RUNNER_IMAGE?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_SMALL?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_MEDIUM?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_LARGE?: string
  DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_SMALL?: string
  DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_MEDIUM?: string
  DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_LARGE?: string
  RESEARCH_CONTROL_ORIGIN?: string
  DIGITALOCEAN_SSH_KEY_IDS?: string
  DIGITALOCEAN_PROJECT_ID?: string
  RESEARCH_INTERNAL_RUNNER_TOKEN?: string
  RESEARCH_DATASET_REPO_REF?: string
  OPENAI_API_KEY?: string
  RESEARCH_AGENT_MODEL?: string
  REMOTE_AGENT_MODEL?: string
  REMOTE_AGENT_EXECUTOR?: string
}

type EnsureVolumeResult = {
  id: string
  name: string
  region: string
  mountRoot: string
  datasetMountPath: string
  sizeGigabytes: number | null
}

type LaunchIngestParams = {
  datasetId: string
  instanceId: string
  runId: string
  volumeName: string
  volumeId: string
  sourceDownloadUrl: string
  sourceFilename: string
  outputRoot: string
  productName: string
  mode: string
  ingestArgs: string[]
  callbackOrigin: string
}

type LaunchResearchParams = {
  datasetId: string
  runId: string
  runType: string
  prompt: string
  configJson?: string
  artifactSpecJson?: string
  remoteAgentSessionId?: string
  volumeName: string
  volumeId: string
  callbackOrigin: string
  datasetMountPath: string
  manifestPath: string
  sourceSizeBytes?: number | null
}

type ResearchRunResources = {
  profile?: string
  runnerSize?: string
  workspaceDiskGb?: number
}

function requireDigitalOceanToken(env: DigitalOceanEnv) {
  if (!env.DIGITALOCEAN_API_TOKEN) {
    throw new Error('Missing DIGITALOCEAN_API_TOKEN')
  }
  return env.DIGITALOCEAN_API_TOKEN
}

function sanitizeName(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'dataset'
}

async function doRequest<T>(env: DigitalOceanEnv, path: string, init: RequestInit = {}) {
  const token = requireDigitalOceanToken(env)
  const response = await fetch(`https://api.digitalocean.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`DigitalOcean API request failed (${response.status}) ${path}${detail ? ` ${detail}` : ''}`)
  }
  return response.json() as Promise<T>
}

async function doRequestNoContent(env: DigitalOceanEnv, path: string, init: RequestInit = {}) {
  const token = requireDigitalOceanToken(env)
  const response = await fetch(`https://api.digitalocean.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`DigitalOcean API request failed (${response.status}) ${path}${detail ? ` ${detail}` : ''}`)
  }
}

export async function deleteDroplet(env: DigitalOceanEnv, dropletId: string) {
  const token = requireDigitalOceanToken(env)
  const response = await fetch(`https://api.digitalocean.com/v2/droplets/${encodeURIComponent(dropletId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (response.status === 404) {
    return
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`DigitalOcean droplet delete failed (${response.status}) ${dropletId}${detail ? ` ${detail}` : ''}`)
  }
}

export async function ensureDatasetVolume(env: DigitalOceanEnv, datasetId: string): Promise<EnsureVolumeResult> {
  const region = env.DIGITALOCEAN_REGION ?? 'nyc3'
  const name = `ar-dataset-${sanitizeName(datasetId)}`
  const mountRoot = env.DIGITALOCEAN_VOLUME_MOUNT_ROOT ?? '/mnt/alpha-research'
  const requestedSize = Number(env.DIGITALOCEAN_VOLUME_SIZE_GIB ?? '10')
  const list = await doRequest<{ volumes?: Array<{ id: string; name: string; size_gigabytes?: number }> }>(
    env,
    `/volumes?name=${encodeURIComponent(name)}&region=${encodeURIComponent(region)}`,
  )
  const existing = list.volumes?.[0]
  if (existing) {
    const existingSize = typeof existing.size_gigabytes === 'number' ? existing.size_gigabytes : null
    if (existingSize !== null && existingSize < requestedSize) {
      await resizeDatasetVolume(env, existing.id, requestedSize, region)
      await waitForVolumeSize(env, existing.id, requestedSize)
    }
    return {
      id: existing.id,
      name,
      region,
      mountRoot,
      datasetMountPath: `${mountRoot}/datasets/${datasetId}`,
      sizeGigabytes: existingSize === null ? null : Math.max(existingSize, requestedSize),
    }
  }

  const created = await doRequest<{ volume: { id: string } }>(env, '/volumes', {
    method: 'POST',
    body: JSON.stringify({
      name,
      region,
      size_gigabytes: requestedSize,
      description: `Alpha Research dataset ${datasetId}`,
    }),
  })

  return {
    id: created.volume.id,
    name,
    region,
    mountRoot,
    datasetMountPath: `${mountRoot}/datasets/${datasetId}`,
    sizeGigabytes: requestedSize,
  }
}

export function requestedWorkspaceDiskGb(params: Pick<LaunchResearchParams, 'configJson'>) {
  const resources = parseResearchRunResources(params)
  const value = resources.workspaceDiskGb
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return Math.ceil(value)
}

export async function ensureDatasetVolumeWorkspace(env: DigitalOceanEnv, datasetId: string, workspaceDiskGb: number | null) {
  const previousSize = env.DIGITALOCEAN_VOLUME_SIZE_GIB
  const requestedSize = Math.max(
    Number(previousSize ?? '10'),
    typeof workspaceDiskGb === 'number' && Number.isFinite(workspaceDiskGb) ? Math.ceil(workspaceDiskGb) : 0,
  )
  return ensureDatasetVolume({ ...env, DIGITALOCEAN_VOLUME_SIZE_GIB: String(requestedSize) }, datasetId)
}

async function resizeDatasetVolume(env: DigitalOceanEnv, volumeId: string, sizeGigabytes: number, region: string) {
  await doRequestNoContent(env, `/volumes/${encodeURIComponent(volumeId)}/actions`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'resize',
      size_gigabytes: sizeGigabytes,
      region,
    }),
  })
}

async function waitForVolumeSize(env: DigitalOceanEnv, volumeId: string, sizeGigabytes: number, timeoutMs = 120_000) {
  const startedAt = Date.now()
  while ((Date.now() - startedAt) < timeoutMs) {
    const volume = await doRequest<{ volume?: { size_gigabytes?: number } }>(
      env,
      `/volumes/${encodeURIComponent(volumeId)}`,
      { method: 'GET' },
    ).catch(() => null)
    const currentSize = volume?.volume?.size_gigabytes
    if (typeof currentSize === 'number' && currentSize >= sizeGigabytes) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error(`Volume ${volumeId} did not resize to ${sizeGigabytes}GiB before timeout`)
}

export async function waitForVolumeDetachment(env: DigitalOceanEnv, volumeId: string, timeoutMs = 60_000) {
  const startedAt = Date.now()
  while ((Date.now() - startedAt) < timeoutMs) {
    const volume = await doRequest<{ volume?: { droplet_ids?: number[] } }>(
      env,
      `/volumes/${encodeURIComponent(volumeId)}`,
      { method: 'GET' },
    ).catch(() => null)
    const dropletIds = volume?.volume?.droplet_ids ?? []
    if (dropletIds.length === 0) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error(`Volume ${volumeId} is still attached after waiting for detachment`)
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function encodeBase64(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
}

function resolveImageRef(value: string | undefined, fallback: string) {
  const candidate = (value ?? '').trim()
  if (!candidate) {
    return fallback
  }
  return /^\d+$/u.test(candidate) ? Number(candidate) : candidate
}

function parseResearchRunResources(params: Pick<LaunchResearchParams, 'configJson'>): ResearchRunResources {
  if (!params.configJson) {
    return {}
  }
  try {
    const config = JSON.parse(params.configJson) as Record<string, unknown>
    const resources = config.resources
    if (!resources || typeof resources !== 'object') {
      return {}
    }
    const input = resources as Record<string, unknown>
    return {
      profile: typeof input.profile === 'string' ? input.profile : undefined,
      runnerSize: typeof input.runnerSize === 'string' ? input.runnerSize.trim() : undefined,
      workspaceDiskGb: typeof input.workspaceDiskGb === 'number' ? input.workspaceDiskGb : undefined,
    }
  } catch {
    return {}
  }
}

function chooseResearchDropletSize(env: DigitalOceanEnv, params: LaunchResearchParams) {
  const resources = parseResearchRunResources(params)
  if (resources.runnerSize) {
    return resources.runnerSize
  }
  const small = env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_SMALL ?? 's-2vcpu-4gb'
  const medium = env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_MEDIUM ?? 's-4vcpu-8gb'
  const large = env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_LARGE ?? 's-8vcpu-16gb'
  if (params.runType === 'query') {
    return (params.sourceSizeBytes ?? 0) > 5_000_000_000 ? medium : small
  }
  if (params.runType === 'agent' || params.runType === 'analysis' || params.runType === 'hypothesis' || params.runType === 'environment') {
    return (params.sourceSizeBytes ?? 0) > 2_000_000_000 ? large : medium
  }
  return (params.sourceSizeBytes ?? 0) > 5_000_000_000 ? large : small
}

export function inferResearchSizeClass(params: LaunchResearchParams) {
  const resources = parseResearchRunResources(params)
  if (resources.runnerSize) {
    const explicitSize = resources.runnerSize
    if (explicitSize === 's-2vcpu-4gb') return 'small'
    if (explicitSize === 's-4vcpu-8gb') return 'medium'
    return 'large'
  }
  if (params.runType === 'query') {
    return (params.sourceSizeBytes ?? 0) > 5_000_000_000 ? 'medium' : 'small'
  }
  if (params.runType === 'agent' || params.runType === 'analysis' || params.runType === 'hypothesis' || params.runType === 'environment') {
    return (params.sourceSizeBytes ?? 0) > 2_000_000_000 ? 'large' : 'medium'
  }
  return (params.sourceSizeBytes ?? 0) > 5_000_000_000 ? 'large' : 'small'
}

export function requiresDedicatedResearchRunner(params: LaunchResearchParams) {
  const resources = parseResearchRunResources(params)
  return Boolean(resources.runnerSize || resources.workspaceDiskGb)
}

function desiredWarmPoolSize(env: DigitalOceanEnv, sizeClass: 'small' | 'medium' | 'large') {
  if (sizeClass === 'small') {
    return Math.max(0, Number(env.DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_SMALL ?? '1'))
  }
  if (sizeClass === 'medium') {
    return Math.max(0, Number(env.DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_MEDIUM ?? '1'))
  }
  return Math.max(0, Number(env.DIGITALOCEAN_RESEARCH_WARM_POOL_SIZE_LARGE ?? '0'))
}

function buildIngestRunnerScript(env: DigitalOceanEnv, params: LaunchIngestParams) {
  const imageRef = env.RESEARCH_DATASET_REPO_REF ?? 'codex/initial-substrate'
  const normalizeUrl = `https://raw.githubusercontent.com/zenobia-pay/alpha-research/${imageRef}/scripts/normalize_dataset.py`
  const venvPath = '/opt/alpha-research-venv'
  const mountRoot = params.outputRoot.replace(/\/data\/instances$/u, '')
  const callbackEventsUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/events`
  const callbackStatusUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/status`
  const downloadedSourcePath = `/tmp/alpha-research/${params.sourceFilename.replace(/[^A-Za-z0-9._-]/g, '-') || 'source-input'}`
  const cliArgs = [
    '--mode', params.mode || 'auto',
    '--input', downloadedSourcePath,
    '--id', params.instanceId,
    '--name', params.productName,
    '--dataset-id', params.datasetId,
    '--output-root', params.outputRoot,
    ...params.ingestArgs,
  ].map(shellEscape).join(' ')

  return `#!/bin/bash
set -euo pipefail
exec > >(tee -a /var/log/alpha-research-ingest.log) 2>&1
set -a

CALLBACK_EVENTS_URL=${shellEscape(callbackEventsUrl)}
CALLBACK_STATUS_URL=${shellEscape(callbackStatusUrl)}
RUNNER_TOKEN=${shellEscape(env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? '')}
MOUNT_ROOT=${shellEscape(mountRoot)}
SOURCE_URL=${shellEscape(params.sourceDownloadUrl)}
NORMALIZE_URL=${shellEscape(normalizeUrl)}
VENV_PATH=${shellEscape(venvPath)}
DEVICE="/dev/disk/by-id/scsi-0DO_Volume_${params.volumeName}"
set +a

post_event() {
  local level="$1"
  local message="$2"
  curl -fsS -X POST "$CALLBACK_EVENTS_URL" \\
    -H "Authorization: Bearer $RUNNER_TOKEN" \\
    -H "Content-Type: text/plain; charset=utf-8" \\
    -H "X-Run-Level: $level" \\
    --data "$message" >/dev/null || true
}

post_status() {
  local status="$1"
  local deployment_status="$2"
  local manifest_path="$3"
  local output_preview="\${4:-}"
  python3 - "$status" "$deployment_status" "$manifest_path" "$MOUNT_ROOT/datasets/${params.datasetId}" "$output_preview" <<'PY' | \\
    curl -fsS -X POST "$CALLBACK_STATUS_URL" \\
      -H "Authorization: Bearer $RUNNER_TOKEN" \\
      -H "Content-Type: application/json" \\
      --data @- >/dev/null || true
import json, sys
status, deployment_status, manifest_path, volume_path, output_preview = sys.argv[1:]
print(json.dumps({
  "status": status,
  "deploymentStatus": deployment_status,
  "manifestPath": manifest_path,
  "volumeMountPath": volume_path,
  "outputPreview": output_preview or None,
}))
PY
}

trap 'post_event error "Remote normalization failed."; post_status failed failed ""; exit 1' ERR

post_event info "Starting ingest droplet bootstrap."
apt-get update
apt-get install -y curl python3 python3-venv ca-certificates
python3 -m venv "$VENV_PATH"
"$VENV_PATH/bin/pip" install --upgrade pip
"$VENV_PATH/bin/pip" install pandas pyarrow

mkdir -p /opt/alpha-research /tmp/alpha-research
curl -fsSL "$NORMALIZE_URL" -o /opt/alpha-research/normalize_dataset.py

for _ in $(seq 1 60); do
  if [ -e "$DEVICE" ]; then
    break
  fi
  sleep 2
done
if [ ! -e "$DEVICE" ]; then
  post_event error "Volume device not found."
  post_status failed failed ""
  exit 1
fi
if ! blkid "$DEVICE" >/dev/null 2>&1; then
  mkfs.ext4 -F "$DEVICE"
fi
mkdir -p "$MOUNT_ROOT"
mount "$DEVICE" "$MOUNT_ROOT"
resize2fs "$DEVICE" || true
mkdir -p ${shellEscape(params.outputRoot)} ${shellEscape(`${mountRoot}/datasets/${params.datasetId}`)}

post_event info "Downloading dataset source."
curl -fsSL "$SOURCE_URL" -o ${shellEscape(downloadedSourcePath)}

post_event info "Running remote normalization."
set +e
"$VENV_PATH/bin/python" /opt/alpha-research/normalize_dataset.py ${cliArgs} 2>&1 | while IFS= read -r line; do
  echo "$line"
  case "$line" in
    *"Normalized "*|*"Wrote manifest to "*|*"Ingest complete"*)
      post_event info "$line"
      post_status running running "" "$line"
      ;;
  esac
done
NORMALIZE_EXIT=\${PIPESTATUS[0]}
set -e
if [ "$NORMALIZE_EXIT" -ne 0 ]; then
  exit "$NORMALIZE_EXIT"
fi

MANIFEST_PATH=${shellEscape(`${params.outputRoot}/${params.instanceId}/manifest.json`)}
post_event info "Remote normalization completed."
post_status ready ready "$MANIFEST_PATH" "Remote normalization completed."
`
}

function buildResearchRunnerScript(env: DigitalOceanEnv, params: LaunchResearchParams) {
  const runnerUrl = `${params.callbackOrigin}/api/internal/runner-scripts/remote-agent.py`
  const mountRoot = params.datasetMountPath.replace(/\/datasets\/[^/]+$/u, '')
  const callbackEventsUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/events`
  const callbackStatusUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/status`
  const callbackArtifactsUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/artifacts`
  const callbackSessionEntriesUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/session-entries`
  const promptB64 = encodeBase64(params.prompt)
  const configJsonB64 = encodeBase64(params.configJson ?? '{}')
  const artifactSpecJsonB64 = encodeBase64(params.artifactSpecJson ?? '[]')
  const remoteAgentModel = env.REMOTE_AGENT_MODEL ?? env.RESEARCH_AGENT_MODEL ?? 'gpt-5-codex'
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    'exec > >(tee -a /var/log/alpha-research-run.log) 2>&1',
    'set -a',
    '',
    `CALLBACK_EVENTS_URL=${shellEscape(callbackEventsUrl)}`,
    `CALLBACK_STATUS_URL=${shellEscape(callbackStatusUrl)}`,
    `CALLBACK_ARTIFACTS_URL=${shellEscape(callbackArtifactsUrl)}`,
    `CALLBACK_SESSION_ENTRIES_URL=${shellEscape(callbackSessionEntriesUrl)}`,
    `RUNNER_TOKEN=${shellEscape(env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? '')}`,
    `MOUNT_ROOT=${shellEscape(mountRoot)}`,
    `DATASET_MOUNT_PATH=${shellEscape(params.datasetMountPath)}`,
    `MANIFEST_PATH=${shellEscape(params.manifestPath)}`,
    `RUNNER_URL=${shellEscape(runnerUrl)}`,
    `OPENAI_API_KEY=${shellEscape(env.OPENAI_API_KEY ?? '')}`,
    `REMOTE_AGENT_MODEL=${shellEscape(remoteAgentModel)}`,
    `RUN_ID=${shellEscape(params.runId)}`,
    `RUN_TYPE=${shellEscape(params.runType)}`,
    `DATASET_ID=${shellEscape(params.datasetId)}`,
    `PROMPT_B64=${shellEscape(promptB64)}`,
    `CONFIG_B64=${shellEscape(configJsonB64)}`,
    `ARTIFACT_SPEC_B64=${shellEscape(artifactSpecJsonB64)}`,
    `REMOTE_AGENT_SESSION_ID=${shellEscape(params.remoteAgentSessionId ?? '')}`,
    `CODEX_HOME=${shellEscape(`${params.datasetMountPath}/.remote-agent/codex-home/${params.runId}`)}`,
    `WORKSPACE_DIR=${shellEscape(`${params.datasetMountPath}/.remote-agent/workspaces/${params.runId}`)}`,
    `ARTIFACT_DIR=${shellEscape(`${params.datasetMountPath}/.remote-agent/workspaces/${params.runId}/artifacts`)}`,
    `LAST_MESSAGE_PATH=${shellEscape(`${params.datasetMountPath}/.remote-agent/workspaces/${params.runId}/last_message.txt`)}`,
    `TRANSCRIPT_PATH=${shellEscape(`${params.datasetMountPath}/.remote-agent/workspaces/${params.runId}/codex-transcript.log`)}`,
    'RUN_LOG_PATH="/var/log/alpha-research-run.log"',
    'CLOUD_INIT_LOG_PATH="/var/log/cloud-init-output.log"',
    `DEVICE="/dev/disk/by-id/scsi-0DO_Volume_${params.volumeName}"`,
    'set +a',
    '',
    'post_event() {',
    '  local level="$1"',
    '  local message="$2"',
    '  curl -fsS -X POST "$CALLBACK_EVENTS_URL" \\',
    '    -H "Authorization: Bearer $RUNNER_TOKEN" \\',
    '    -H "Content-Type: text/plain; charset=utf-8" \\',
    '    -H "X-Run-Level: $level" \\',
    '    --data "$message" >/dev/null || true',
    '}',
    '',
    'post_status() {',
    '  local status="$1"',
    '  local output_preview="${2:-}"',
    `  python3 - "$status" "$output_preview" <<'PY' | \\`,
    '    curl -fsS -X POST "$CALLBACK_STATUS_URL" \\',
    '      -H "Authorization: Bearer $RUNNER_TOKEN" \\',
    '      -H "Content-Type: application/json" \\',
    '      --data @- >/dev/null || true',
    'import json, sys',
    'status, output_preview = sys.argv[1:]',
    'print(json.dumps({',
    '  "status": status,',
    '  "outputPreview": output_preview or None,',
    '}))',
    'PY',
    '}',
    '',
    'post_json_artifact() {',
    '  local artifact_type="$1"',
    '  local artifact_title="$2"',
    '  local artifact_json="$3"',
    `  python3 - "$artifact_type" "$artifact_title" "$artifact_json" <<'PY' | \\`,
    '    curl -fsS -X POST "$CALLBACK_ARTIFACTS_URL" \\',
    '      -H "Authorization: Bearer $RUNNER_TOKEN" \\',
    '      -H "Content-Type: application/json" \\',
    '      --data @- >/dev/null || true',
    'import json, sys',
    'artifact_type, artifact_title, artifact_json = sys.argv[1:]',
    'print(json.dumps({',
    '  "type": artifact_type,',
    '  "title": artifact_title,',
    '  "content": json.loads(artifact_json),',
    '}))',
    'PY',
    '}',
    '',
    'post_log_artifacts() {',
    `  python3 - "$RUN_LOG_PATH" "$CLOUD_INIT_LOG_PATH" <<'PY'`,
    'import json',
    'import os',
    'import sys',
    '',
    'def read_tail(path: str, max_chars: int = 50000):',
    '    if not path or not os.path.exists(path):',
    '        return None',
    '    try:',
    '        with open(path, "r", encoding="utf-8", errors="replace") as handle:',
    '            content = handle.read()',
    '        return {',
    '            "path": path,',
    '            "text": content[-max_chars:],',
    '        }',
    '    except Exception as exc:',
    '        return {',
    '            "path": path,',
    '            "error": str(exc),',
    '        }',
    '',
    'run_log = read_tail(sys.argv[1])',
    'cloud_init_log = read_tail(sys.argv[2])',
    'print(json.dumps({',
    '    "run_log": run_log,',
    '    "cloud_init_log": cloud_init_log,',
    '}))',
    'PY',
    '}',
    '',
    `trap 'LOG_JSON="$(post_log_artifacts)"; post_json_artifact "remote_agent_bootstrap_log" "Remote Agent Bootstrap Log" "$LOG_JSON"; post_event error "Remote agent run failed."; post_status failed ""; exit 1' ERR`,
    '',
    'post_event info "Starting remote agent droplet bootstrap."',
    'command -v python3 >/dev/null 2>&1',
    'command -v codex >/dev/null 2>&1',
    'if ! command -v python >/dev/null 2>&1; then ln -sf "$(command -v python3)" /usr/local/bin/python; fi',
    'mkdir -p /opt/alpha-research',
    'curl -fsSL -H "Authorization: Bearer $RUNNER_TOKEN" "$RUNNER_URL" -o /opt/alpha-research/run_remote_agent.py',
    '',
    'for _ in $(seq 1 60); do',
    '  if [ -e "$DEVICE" ]; then',
    '    break',
    '  fi',
    '  sleep 2',
    'done',
    'if [ ! -e "$DEVICE" ]; then',
    '  post_event error "Volume device not found."',
    '  post_status failed ""',
    '  exit 1',
    'fi',
    'if ! blkid "$DEVICE" >/dev/null 2>&1; then',
    '  mkfs.ext4 -F "$DEVICE"',
    'fi',
    'mkdir -p "$MOUNT_ROOT"',
    'mount "$DEVICE" "$MOUNT_ROOT" || true',
    'resize2fs "$DEVICE" || true',
    'mkdir -p "$CODEX_HOME" "$WORKSPACE_DIR" "$ARTIFACT_DIR"',
    `printf '%s' "$OPENAI_API_KEY" | codex login --with-api-key >/dev/null`,
    '',
    'post_event info "Running remote agent executor."',
    'set +e',
    'python3 /opt/alpha-research/run_remote_agent.py 2>&1 | while IFS= read -r line; do',
    '  echo "$line"',
    '  case "$line" in',
    '    *"Remote agent"*|*"session"*|*"ERROR:"*|*"{\\""* )',
    '      post_event info "$line"',
    '      post_status running "$line"',
    '      ;;',
    '  esac',
    'done',
    'RUN_EXIT=${PIPESTATUS[0]}',
    'set -e',
    'if [ "$RUN_EXIT" -ne 0 ]; then',
    '  exit "$RUN_EXIT"',
    'fi',
    '',
    'LOG_JSON="$(post_log_artifacts)"',
    'post_json_artifact "remote_agent_bootstrap_log" "Remote Agent Bootstrap Log" "$LOG_JSON"',
    'post_event info "Remote agent run completed."',
    'post_status ready "Remote agent run completed."',
  ].join('\n')
}

function buildWarmPoolRunnerScript(env: DigitalOceanEnv, sizeClass: 'small' | 'medium' | 'large') {
  const controlOrigin = env.RESEARCH_CONTROL_ORIGIN ?? 'https://alpharesearch.nyc'
  const runnerUrl = `${controlOrigin}/api/internal/runner-scripts/remote-agent.py`
  const mountRoot = env.DIGITALOCEAN_VOLUME_MOUNT_ROOT ?? '/mnt/alpha-research'
  return [
    '#!/bin/bash',
    'set -euo pipefail',
    'exec > >(tee -a /var/log/alpha-research-pool.log) 2>&1',
    'set -a',
    `CONTROL_ORIGIN=${shellEscape(controlOrigin)}`,
    `RUNNER_TOKEN=${shellEscape(env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? '')}`,
    `RUNNER_URL=${shellEscape(runnerUrl)}`,
    `OPENAI_API_KEY=${shellEscape(env.OPENAI_API_KEY ?? '')}`,
    `REMOTE_AGENT_MODEL=${shellEscape(env.REMOTE_AGENT_MODEL ?? env.RESEARCH_AGENT_MODEL ?? 'gpt-5-codex')}`,
    `POOL_SIZE_CLASS=${shellEscape(sizeClass)}`,
    `POOL_REGION=${shellEscape(env.DIGITALOCEAN_REGION ?? 'nyc3')}`,
    `MOUNT_ROOT=${shellEscape(mountRoot)}`,
    'POOL_DROPLET_ID="$(curl -fsS http://169.254.169.254/metadata/v1/id)"',
    'POOL_DROPLET_NAME="$(curl -fsS http://169.254.169.254/metadata/v1/hostname)"',
    'set +a',
    '',
    'command -v python3 >/dev/null 2>&1',
    'command -v codex >/dev/null 2>&1',
    'if ! command -v python >/dev/null 2>&1; then ln -sf "$(command -v python3)" /usr/local/bin/python; fi',
    'mkdir -p /opt/alpha-research',
    `printf '%s' "$OPENAI_API_KEY" | codex login --with-api-key >/dev/null`,
    '',
    'heartbeat() {',
    '  python3 - "$POOL_DROPLET_ID" "$POOL_DROPLET_NAME" "$POOL_SIZE_CLASS" "$POOL_REGION" <<\'PY\' | \\',
    '    curl -fsS -X POST "$CONTROL_ORIGIN/api/internal/runner-pool/heartbeat" \\',
    '      -H "Authorization: Bearer $RUNNER_TOKEN" \\',
    '      -H "Content-Type: application/json" \\',
    '      --data @- >/dev/null',
    'import json, sys',
    'droplet_id, droplet_name, size_class, region = sys.argv[1:]',
    'print(json.dumps({',
    '  "dropletId": droplet_id,',
    '  "dropletName": droplet_name,',
    '  "sizeClass": size_class,',
    '  "region": region,',
    '}))',
    'PY',
    '}',
    '',
    'complete_assignment() {',
    '  local run_id="$1"',
    '  python3 - "$run_id" <<\'PY\' | \\',
    '    curl -fsS -X POST "$CONTROL_ORIGIN/api/internal/runner-pool/droplets/$POOL_DROPLET_ID/complete" \\',
    '      -H "Authorization: Bearer $RUNNER_TOKEN" \\',
    '      -H "Content-Type: application/json" \\',
    '      --data @- >/dev/null || true',
    'import json, sys',
    'print(json.dumps({"runId": sys.argv[1]}))',
    'PY',
    '}',
    '',
    'while true; do',
    '  heartbeat || true',
    '  ASSIGNMENT_JSON="$(curl -fsS -H "Authorization: Bearer $RUNNER_TOKEN" "$CONTROL_ORIGIN/api/internal/runner-pool/droplets/$POOL_DROPLET_ID/assignment" || echo "{}")"',
    '  eval "$(python3 - "$ASSIGNMENT_JSON" <<\'PY\'',
    'import json, shlex, sys',
    'payload = json.loads(sys.argv[1] or "{}")',
    'assignment = payload.get("assignment") or {}',
    'fields = {',
    '  "RUN_ID": assignment.get("runId", ""),',
    '  "RUN_TYPE": assignment.get("runType", ""),',
    '  "DATASET_ID": assignment.get("datasetId", ""),',
    '  "DATASET_MOUNT_PATH": assignment.get("datasetMountPath", ""),',
    '  "MANIFEST_PATH": assignment.get("manifestPath", ""),',
    '  "PROMPT_B64": assignment.get("promptB64", ""),',
    '  "CONFIG_B64": assignment.get("configB64", ""),',
    '  "ARTIFACT_SPEC_B64": assignment.get("artifactSpecB64", ""),',
    '  "REMOTE_AGENT_SESSION_ID": assignment.get("remoteAgentSessionId", ""),',
    '  "VOLUME_NAME": assignment.get("volumeName", ""),',
    '}',
    'for key, value in fields.items():',
    '    print(f"export {key}={shlex.quote(str(value))}")',
    'PY',
    ')"',
    '  if [ -z "${RUN_ID:-}" ]; then',
    '    sleep 5',
    '    continue',
    '  fi',
    '  export CALLBACK_EVENTS_URL="$CONTROL_ORIGIN/api/internal/runs/$RUN_ID/events"',
    '  export CALLBACK_STATUS_URL="$CONTROL_ORIGIN/api/internal/runs/$RUN_ID/status"',
    '  export CALLBACK_ARTIFACTS_URL="$CONTROL_ORIGIN/api/internal/runs/$RUN_ID/artifacts"',
    '  export CALLBACK_SESSION_ENTRIES_URL="$CONTROL_ORIGIN/api/internal/runs/$RUN_ID/session-entries"',
    '  export CODEX_HOME="$DATASET_MOUNT_PATH/.remote-agent/codex-home/$RUN_ID"',
    '  export WORKSPACE_DIR="$DATASET_MOUNT_PATH/.remote-agent/workspaces/$RUN_ID"',
    '  export ARTIFACT_DIR="$DATASET_MOUNT_PATH/.remote-agent/workspaces/$RUN_ID/artifacts"',
    '  export LAST_MESSAGE_PATH="$DATASET_MOUNT_PATH/.remote-agent/workspaces/$RUN_ID/last_message.txt"',
    '  export TRANSCRIPT_PATH="$DATASET_MOUNT_PATH/.remote-agent/workspaces/$RUN_ID/codex-transcript.log"',
    '  export RUN_LOG_PATH="/var/log/alpha-research-run.log"',
    '  export CLOUD_INIT_LOG_PATH="/var/log/cloud-init-output.log"',
    '  export DEVICE="/dev/disk/by-id/scsi-0DO_Volume_$VOLUME_NAME"',
    '  mkdir -p /opt/alpha-research',
    '  curl -fsSL -H "Authorization: Bearer $RUNNER_TOKEN" "$RUNNER_URL" -o /opt/alpha-research/run_remote_agent.py',
    '  for _ in $(seq 1 60); do',
    '    if [ -e "$DEVICE" ]; then',
    '      break',
    '    fi',
    '    sleep 2',
    '  done',
    '  if [ ! -e "$DEVICE" ]; then',
    '    post_status failed "Volume device not found."',
    '    complete_assignment "$RUN_ID"',
    '    unset RUN_ID RUN_TYPE DATASET_ID DATASET_MOUNT_PATH MANIFEST_PATH PROMPT_B64 CONFIG_B64 ARTIFACT_SPEC_B64 REMOTE_AGENT_SESSION_ID VOLUME_NAME',
    '    continue',
    '  fi',
    '  if ! blkid "$DEVICE" >/dev/null 2>&1; then',
    '    mkfs.ext4 -F "$DEVICE"',
    '  fi',
    '  mkdir -p "$MOUNT_ROOT"',
    '  mount "$DEVICE" "$MOUNT_ROOT" || true',
    '  resize2fs "$DEVICE" || true',
    '  mkdir -p "$CODEX_HOME" "$WORKSPACE_DIR" "$ARTIFACT_DIR"',
    `  printf '%s' "$OPENAI_API_KEY" | codex login --with-api-key >/dev/null`,
    '  set +e',
    '  python3 /opt/alpha-research/run_remote_agent.py',
    '  RUN_EXIT=$?',
    '  set -e',
    '  sync || true',
    '  umount "$MOUNT_ROOT" || true',
    '  complete_assignment "$RUN_ID"',
    '  unset RUN_ID RUN_TYPE DATASET_ID DATASET_MOUNT_PATH MANIFEST_PATH PROMPT_B64 CONFIG_B64 ARTIFACT_SPEC_B64 REMOTE_AGENT_SESSION_ID VOLUME_NAME',
    '  if [ "$RUN_EXIT" -ne 0 ]; then',
    '    sleep 2',
    '  fi',
    'done',
  ].join('\n')
}

async function listWarmPoolDroplets(env: DigitalOceanEnv, sizeClass: 'small' | 'medium' | 'large') {
  const tag = `alpha-research-pool-${sizeClass}`
  const region = env.DIGITALOCEAN_REGION ?? 'nyc3'
  const response = await doRequest<{ droplets?: Array<{ id: number; name: string; status: string; region?: { slug?: string } }> }>(
    env,
    `/droplets?tag_name=${encodeURIComponent(tag)}`,
    { method: 'GET' },
  ).catch(() => ({ droplets: [] }))
  return (response.droplets ?? []).filter((droplet) => droplet.region?.slug === region)
}

async function createWarmPoolDroplet(env: DigitalOceanEnv, sizeClass: 'small' | 'medium' | 'large') {
  const region = env.DIGITALOCEAN_REGION ?? 'nyc3'
  const image = resolveImageRef(env.DIGITALOCEAN_RESEARCH_RUNNER_IMAGE ?? env.DIGITALOCEAN_INGEST_IMAGE, 'ubuntu-24-04-x64')
  const size = sizeClass === 'small'
    ? (env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_SMALL ?? 's-2vcpu-4gb')
    : sizeClass === 'medium'
      ? (env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_MEDIUM ?? 's-4vcpu-8gb')
      : (env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_LARGE ?? 's-8vcpu-16gb')
  const sshKeys = (env.DIGITALOCEAN_SSH_KEY_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
  const dropletName = `ar-pool-${sizeClass}-${Date.now().toString().slice(-6)}`
  const droplet = await doRequest<{ droplet: { id: number; name: string } }>(env, '/droplets', {
    method: 'POST',
    body: JSON.stringify({
      name: dropletName,
      region,
      size,
      image,
      ssh_keys: sshKeys,
      backups: false,
      ipv6: false,
      monitoring: true,
      tags: ['alpha-research', 'research-runner-pool', `alpha-research-pool-${sizeClass}`],
      user_data: buildWarmPoolRunnerScript(env, sizeClass),
    }),
  })
  if (env.DIGITALOCEAN_PROJECT_ID) {
    await doRequest(env, `/projects/${encodeURIComponent(env.DIGITALOCEAN_PROJECT_ID)}/resources`, {
      method: 'POST',
      body: JSON.stringify({
        resources: [`do:droplet:${droplet.droplet.id}`],
      }),
    }).catch(() => undefined)
  }
}

export async function ensureWarmResearchPool(env: DigitalOceanEnv, sizeClass: 'small' | 'medium' | 'large') {
  const desired = desiredWarmPoolSize(env, sizeClass)
  if (desired <= 0) {
    return
  }
  const warmDroplets = await listWarmPoolDroplets(env, sizeClass)
  const deficit = Math.max(0, desired - warmDroplets.length)
  for (let index = 0; index < deficit; index += 1) {
    await createWarmPoolDroplet(env, sizeClass).catch(() => undefined)
  }
}

export async function attachVolumeToDroplet(env: DigitalOceanEnv, volumeId: string, dropletId: string, region?: string) {
  await doRequestNoContent(env, `/volumes/${encodeURIComponent(volumeId)}/actions`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'attach',
      droplet_id: Number(dropletId),
      ...(region ? { region } : {}),
    }),
  })
}

export async function detachVolumeByDroplet(env: DigitalOceanEnv, volumeId: string, dropletId: string, region?: string) {
  await doRequestNoContent(env, `/volumes/${encodeURIComponent(volumeId)}/actions`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'detach',
      droplet_id: Number(dropletId),
      ...(region ? { region } : {}),
    }),
  })
}

export async function launchIngestDroplet(env: DigitalOceanEnv, params: LaunchIngestParams) {
  const region = env.DIGITALOCEAN_REGION ?? 'nyc3'
  const dropletName = `ar-ingest-${sanitizeName(params.datasetId)}-${Date.now().toString().slice(-6)}`
  const image = resolveImageRef(env.DIGITALOCEAN_INGEST_IMAGE, 'ubuntu-24-04-x64')
  const size = env.DIGITALOCEAN_INGEST_DROPLET_SIZE ?? 's-2vcpu-4gb'
  const sshKeys = (env.DIGITALOCEAN_SSH_KEY_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  const droplet = await doRequest<{ droplet: { id: number; name: string } }>(env, '/droplets', {
    method: 'POST',
    body: JSON.stringify({
      name: dropletName,
      region,
      size,
      image,
      ssh_keys: sshKeys,
      backups: false,
      ipv6: false,
      monitoring: true,
      tags: ['alpha-research', 'dataset-ingest'],
      volumes: [params.volumeId],
      user_data: buildIngestRunnerScript(env, params),
    }),
  })

  if (env.DIGITALOCEAN_PROJECT_ID) {
    await doRequest(env, `/projects/${encodeURIComponent(env.DIGITALOCEAN_PROJECT_ID)}/resources`, {
      method: 'POST',
      body: JSON.stringify({
        resources: [`do:droplet:${droplet.droplet.id}`],
      }),
    }).catch(() => undefined)
  }

  return {
    id: String(droplet.droplet.id),
    name: droplet.droplet.name,
    region,
  }
}

export async function launchResearchDroplet(env: DigitalOceanEnv, params: LaunchResearchParams) {
  const region = env.DIGITALOCEAN_REGION ?? 'nyc3'
  const dropletName = `ar-run-${sanitizeName(params.datasetId)}-${Date.now().toString().slice(-6)}`
  const image = resolveImageRef(env.DIGITALOCEAN_RESEARCH_RUNNER_IMAGE ?? env.DIGITALOCEAN_INGEST_IMAGE, 'ubuntu-24-04-x64')
  const size = chooseResearchDropletSize(env, params)
  const sshKeys = (env.DIGITALOCEAN_SSH_KEY_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  const droplet = await doRequest<{ droplet: { id: number; name: string } }>(env, '/droplets', {
    method: 'POST',
    body: JSON.stringify({
      name: dropletName,
      region,
      size,
      image,
      ssh_keys: sshKeys,
      backups: false,
      ipv6: false,
      monitoring: true,
      tags: ['alpha-research', 'research-run', `run-${params.runType}`],
      volumes: [params.volumeId],
      user_data: buildResearchRunnerScript(env, params),
    }),
  })

  if (env.DIGITALOCEAN_PROJECT_ID) {
    await doRequest(env, `/projects/${encodeURIComponent(env.DIGITALOCEAN_PROJECT_ID)}/resources`, {
      method: 'POST',
      body: JSON.stringify({
        resources: [`do:droplet:${droplet.droplet.id}`],
      }),
    }).catch(() => undefined)
  }

  return {
    id: String(droplet.droplet.id),
    name: droplet.droplet.name,
    region,
    size,
  }
}
