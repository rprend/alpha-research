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

These are implemented in Worker-routed handlers under `functions/` and surfaced through [src/worker.ts](/Users/ryanprendergast/Documents/Zenobia%20Pay/alpha-research/src/worker.ts).

Required Worker secrets:

- `WORKOS_API_KEY`
- `WORKOS_CLIENT_ID`
- `ALPHA_RESEARCH_SESSION_SECRET`
- `WORKOS_REDIRECT_URI`
- `OPENAI_API_KEY` for backend planning/proxying

The RESEARCH CLI opens a browser to `https://alpharesearch.nyc/cli/login`, and that endpoint mints a short-lived CLI token if the user already has a valid site session. The CLI planner should call `/api/cli/plan` so signed-in users do not need a local OpenAI key.

## Local Testing

Build the site:

```bash
pnpm build
```

For full auth route testing, run via Wrangler Worker dev so the routed auth handlers and worker secrets are active.

## Notes

- This project now runs as a Worker with static assets.
- `wrangler.jsonc` stores Worker route and asset configuration.
