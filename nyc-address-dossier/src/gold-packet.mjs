// Gold annotation packet generator (Phases 2/3): samples pages from a parsed directory
// volume and emits, per page, (a) the raw OCR text and (b) a pre-filled draft from the
// parser for each annotator to CORRECT independently. Correcting a draft is several times
// faster than transcribing from scratch, and independence holds as long as the two
// annotators don't see each other's corrections. κ is computed on the corrected files.
//
//   node src/gold-packet.mjs --slug brooklyn-1912 --pages 20
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map((s) => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ')]; }));
const SLUG = args.slug ?? 'brooklyn-1912';
const N_PAGES = Number(args.pages ?? 20);
const LINES_PER_PAGE = 60; // OCR lines per "page" sample window

const SOURCE_FILES = { 'brooklyn-1912': 'brooklynnewyorkc1912broo.txt' };

function main() {
  const entriesPath = path.join(config.dataDir, 'derived', `directory-${SLUG}.jsonl`);
  const sourcePath = path.join(config.rawDir, 'ia_directories', SOURCE_FILES[SLUG]);
  const entries = fs.readFileSync(entriesPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const sourceLines = fs.readFileSync(sourcePath, 'utf8').split('\n');

  // Deterministic sample: evenly spaced windows across the entry-bearing region.
  const lineNumbers = entries.map((e) => e.line);
  const lo = Math.min(...lineNumbers), hi = Math.max(...lineNumbers);
  const starts = Array.from({ length: N_PAGES }, (_, i) =>
    Math.floor(lo + (i + 0.5) * (hi - lo) / N_PAGES));

  const packetDir = path.join(config.root, 'gold-packets', SLUG);
  for (const annotator of ['annotator-A', 'annotator-B']) {
    fs.mkdirSync(path.join(packetDir, annotator), { recursive: true });
  }

  for (const [i, start] of starts.entries()) {
    const end = start + LINES_PER_PAGE;
    const pageId = `${SLUG}-w${String(i).padStart(2, '0')}-L${start}`;
    const ocr = sourceLines.slice(start, end)
      .map((l, j) => `${String(start + j).padStart(6)} | ${l}`).join('\n');
    const draft = entries.filter((e) => e.line >= start && e.line < end)
      .map((e) => ({ line: e.line, surname: e.surname, given: e.given,
        occupation: e.occupation, marker: e.marker, house: e.house, street: e.street_raw }));
    fs.writeFileSync(path.join(packetDir, `${pageId}.ocr.txt`), ocr);
    for (const annotator of ['annotator-A', 'annotator-B']) {
      fs.writeFileSync(path.join(packetDir, annotator, `${pageId}.json`),
        JSON.stringify({ page_id: pageId, source: SOURCE_FILES[SLUG],
          lines: [start, end],
          instructions: 'Correct every row against the OCR text (add missed entries, fix fields, delete false entries). Do not consult the other annotator.',
          rows: draft }, null, 1));
    }
  }

  fs.writeFileSync(path.join(packetDir, 'README.md'), `# Gold packet — ${SLUG}

${N_PAGES} sampled windows (${LINES_PER_PAGE} OCR lines each) across the volume.

Protocol:
1. Annotator A corrects every \`annotator-A/*.json\` against the matching \`*.ocr.txt\`; B likewise, independently.
2. Adjudicate disagreements together; the adjudicated files become \`gold/\`.
3. Record per-field agreement (Cohen's κ) in \`KAPPA.md\`.
4. Score the parser: precision/recall vs gold. Plan gate: ≥95% precision / ≥90% recall
   before parsed entries enter dossier events.

The draft rows are the PARSER'S OUTPUT — they are there to speed correction, not to be trusted.
`);
  console.log(`packet: ${packetDir} (${N_PAGES} windows × 2 annotators, drafts pre-filled)`);
}

main();
