# alpha-research

Worker-backed landing page and auth/orchestration edge for alpha-research.

Purpose: enable decision makers to test 100x more hypotheses.

We built an open-source research platform for large datasets.

## Scripts

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm preview`
- `pnpm run cf:deploy`

## Cloudflare

- Worker: `alpha-research`
- Production domain: `alpharesearch.nyc`
- Account: `Founders@zenobiapay.com's Account`
- Production deploy: `pnpm run cf:deploy`
- The site now runs as a Cloudflare Worker with static assets bound through Wrangler

## Auth

The Worker includes:

- `GET /api/auth/start`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/auth/callback`
- `GET /cli/login`
- `POST /api/cli/plan`
- `GET /api/cli/me`
- `GET/POST /api/cli/datasets`
- `POST /api/cli/datasets/:id/source-upload`
- `POST /api/cli/datasets/:id/source-complete`
- `POST /api/cli/datasets/:id/deploy`
- `GET /api/cli/runs`
- `GET /api/cli/runs/:id`
- `GET /api/cli/runs/:id/events`

These are implemented in Worker-routed handlers under `functions/` and surfaced through [src/worker.ts](/Users/ryanprendergast/Documents/Zenobia%20Pay/alpha-research/src/worker.ts).

Required Worker secrets:

- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `ALPHA_RESEARCH_SESSION_SECRET`
- `WORKOS_REDIRECT_URI`
- `OPENAI_API_KEY` for backend planning/proxying
- `RESEARCH_INTERNAL_RUNNER_TOKEN` for ingest runner callbacks

Required Worker secrets for DigitalOcean orchestration:

- `DIGITALOCEAN_API_TOKEN`
- `DO_SPACES_BUCKET`
- `DO_SPACES_REGION`
- `DO_SPACES_ACCESS_KEY_ID`
- `DO_SPACES_SECRET_ACCESS_KEY`

Optional Worker vars/secrets:

- `DIGITALOCEAN_REGION` default `nyc3`
- `DIGITALOCEAN_VOLUME_SIZE_GIB` default `250`
- `DIGITALOCEAN_VOLUME_MOUNT_ROOT` default `/mnt/alpha-research`
- `DIGITALOCEAN_INGEST_DROPLET_SIZE` default `s-2vcpu-4gb`
- `DIGITALOCEAN_RESEARCH_DROPLET_SIZE_SMALL` default `s-2vcpu-4gb`
- `DIGITALOCEAN_RESEARCH_DROPLET_SIZE_MEDIUM` default `s-4vcpu-8gb`
- `DIGITALOCEAN_RESEARCH_DROPLET_SIZE_LARGE` default `s-8vcpu-16gb`
- `DIGITALOCEAN_INGEST_IMAGE` default `ubuntu-24-04-x64`
- `DIGITALOCEAN_SSH_KEY_IDS` comma-separated key ids
- `DIGITALOCEAN_PROJECT_ID`
- `RESEARCH_DATASET_REPO_REF` default `codex/initial-substrate`

The RESEARCH CLI opens a browser to `https://alpharesearch.nyc/cli/login`, and that endpoint mints a short-lived CLI token if the user already has a valid site session. The CLI planner should call `/api/cli/plan` so signed-in users do not need a local OpenAI key.

## Remote Dataset Deploy Flow

1. `research` registers dataset metadata with the Worker.
2. The CLI requests a pre-signed Spaces upload URL and uploads the raw source file.
3. The Worker provisions or reuses a dataset-specific DigitalOcean volume.
4. The Worker launches a one-off ingest droplet with that volume attached.
5. The droplet downloads the raw source file, runs `normalize_dataset.py`, and writes the normalized dataset onto the mounted volume.
6. The droplet reports run events and final manifest location back to the Worker.
7. The CLI persists the deploy run id and polls event/status updates on reopen.

Remote research runs can request resources through `config.resources`. The control plane honors `runnerSize` as the exact DigitalOcean droplet size and `workspaceDiskGb` as the minimum attached workspace volume size before the runner starts.

## Local Testing

Build the site:

```bash
pnpm build
```

For full auth route testing, run via Wrangler Worker dev so the routed auth handlers and worker secrets are active.

## Codex Plugin

The local Codex plugin for Alpha Research is bundled with the dataset/CLI repo, not this Worker repo:

```bash
cd "/Users/ryanprendergast/Documents/Zenobia Pay/alpha-datasets"
npm install
npm run build
mkdir -p ~/.codex/plugins
rm -rf ~/.codex/plugins/alpha-research
cp -R plugins/alpha-research ~/.codex/plugins/alpha-research
```

The plugin MCP server imports the built RESEARCH CLI runtime and uses the saved `research login` session. Its `.mcp.json` sets `ALPHA_RESEARCH_REPO_ROOT` to the local `alpha-datasets` checkout, so build that repo before opening a new Codex thread with the plugin enabled.

Smoke-test the installed server manually:

```bash
ALPHA_RESEARCH_REPO_ROOT="/Users/ryanprendergast/Documents/Zenobia Pay/alpha-datasets" \
  node ~/.codex/plugins/alpha-research/mcp/server.js <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
EOF
```

The plugin must not print session tokens, auth headers, or signed upload/download URLs. See `docs/codex-plugin-smoke-report.md` for the latest live-account verification transcript.

## Notes

- This project now runs as a Worker with static assets.
- `wrangler.jsonc` stores Worker route and asset configuration.
