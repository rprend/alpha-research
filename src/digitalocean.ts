type DigitalOceanEnv = {
  DIGITALOCEAN_API_TOKEN?: string
  DIGITALOCEAN_REGION?: string
  DIGITALOCEAN_VOLUME_SIZE_GIB?: string
  DIGITALOCEAN_VOLUME_MOUNT_ROOT?: string
  DIGITALOCEAN_INGEST_DROPLET_SIZE?: string
  DIGITALOCEAN_INGEST_IMAGE?: string
  DIGITALOCEAN_SSH_KEY_IDS?: string
  DIGITALOCEAN_PROJECT_ID?: string
  RESEARCH_INTERNAL_RUNNER_TOKEN?: string
  RESEARCH_DATASET_REPO_REF?: string
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

function buildRunnerScript(env: DigitalOceanEnv, params: LaunchIngestParams) {
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
VOLUME_NAME=${shellEscape(params.volumeName)}
MOUNT_ROOT=${shellEscape(mountRoot)}
SOURCE_URL=${shellEscape(params.sourceDownloadUrl)}
NORMALIZE_URL=${shellEscape(normalizeUrl)}
VENV_PATH=${shellEscape(venvPath)}

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
  python3 - "$status" "$deployment_status" "$manifest_path" "$MOUNT_ROOT/datasets/${params.datasetId}" <<'PY' | \\
    curl -fsS -X POST "$CALLBACK_STATUS_URL" \\
      -H "Authorization: Bearer $RUNNER_TOKEN" \\
      -H "Content-Type: application/json" \\
      --data @- >/dev/null || true
import json, sys
status, deployment_status, manifest_path, volume_path = sys.argv[1:]
print(json.dumps({
  "status": status,
  "deploymentStatus": deployment_status,
  "manifestPath": manifest_path,
  "volumeMountPath": volume_path,
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

DEVICE="/dev/disk/by-id/scsi-0DO_Volume_${params.volumeName}"
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
"$VENV_PATH/bin/python" /opt/alpha-research/normalize_dataset.py ${cliArgs}

MANIFEST_PATH=${shellEscape(`${params.outputRoot}/${params.instanceId}/manifest.json`)}
post_event info "Remote normalization completed."
post_status ready ready "$MANIFEST_PATH"
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
      user_data: buildRunnerScript(env, params),
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
