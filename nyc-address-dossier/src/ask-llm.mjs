// Phase 7 v2: free-form ask-the-address over a LOCAL model (Ollama, unmetered — house
// rule satisfied: no paid API). The model sees ONLY this lot's event rows; the prompt
// demands per-claim citations and refusal beyond the evidence. The deterministic layer
// (ask.mjs) is the baseline this must beat on the same eval.
//
//   node --experimental-sqlite src/ask-llm.mjs "what is the story of commerce at 328 Lenox Avenue"
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';
import { parseAddress, BORO } from './lookup.mjs';

const Q = process.argv.slice(2).join(' ');
const MODEL = process.env.DOSSIER_MODEL ?? 'llama3.2:3b';

function extractAddress(text) {
  const boroWord = Object.keys(BORO).find((b) => text.toLowerCase().includes(b)) ?? 'manhattan';
  const m = text.match(/(\d[\d-]*)\s+((?:[A-Za-z0-9]+\.?\s+){0,3}(?:st(?:reet)?|ave(?:nue)?|pl(?:ace)?|road|rd|blvd|boulevard|broadway|bowery|pkwy|parkway|drive|dr|court|ct|lane|la|terrace|sq(?:uare)?)\b\.?)/i);
  return m ? { addr: `${m[1]} ${m[2]}`, boro: boroWord } : null;
}

async function main() {
  if (!Q) { console.error('usage: ask-llm.mjs "<question containing an address>"'); process.exit(1); }
  const found = extractAddress(Q);
  if (!found) { console.log('No address found in the question.'); return; }
  const parsed = parseAddress(found.addr, found.boro);
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  const q = async (sql, params = []) => {
    const p = await db.prepare(sql);
    params.forEach((v, i) => p.bindVarchar(i + 1, String(v)));
    return (await p.runAndReadAll()).getRowObjects();
  };
  const hit = (await q(`SELECT bbl FROM pad_addresses
    WHERE boro = ? AND upper(stname) = ?
      AND TRY_CAST(? AS BIGINT) BETWEEN TRY_CAST(lhnd AS BIGINT) AND TRY_CAST(hhnd AS BIGINT)
    ORDER BY (TRY_CAST(? AS BIGINT) % 2) = (TRY_CAST(lhnd AS BIGINT) % 2) DESC LIMIT 1`,
    [parsed.boro, parsed.street, parsed.house, parsed.house]))[0];
  if (!hit) { console.log(`No BBL found for "${found.addr}".`); return; }

  const lot = (await q(`SELECT address, yearbuilt, bldgclass, unitsres, ownername FROM lots WHERE bbl = ?`, [hit.bbl]))[0];
  // Compact, diverse evidence: cap per-kind so 3k permits don't crowd out 3 photos.
  const events = await q(`SELECT * FROM (
      SELECT CAST(date_start AS VARCHAR) AS date, kind, source_id, locator, CAST(payload AS VARCHAR) AS payload,
             row_number() OVER (PARTITION BY kind ORDER BY date_start) AS rn,
             COUNT(*) OVER (PARTITION BY kind) AS kn
      FROM events WHERE bbl = ? AND date_start IS NOT NULL)
    WHERE rn <= 40 ORDER BY date`, [hit.bbl]);
  db.closeSync();

  const evidence = [
    lot ? `LOT: ${lot.address}, built ${lot.yearbuilt}, class ${lot.bldgclass}, owner ${lot.ownername} (cite as [pluto:${hit.bbl}])` : '',
    ...events.map((e) => `${e.date?.slice(0, 10)} ${e.kind} ${e.payload} (cite as [${e.source_id}:${e.locator}])`),
  ].filter(Boolean).join('\n');

  const prompt = `You are answering a question about the history of a New York City building using ONLY the records below. Rules:
- Every factual claim must end with its citation in [source:locator] form, copied exactly from the record used.
- If the records do not answer the question, say exactly what is missing — do not guess, infer, or use outside knowledge.
- Be concise (under 150 words).

RECORDS for ${found.addr.toUpperCase()} (BBL ${hit.bbl}):
${evidence.slice(0, 12000)}

QUESTION: ${Q}

ANSWER:`;

  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.1, num_ctx: 8192 } }),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status} — is the service running?`);
  const out = await res.json();
  console.log(`(${found.addr.toUpperCase()} -> BBL ${hit.bbl}, model ${MODEL}, ${events.length} evidence rows)\n`);
  console.log(out.response.trim());
}

main().catch((e) => { console.error(e); process.exit(1); });
