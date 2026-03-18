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

## Notes

- This project uses Cloudflare Pages.
- `wrangler.jsonc` stores Pages build/runtime configuration, but the custom domain itself is managed in Cloudflare Pages/DNS rather than declared in `wrangler.jsonc`.
