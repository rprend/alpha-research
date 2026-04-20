# alpha-research

Landing page scaffold for alpha-research.

Purpose: enable decision makers to test 100x more hypotheses.

We built an open-source research platform for large datasets.

## Scripts

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm preview`
- `pnpm run cf:deploy`

## Cloudflare

- Pages project: `alpha-research`
- Production domain: `alpharesearch.nyc`
- Account: `Founders@zenobiapay.com's Account`
- Production deploy: `pnpm run cf:deploy`
- Pages Functions now handle auth and CLI handoff routes

## Auth

The landing page now includes:

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /cli/login`

These are implemented with Cloudflare Pages Functions under `functions/`.

Required Cloudflare Pages secrets:

- `ALPHA_RESEARCH_OWNER_EMAIL`
- `ALPHA_RESEARCH_OWNER_PASSWORD`
- `ALPHA_RESEARCH_SESSION_SECRET`

The current model is intentionally single-account and owner-only. The RESEARCH CLI opens a browser to `https://alpharesearch.nyc/cli/login`, and that endpoint mints a short-lived CLI token if the user already has a valid site session.

## Local Testing

Build the site:

```bash
pnpm build
```

For full auth route testing, run via Wrangler Pages dev so the `functions/` routes are active and env vars are available.

## Notes

- This project uses Cloudflare Pages.
- `wrangler.jsonc` stores Pages build/runtime configuration, but the custom domain itself is managed in Cloudflare Pages/DNS rather than declared in `wrangler.jsonc`.
