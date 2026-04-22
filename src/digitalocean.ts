type DigitalOceanEnv = {
  DIGITALOCEAN_API_TOKEN?: string
  DIGITALOCEAN_REGION?: string
  DIGITALOCEAN_VOLUME_SIZE_GIB?: string
  DIGITALOCEAN_VOLUME_MOUNT_ROOT?: string
  DIGITALOCEAN_INGEST_DROPLET_SIZE?: string
  DIGITALOCEAN_INGEST_IMAGE?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_SMALL?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_MEDIUM?: string
  DIGITALOCEAN_RESEARCH_DROPLET_SIZE_LARGE?: string
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
  const list = await doRequest<{ volumes?: Array<{ id: string; name: string }> }>(
    env,
    `/volumes?name=${encodeURIComponent(name)}&region=${encodeURIComponent(region)}`,
  )
  const existing = list.volumes?.[0]
  if (existing) {
    return {
      id: existing.id,
      name,
      region,
      mountRoot,
      datasetMountPath: `${mountRoot}/datasets/${datasetId}`,
    }
  }

  const size = Number(env.DIGITALOCEAN_VOLUME_SIZE_GIB ?? '10')
  const created = await doRequest<{ volume: { id: string } }>(env, '/volumes', {
    method: 'POST',
    body: JSON.stringify({
      name,
      region,
      size_gigabytes: size,
      description: `Alpha Research dataset ${datasetId}`,
    }),
  })

  return {
    id: created.volume.id,
    name,
    region,
    mountRoot,
    datasetMountPath: `${mountRoot}/datasets/${datasetId}`,
  }
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function encodeBase64(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
}

function chooseResearchDropletSize(env: DigitalOceanEnv, params: LaunchResearchParams) {
  const small = env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_SMALL ?? 's-2vcpu-4gb'
  const medium = env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_MEDIUM ?? 's-4vcpu-8gb'
  const large = env.DIGITALOCEAN_RESEARCH_DROPLET_SIZE_LARGE ?? 's-8vcpu-16gb'
  if (params.runType === 'query') {
    return (params.sourceSizeBytes ?? 0) > 5_000_000_000 ? medium : small
  }
  if (params.runType === 'agent' || params.runType === 'analysis' || params.runType === 'hypothesis') {
    return (params.sourceSizeBytes ?? 0) > 2_000_000_000 ? large : medium
  }
  return (params.sourceSizeBytes ?? 0) > 5_000_000_000 ? large : small
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

CALLBACK_EVENTS_URL=${shellEscape(callbackEventsUrl)}
CALLBACK_STATUS_URL=${shellEscape(callbackStatusUrl)}
RUNNER_TOKEN=${shellEscape(env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? '')}
MOUNT_ROOT=${shellEscape(mountRoot)}
SOURCE_URL=${shellEscape(params.sourceDownloadUrl)}
NORMALIZE_URL=${shellEscape(normalizeUrl)}
VENV_PATH=${shellEscape(venvPath)}
DEVICE="/dev/disk/by-id/scsi-0DO_Volume_${params.volumeName}"

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
  const imageRef = env.RESEARCH_DATASET_REPO_REF ?? 'main'
  const runnerUrl = `https://raw.githubusercontent.com/rprend/alpha-research/${imageRef}/scripts/run_remote_agent.py`
  const venvPath = '/opt/alpha-research-agent-venv'
  const mountRoot = params.datasetMountPath.replace(/\/datasets\/[^/]+$/u, '')
  const callbackEventsUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/events`
  const callbackStatusUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/status`
  const callbackArtifactsUrl = `${params.callbackOrigin}/api/internal/runs/${params.runId}/artifacts`
  const promptB64 = encodeBase64(params.prompt)
  const configJsonB64 = encodeBase64(params.configJson ?? '{}')
  const artifactSpecJsonB64 = encodeBase64(params.artifactSpecJson ?? '[]')
  const remoteAgentModel = env.REMOTE_AGENT_MODEL ?? env.RESEARCH_AGENT_MODEL ?? 'gpt-5-codex'

  return `#!/bin/bash
set -euo pipefail
exec > >(tee -a /var/log/alpha-research-run.log) 2>&1

CALLBACK_EVENTS_URL=${shellEscape(callbackEventsUrl)}
CALLBACK_STATUS_URL=${shellEscape(callbackStatusUrl)}
CALLBACK_ARTIFACTS_URL=${shellEscape(callbackArtifactsUrl)}
RUNNER_TOKEN=${shellEscape(env.RESEARCH_INTERNAL_RUNNER_TOKEN ?? '')}
MOUNT_ROOT=${shellEscape(mountRoot)}
DATASET_MOUNT_PATH=${shellEscape(params.datasetMountPath)}
MANIFEST_PATH=${shellEscape(params.manifestPath)}
RUNNER_URL=${shellEscape(runnerUrl)}
VENV_PATH=${shellEscape(venvPath)}
OPENAI_API_KEY=${shellEscape(env.OPENAI_API_KEY ?? '')}
REMOTE_AGENT_MODEL=${shellEscape(remoteAgentModel)}
RUN_ID=${shellEscape(params.runId)}
RUN_TYPE=${shellEscape(params.runType)}
DATASET_ID=${shellEscape(params.datasetId)}
PROMPT_B64=${shellEscape(promptB64)}
CONFIG_B64=${shellEscape(configJsonB64)}
ARTIFACT_SPEC_B64=${shellEscape(artifactSpecJsonB64)}
REMOTE_AGENT_SESSION_ID=${shellEscape(params.remoteAgentSessionId ?? '')}
CODEX_HOME=${shellEscape(`${params.datasetMountPath}/.remote-agent/codex-home/${params.runId}`)}
WORKSPACE_DIR=${shellEscape(`${params.datasetMountPath}/.remote-agent/workspaces/${params.runId}`)}
ARTIFACT_DIR=${shellEscape(`${params.datasetMountPath}/.remote-agent/workspaces/${params.runId}/artifacts`)}
LAST_MESSAGE_PATH=${shellEscape(`${params.datasetMountPath}/.remote-agent/workspaces/${params.runId}/last_message.txt`)}
TRANSCRIPT_PATH=${shellEscape(`${params.datasetMountPath}/.remote-agent/workspaces/${params.runId}/codex-transcript.log`)}
DEVICE="/dev/disk/by-id/scsi-0DO_Volume_${params.volumeName}"

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
  local output_preview="\${2:-}"
  python3 - "$status" "$output_preview" <<'PY' | \\
    curl -fsS -X POST "$CALLBACK_STATUS_URL" \\
      -H "Authorization: Bearer $RUNNER_TOKEN" \\
      -H "Content-Type: application/json" \\
      --data @- >/dev/null || true
import json, sys
status, output_preview = sys.argv[1:]
print(json.dumps({
  "status": status,
  "outputPreview": output_preview or None,
}))
PY
}

trap 'post_event error "Remote agent run failed."; post_status failed ""; exit 1' ERR

post_event info "Starting remote agent droplet bootstrap."
apt-get update
apt-get install -y curl python3 python3-venv ca-certificates nodejs npm git
python3 -m venv "$VENV_PATH"
"$VENV_PATH/bin/pip" install --upgrade pip
"$VENV_PATH/bin/pip" install requests

mkdir -p /opt/alpha-research
curl -fsSL "$RUNNER_URL" -o /opt/alpha-research/run_remote_agent.py
npm install -g @openai/codex
mkdir -p "$CODEX_HOME" "$WORKSPACE_DIR" "$ARTIFACT_DIR"
printf '%s' "$OPENAI_API_KEY" | codex login --with-api-key >/dev/null

for _ in $(seq 1 60); do
  if [ -e "$DEVICE" ]; then
    break
  fi
  sleep 2
done
if [ ! -e "$DEVICE" ]; then
  post_event error "Volume device not found."
  post_status failed ""
  exit 1
fi
mkdir -p "$MOUNT_ROOT"
mount "$DEVICE" "$MOUNT_ROOT" || true

post_event info "Running remote agent executor."
set +e
"$VENV_PATH/bin/python" /opt/alpha-research/run_remote_agent.py 2>&1 | while IFS= read -r line; do
  echo "$line"
  case "$line" in
    *"Remote agent"*|*"session"*|*"ERROR:"*|*"{\""* )
      post_event info "$line"
      post_status running "$line"
      ;;
  esac
done
RUN_EXIT=\${PIPESTATUS[0]}
set -e
if [ "$RUN_EXIT" -ne 0 ]; then
  exit "$RUN_EXIT"
fi

post_event info "Remote agent run completed."
post_status ready "Remote agent run completed."
`
}

export async function launchIngestDroplet(env: DigitalOceanEnv, params: LaunchIngestParams) {
  const region = env.DIGITALOCEAN_REGION ?? 'nyc3'
  const dropletName = `ar-ingest-${sanitizeName(params.datasetId)}-${Date.now().toString().slice(-6)}`
  const image = env.DIGITALOCEAN_INGEST_IMAGE ?? 'ubuntu-24-04-x64'
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
  const image = env.DIGITALOCEAN_INGEST_IMAGE ?? 'ubuntu-24-04-x64'
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
