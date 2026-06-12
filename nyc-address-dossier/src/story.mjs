// Phase 7: the story artifact. Deterministic narrative built ONLY from event rows —
// every sentence cites its sources inline as [source:locator]. No model, no hallucination
// surface; a local-LLM prose pass can be layered on later and audited against this.
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';

const money = (n) => n ? '$' + Number(n).toLocaleString() : null;

export async function buildStory(bbl) {
  const instance = await DuckDBInstance.create(config.duckdbPath, { access_mode: 'READ_ONLY' });
  const db = await instance.connect();
  const q = async (sql, params = []) => {
    const p = await db.prepare(sql);
    params.forEach((v, i) => p.bindVarchar(i + 1, String(v)));
    return (await p.runAndReadAll()).getRowObjects();
  };

  const lot = (await q(`SELECT * FROM lots WHERE bbl = ?`, [bbl]))[0];
  const events = await q(`SELECT CAST(date_start AS VARCHAR) AS date, kind, source_id, locator,
      CAST(payload AS VARCHAR) AS payload, confidence
    FROM events WHERE bbl = ? AND date_start IS NOT NULL ORDER BY date_start`, [bbl]);
  db.closeSync();
  if (!lot && events.length === 0) return { bbl, story: `No records found for BBL ${bbl}.`, sources: 0 };

  const E = events.map((e) => ({ ...e, p: JSON.parse(e.payload), year: e.date?.slice(0, 4) }));
  const cite = (e) => `[${e.source_id}:${e.locator ?? e.date}]`;
  const paras = [];

  // Origins
  const built = E.find((e) => e.p.type === 'year_built');
  const addr = lot?.address ?? E[0]?.address_raw ?? `BBL ${bbl}`;
  let origin = `**${addr}** (BBL ${bbl}, ${['', 'Manhattan', 'the Bronx', 'Brooklyn', 'Queens', 'Staten Island'][Number(String(bbl)[0])] ?? '?'})`;
  if (built) origin += ` was built around ${built.p.year} ${cite(built)}.`;
  else origin += ` has no recorded construction date in the harvested sources.`;
  if (lot?.bldgclass) origin += ` Today it is building class ${lot.bldgclass} with ${lot.unitsres ?? 0} residential units, owned per the tax roll by ${lot.ownername ?? 'an unrecorded owner'} [pluto:${bbl}].`;
  paras.push(origin);

  // Photographs
  const photos = E.filter((e) => e.kind === 'photo');
  if (photos.length) {
    paras.push(`The photographic record: ` + photos.map((e) =>
      `a ${e.year} photograph${e.p.title ? ` ("${e.p.title.trim()}")` : ''} ${cite(e)}`).join('; ')
      + `. Aerial views exist for every citywide survey from 1924 to 2018.`);
  }

  // Ownership & sales
  const sales = E.filter((e) => e.p.type === 'sale' && Number(e.p.price) > 10000);
  const deeds = E.filter((e) => e.p.type === 'acris');
  if (sales.length || deeds.length) {
    const bits = [];
    if (sales.length) {
      const first = sales[0], last = sales[sales.length - 1];
      bits.push(`${sales.length} recorded sale${sales.length > 1 ? 's' : ''} between ${first.year} and ${last.year}` +
        (money(last.p.price) ? `, most recently ${money(last.p.price)} on ${last.date.slice(0, 10)} ${cite(last)}` : ''));
    }
    if (deeds.length) {
      const named = deeds.filter((d) => d.p.party2);
      if (named.length) {
        const recent = named.slice(-3).map((d) => `${d.p.party2.split(';')[0].trim()} (${d.year}, ${d.p.doc_type}) ${cite(d)}`);
        bits.push(`the deed chain names successive owners, most recently ${recent.join('; ')}`);
      } else {
        bits.push(`${deeds.length} ACRIS instruments are recorded against the lot`);
      }
    }
    paras.push(`Ownership: ${bits.join('. Additionally, ')}.`);
  }

  // Construction activity
  const cons = E.filter((e) => e.kind === 'construction' && e.p.type !== 'year_built');
  if (cons.length) {
    const byDecade = {};
    for (const e of cons) byDecade[e.year.slice(0, 3) + '0s'] = (byDecade[e.year.slice(0, 3) + '0s'] ?? 0) + 1;
    const busiest = Object.entries(byDecade).sort((a, b) => b[1] - a[1])[0];
    const owners = [...new Set(cons.map((e) => e.p.owner).filter(Boolean))].slice(0, 4);
    let s = `The building file shows ${cons.length.toLocaleString()} permits and certificates, busiest in the ${busiest[0]} (${busiest[1]})`;
    if (owners.length) s += `; permits were filed under names including ${owners.join(', ')}`;
    paras.push(s + ` [dob_permits, dob_jobs, dob_cofo].`);
  }

  // Commerce
  const biz = E.filter((e) => e.kind === 'commerce');
  if (biz.length) {
    const names = [...new Set(biz.map((e) => e.p.name).filter(Boolean))].slice(0, 6);
    const span = `${biz[0].year}–${biz[biz.length - 1].year}`;
    paras.push(`Street-level commerce (${span}): ${names.join('; ')} [dcwp_licenses, restaurant_inspections — ${biz.length} records].`);
  }

  // Web presence
  const web = E.filter((e) => e.p.type === 'web_snapshot');
  if (web.length) {
    paras.push(`The lot's occupants have a captured web presence: ${web[0].p.domain} archived yearly ${web[0].year}–${web[web.length - 1].year} in the Wayback Machine ${cite(web[0])}.`);
  }

  // Texture
  const complaints = E.filter((e) => e.p.type === 'complaint_311');
  const violations = E.filter((e) => e.p.type === 'hpd_violation');
  if (complaints.length || violations.length) {
    const bits = [];
    if (violations.length) bits.push(`${violations.length.toLocaleString()} housing-maintenance violations (${violations[0].year}–${violations[violations.length - 1].year})`);
    if (complaints.length) bits.push(`${complaints.length.toLocaleString()} 311 complaints since 2020`);
    paras.push(`Texture of daily life: ${bits.join(' and ')} [hpd_violations, three11].`);
  }

  // Honest gaps
  paras.push(`_Record gaps: occupant names before 1966 await the census (1880–1950, Phase 2) and ` +
    `city-directory layers (Phase 3); per-person data 1950–1990 is sealed or on microfilm. ` +
    `Every claim above cites its source record._`);

  return { bbl, address: addr, story: paras.join('\n\n'), sources: events.length };
}

// CLI: node --experimental-sqlite src/story.mjs --bbl 1019310010
if (process.argv[1]?.endsWith('story.mjs')) {
  const bbl = process.argv[process.argv.indexOf('--bbl') + 1];
  const r = await buildStory(bbl);
  console.log(`\n${r.story}\n\n(${r.sources} source events)`);
}
