# External Lead Lists

Drop externally sourced TikTok creator leads here as `.csv`, `.json`, or `.jsonl`, then normalize them with:

```bash
node docs/experiments/tiktok-creative-creator-graph/scripts/import-external-lead-list.mjs --input=docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/example.csv --source-name="Contractor film creator search" --target-label=filmmaker
```

Accepted input columns include:

- `handle`, `username`, `profile_url`, `url`
- `display_name`, `name`
- `bio`, `description`, `snippet`
- `target_label`, `category`
- `source_name`, `source_url`, `source_query`
- `follower_count`, `likes_count`, `video_count`, `verified`

The script writes normalized rows into `data/raw/acquisition-results/` so the existing acquisition import and full workflow can ingest them with provenance.
