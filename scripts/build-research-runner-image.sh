#!/usr/bin/env bash
set -euo pipefail

REGION="${DIGITALOCEAN_REGION:-nyc3}"
SIZE="${DIGITALOCEAN_RESEARCH_DROPLET_SIZE_MEDIUM:-s-4vcpu-8gb}"
BASE_IMAGE="${BASE_IMAGE:-ubuntu-24-04-x64}"
SNAPSHOT_NAME="${SNAPSHOT_NAME:-alpha-research-runner-$(date +%Y%m%d-%H%M%S)}"
SSH_KEY_IDS="${DIGITALOCEAN_SSH_KEY_IDS:-}"
PROJECT_ID="${DIGITALOCEAN_PROJECT_ID:-}"
BUILDER_NAME="ar-runner-bake-$(date +%s | tail -c 7)"

if ! command -v doctl >/dev/null 2>&1; then
  echo "doctl is required" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required" >&2
  exit 1
fi

if [[ -z "${SSH_KEY_IDS}" ]]; then
  echo "DIGITALOCEAN_SSH_KEY_IDS must be set" >&2
  exit 1
fi

echo "Creating builder droplet ${BUILDER_NAME} in ${REGION} from ${BASE_IMAGE}..."
CREATE_ARGS=(
  compute droplet create "${BUILDER_NAME}"
  --region "${REGION}"
  --image "${BASE_IMAGE}"
  --size "${SIZE}"
  --ssh-keys "${SSH_KEY_IDS}"
  --tag-names alpha-research,alpha-research-runner-image-builder
  --wait
  --format ID,PublicIPv4
  --no-header
)
read -r DROPLET_ID BUILDER_IP <<<"$(doctl "${CREATE_ARGS[@]}")"

cleanup() {
  set +e
  if [[ -n "${DROPLET_ID:-}" ]]; then
    doctl compute droplet delete "${DROPLET_ID}" --force >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ -n "${PROJECT_ID}" ]]; then
  doctl projects resources assign "${PROJECT_ID}" --resource "do:droplet:${DROPLET_ID}" >/dev/null || true
fi

echo "Waiting for SSH on ${BUILDER_IP}..."
for _ in $(seq 1 60); do
  if ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no "root@${BUILDER_IP}" "echo ok" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

ssh -o StrictHostKeyChecking=no "root@${BUILDER_IP}" <<'EOF'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git build-essential python3 python3-dev python3-pip python3-venv
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g @openai/codex
python3 -m pip install --break-system-packages requests pandas pyarrow duckdb
ln -sf "$(command -v python3)" /usr/local/bin/python
mkdir -p /opt/alpha-research
cat >/opt/alpha-research/README.txt <<'TXT'
Alpha Research runner image
- python3
- python3-venv
- python -> python3
- requests
- pandas
- pyarrow
- duckdb
- nodejs
- codex
TXT
apt-get clean
rm -rf /var/lib/apt/lists/*
rm -f /etc/ssh/ssh_host_*
truncate -s 0 /etc/machine-id
rm -f /var/lib/dbus/machine-id
cloud-init clean --logs --machine-id
rm -rf /var/log/cloud-init*.log /var/lib/cloud/*
history -c || true
sync
EOF

echo "Powering off builder before snapshot..."
doctl compute droplet-action shutdown "${DROPLET_ID}" --wait >/dev/null

echo "Creating snapshot ${SNAPSHOT_NAME}..."
doctl compute droplet-action snapshot "${DROPLET_ID}" --snapshot-name "${SNAPSHOT_NAME}" --wait >/dev/null

IMAGE_ID="$(doctl compute image list-user --format ID,Name --no-header | awk -v name="${SNAPSHOT_NAME}" '$2 == name { print $1; exit }')"
if [[ -z "${IMAGE_ID}" ]]; then
  echo "Snapshot created but image id could not be resolved for ${SNAPSHOT_NAME}" >&2
  exit 1
fi

echo
echo "Snapshot ready:"
echo "  name: ${SNAPSHOT_NAME}"
echo "  id:   ${IMAGE_ID}"
echo
echo "Next:"
echo "  npx wrangler secret put DIGITALOCEAN_RESEARCH_RUNNER_IMAGE   # if storing name/id as secret"
echo "  or set DIGITALOCEAN_RESEARCH_RUNNER_IMAGE=${IMAGE_ID} in worker vars before deploy"
