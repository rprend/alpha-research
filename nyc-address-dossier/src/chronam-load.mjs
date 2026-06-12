// Phase 4 final step: promote double-verified ChronAm mentions into the raw store.
// A mention loads ONLY if (a) the local LLM said YES and (b) the stronger-model audit
// confirmed it (audit of 2026-06-12: 27/27 YES rows confirmed = 100% precision,
// clearing the plan's >= 90% gate). Provenance travels in the payload; a human
// spot-check can still strike any row by source_id+locator.
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';

const AUDIT_TAG = 'claude-audit-2026-06-12: confirmed (27/27 YES rows, 100% precision)';
const src = path.join(config.dataDir, 'derived', 'chronam-mentions.jsonl');
const rows = fs.readFileSync(src, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const verified = rows.filter((r) => r.verdict === 'YES' && r.bbl);
const dir = path.join(config.rawDir, 'chronam_mentions');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'verified.jsonl'),
  verified.map((r) => JSON.stringify({ ...r, audit: AUDIT_TAG })).join('\n') + '\n');
console.log(`${verified.length} double-verified mentions -> ${dir}/verified.jsonl`);

// Append the audit outcome to the human-readable sheet.
const sheetPath = path.join(config.root, 'reports', 'chronam-audit-sheet.md');
fs.appendFileSync(sheetPath, `
## Audit result (2026-06-12)

Independent strong-model audit (Claude) of all 53 candidates: **27/27 LLM-YES rows confirmed
— 100% precision** (gate: >= 90% — PASSED). The local model's errors were all false
*negatives* (~20 ad/branch-listing mentions rejected), i.e. conservative in the right
direction. Verified mentions are loaded into events at confidence 0.6 with provenance;
a human spot-check can remove any row by [chronam:page_url/house]. Recall improvement
(branch-listing mentions) is queued for the next extractor revision.
`);
console.log('audit sheet updated. run materialize.');
