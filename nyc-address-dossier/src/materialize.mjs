// Dossier v0 materializer: builds data/dossier.duckdb from whatever raw sources have landed.
// Safe to re-run any time; each landed source is rebuilt as a table + mapped into `events`
// (the §2.2 canonical schema: bbl, date, kind, payload, source, confidence).
import fs from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { config } from './config.mjs';

const BORO_NAME = {
  MANHATTAN: '1', BRONX: '2', BROOKLYN: '3', QUEENS: '4', 'STATEN ISLAND': '5',
  MN: '1', BX: '2', BK: '3', QN: '4', SI: '5',
};

function landedSources() {
  if (!fs.existsSync(config.rawDir)) return [];
  return fs.readdirSync(config.rawDir).filter((k) => {
    const dir = path.join(config.rawDir, k);
    return fs.statSync(dir).isDirectory() && fs.readdirSync(dir).some((f) => f.endsWith('.jsonl.gz'));
  });
}

async function run() {
  const landed = landedSources();
  if (landed.length === 0) { console.log('no raw sources landed yet'); return; }
  console.log(`landed sources: ${landed.join(', ')}`);

  // Build into a temp file and atomically rename, so the viewer/CLI can keep
  // reading the previous build while this one runs (DuckDB is single-writer).
  const buildPath = config.duckdbPath + '.building';
  for (const p of [buildPath, buildPath + '.wal']) fs.rmSync(p, { force: true });
  const instance = await DuckDBInstance.create(buildPath);
  const db = await instance.connect();
  const sql = async (q) => { try { return await db.run(q); } catch (e) { console.error(`SQL error: ${e.message}\n  in: ${q.slice(0, 200)}`); throw e; } };

  // Raw tables: one per landed source, read straight from the gzipped JSONL parts.
  for (const key of landed) {
    const glob = path.join(config.rawDir, key, 'part-*.jsonl.gz').replace(/'/g, "''");
    await sql(`CREATE OR REPLACE TABLE raw_${key} AS
      SELECT * FROM read_json('${glob}', format='newline_delimited', union_by_name=true,
                              maximum_object_size=33554432, ignore_errors=true)`);
    const n = await db.run(`SELECT COUNT(*) AS n FROM raw_${key}`);
    console.log(`raw_${key}: ${(await n.getRows())[0][0]} rows`);
  }

  // BBL helpers. PLUTO carries a ready-made bbl; others compose borough+block+lot.
  // norm_boro accepts '1'..'5', numerics, codes, and full names.
  await sql(`CREATE OR REPLACE MACRO norm_boro(b) AS
    CASE upper(trim(CAST(b AS VARCHAR)))
      WHEN '1' THEN '1' WHEN '2' THEN '2' WHEN '3' THEN '3' WHEN '4' THEN '4' WHEN '5' THEN '5'
      WHEN 'MANHATTAN' THEN '1' WHEN 'MN' THEN '1'
      WHEN 'BRONX' THEN '2' WHEN 'BX' THEN '2'
      WHEN 'BROOKLYN' THEN '3' WHEN 'BK' THEN '3'
      WHEN 'QUEENS' THEN '4' WHEN 'QN' THEN '4'
      WHEN 'STATEN ISLAND' THEN '5' WHEN 'SI' THEN '5'
      ELSE CAST(TRY_CAST(b AS INT) AS VARCHAR) END`);
  await sql(`CREATE OR REPLACE MACRO mk_bbl(boro, block, lot) AS
    CASE WHEN norm_boro(boro) IS NULL OR block IS NULL OR lot IS NULL THEN NULL
         ELSE norm_boro(boro) || lpad(CAST(TRY_CAST(block AS BIGINT) AS VARCHAR), 5, '0')
                              || lpad(CAST(TRY_CAST(lot AS BIGINT) AS VARCHAR), 4, '0') END`);
  // PLUTO ships bbl as "1008350041.00000000": normalize to a plain 10-digit string.
  await sql(`CREATE OR REPLACE MACRO norm_bbl(b) AS
    CAST(TRY_CAST(TRY_CAST(b AS DOUBLE) AS BIGINT) AS VARCHAR)`);

  // events: the canonical §2.2 table, rebuilt from scratch each run.
  await sql(`CREATE OR REPLACE TABLE events (
    bbl VARCHAR, address_raw VARCHAR, date_start DATE, date_end DATE,
    kind VARCHAR, payload JSON, source_id VARCHAR, locator VARCHAR,
    extraction_method VARCHAR DEFAULT 'structured', confidence DOUBLE DEFAULT 1.0)`);

  const mappers = {
    dof_rolling_sales: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT mk_bbl(borough, block, lot), address, TRY_CAST(sale_date AS DATE), 'ownership',
             to_json({type: 'sale', price: sale_price, building_class: building_class_at_time_of}),
             'dof_rolling_sales', COALESCE(mk_bbl(borough, block, lot),'') || '/' || COALESCE(sale_date,'')
      FROM raw_dof_rolling_sales WHERE TRY_CAST(sale_price AS BIGINT) > 10000`,
    dof_annualized_sales: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT mk_bbl(borough, block, lot), address, TRY_CAST(sale_date AS DATE), 'ownership',
             to_json({type: 'sale', price: sale_price}),
             'dof_annualized_sales', COALESCE(mk_bbl(borough, block, lot),'') || '/' || COALESCE(sale_date,'')
      FROM raw_dof_annualized_sales WHERE TRY_CAST(sale_price AS BIGINT) > 10000`,
    dob_permits: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT mk_bbl(borough, block, lot),
             trim(COALESCE(house__,'') || ' ' || COALESCE(street_name,'')), TRY_CAST(issuance_date AS DATE), 'construction',
             to_json({type: 'permit', job_type: job_type, work_type: work_type, permit_type: permit_type, owner: owner_s_business_name}),
             'dob_permits', COALESCE(job__,'') || '/' || COALESCE(permit_sequence__,'')
      FROM raw_dob_permits`,
    dob_cofo: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT mk_bbl(borough, block, lot),
             trim(COALESCE(house_number,'') || ' ' || COALESCE(street_name,'')),
             TRY_CAST(COALESCE(c_o_issue_date, issue_date) AS DATE), 'construction',
             to_json({type: 'certificate_of_occupancy', job_number: job_number}),
             'dob_cofo', COALESCE(job_number, '')
      FROM raw_dob_cofo`,
    hpd_violations: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT mk_bbl(boroid, block, lot),
             trim(COALESCE(housenumber,'') || ' ' || COALESCE(streetname,'')),
             TRY_CAST(inspectiondate AS DATE), 'event',
             to_json({type: 'hpd_violation', class: class, description: left(novdescription, 200)}),
             'hpd_violations', CAST(violationid AS VARCHAR)
      FROM raw_hpd_violations`,
    hpd_registrations: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT mk_bbl(boroid, block, lot),
             trim(COALESCE(housenumber,'') || ' ' || COALESCE(streetname,'')),
             TRY_CAST(lastregistrationdate AS DATE), 'ownership',
             to_json({type: 'mdr_registration'}),
             'hpd_registrations', CAST(registrationid AS VARCHAR)
      FROM raw_hpd_registrations`,
    dcwp_licenses: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT norm_bbl(bbl),
             trim(COALESCE(address_building,'') || ' ' || COALESCE(address_street_name,'')),
             TRY_CAST(license_creation_date AS DATE), 'commerce',
             to_json({type: 'license', name: COALESCE(dba_trade_name, business_name),
                      category: business_category, license_type: license_type, status: license_status}),
             'dcwp_licenses', license_nbr
      FROM raw_dcwp_licenses WHERE bbl IS NOT NULL`,
    restaurant_inspections: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT norm_bbl(any_value(bbl)),
             trim(any_value(COALESCE(building,'')) || ' ' || any_value(COALESCE(street,''))),
             TRY_CAST(inspection_date AS DATE), 'commerce',
             to_json({type: 'restaurant_inspection', name: any_value(dba),
                      cuisine: any_value(cuisine_description), grade: any_value(grade), score: max(TRY_CAST(score AS INT))}),
             'restaurant_inspections', camis || '/' || inspection_date
      FROM raw_restaurant_inspections WHERE bbl IS NOT NULL
      GROUP BY camis, inspection_date`,
    three11: `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT bbl, incident_address, TRY_CAST(created_date AS DATE), 'event',
             to_json({type: 'complaint_311', complaint: complaint_type, descriptor: descriptor, status: status}),
             'three11', COALESCE(bbl,'') || '/' || COALESCE(created_date,'')
      FROM raw_three11`,
  };
  // ACRIS: needs the legals->master->parties join; only run when all three have landed.
  if (['acris_master', 'acris_legals', 'acris_parties'].every((k) => landed.includes(k))) {
    mappers.acris = `INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT mk_bbl(CAST(TRY_CAST(l.borough AS INT) AS VARCHAR), l.block, l.lot),
             trim(COALESCE(l.street_number,'') || ' ' || COALESCE(l.street_name,'')),
             TRY_CAST(COALESCE(m.document_date, m.recorded_datetime) AS DATE), 'ownership',
             to_json({type: 'acris', doc_type: m.doc_type, amount: m.document_amt,
                      party1: p1.names, party2: p2.names}),
             'acris', m.document_id
      FROM raw_acris_legals l
      JOIN raw_acris_master m USING (document_id)
      LEFT JOIN (SELECT document_id, string_agg(DISTINCT name, '; ') AS names
                 FROM raw_acris_parties WHERE party_type = '1' GROUP BY document_id) p1 USING (document_id)
      LEFT JOIN (SELECT document_id, string_agg(DISTINCT name, '; ') AS names
                 FROM raw_acris_parties WHERE party_type = '2' GROUP BY document_id) p2 USING (document_id)`;
  }

  for (const [key, q] of Object.entries(mappers)) {
    if (key !== 'acris' && !landed.includes(key)) continue;
    try {
      await sql(q);
      console.log(`mapped ${key} -> events`);
    } catch {
      console.log(`SKIPPED ${key} (column drift? see SQL error above)`);
    }
  }

  // Lot base: PLUTO gives the modern spine (address, cd, yearbuilt, owner).
  if (landed.includes('pluto')) {
    await sql(`CREATE OR REPLACE TABLE lots AS
      SELECT norm_bbl(bbl) AS bbl, address, borough, block, lot, cd, zipcode, yearbuilt, numfloors,
             unitsres, unitstotal, bldgclass, landuse, ownername,
             TRY_CAST(latitude AS DOUBLE) AS latitude, TRY_CAST(longitude AS DOUBLE) AS longitude
      FROM raw_pluto WHERE bbl IS NOT NULL`);
    // PLUTO yearbuilt becomes the construction-origin event.
    await sql(`INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator)
      SELECT norm_bbl(bbl), address, TRY_CAST(CAST(TRY_CAST(yearbuilt AS INT) AS VARCHAR) || '-01-01' AS DATE), 'construction',
             to_json({type: 'year_built', year: yearbuilt}), 'pluto', norm_bbl(bbl)
      FROM raw_pluto WHERE TRY_CAST(yearbuilt AS INT) > 1600`);
  }
  // PAD: address-range -> BBL lookup table for the dossier CLI geocoder.
  // PAD is a blob (extracted zip), not JSONL parts: read bobaadr.txt directly. Values are space-padded.
  const padCsv = path.join(config.rawDir, 'pad', 'extracted', 'bobaadr.txt');
  if (fs.existsSync(padCsv)) {
    await sql(`CREATE OR REPLACE TABLE pad_addresses AS
      SELECT trim(boro) AS boro, trim(block) AS block, trim(lot) AS lot,
             trim(lhnd) AS lhnd, trim(hhnd) AS hhnd,
             regexp_replace(trim(stname), ' +', ' ', 'g') AS stname,  -- PAD pads street names with double spaces
             trim(zipcode) AS zipcode,
             mk_bbl(trim(boro), trim(block), trim(lot)) AS bbl
      FROM read_csv('${padCsv.replace(/'/g, "''")}', header=true, all_varchar=true)
      WHERE trim(stname) != ''`);
    const n = await db.run('SELECT COUNT(*) FROM pad_addresses');
    console.log(`pad_addresses: ${(await n.getRows())[0][0]} address ranges`);
  }

  // OldNYC photos (Phase 1): flatten the geojson once, assign each photo to its
  // nearest lot centroid (~90m search box; photos are geocoded to intersections,
  // so this is an approximation — confidence 0.6, never 1.0).
  const oldnycGeo = path.join(config.rawDir, 'oldnyc', 'images.geojson');
  if (fs.existsSync(oldnycGeo) && landed.includes('pluto')) {
    const flat = path.join(config.rawDir, 'oldnyc', 'photos_flat.jsonl');
    if (!fs.existsSync(flat)) {
      const gj = JSON.parse(fs.readFileSync(oldnycGeo, 'utf8'));
      const lines = gj.features
        .filter((f) => f.geometry?.coordinates?.length === 2)
        .map((f) => JSON.stringify({
          id: String(f.id),
          lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
          date_raw: f.properties?.date ?? null, title: f.properties?.title ?? null,
          page_url: f.properties?.url ?? null,
          photo_url: `https://images.nypl.org/?id=${f.id}&t=w`,
        }));
      fs.writeFileSync(flat, lines.join('\n') + '\n');
      console.log(`oldnyc: flattened ${lines.length} geocoded photos`);
    }
    await sql(`CREATE OR REPLACE TABLE oldnyc_photos AS
      SELECT * FROM read_json('${flat.replace(/'/g, "''")}', format='newline_delimited', union_by_name=true)`);
    await sql(`CREATE OR REPLACE TABLE oldnyc_bbl AS
      SELECT p.*, l.bbl,
             (p.lat - l.latitude) * (p.lat - l.latitude)
               + (0.758 * (p.lon - l.longitude)) * (0.758 * (p.lon - l.longitude)) AS d2
      FROM oldnyc_photos p
      JOIN lots l ON l.latitude  BETWEEN p.lat - 0.0008 AND p.lat + 0.0008
                 AND l.longitude BETWEEN p.lon - 0.0011 AND p.lon + 0.0011
      QUALIFY row_number() OVER (PARTITION BY p.id ORDER BY d2) = 1`);
    await sql(`INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator, extraction_method, confidence)
      SELECT bbl, title,
             TRY_CAST(regexp_extract(date_raw, '(18|19|20)[0-9]{2}') || '-01-01' AS DATE),
             'photo',
             to_json({type: 'photo_oldnyc', title: title, page_url: page_url, photo_url: photo_url}),
             'oldnyc', id, 'structured', 0.6
      FROM oldnyc_bbl`);
    console.log('mapped oldnyc -> events (nearest-lot, confidence 0.6)');
  }

  // 1940 tax photos (Phase 1 pilot): BBL-keyed natively -> confidence 1.0.
  const taxMeta = path.join(config.rawDir, 'taxphotos_1940', 'photos.jsonl');
  if (fs.existsSync(taxMeta)) {
    await sql(`INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator, extraction_method, confidence)
      SELECT bbl, address, DATE '1940-01-01', 'photo',
             to_json({type: 'tax_photo_1940', title: 'Municipal tax photograph (1939-41)',
                      photo_url: photo_url, page_url: page_url, credit: credit}),
             'taxphoto_1940', identifier, 'structured', 1.0
      FROM read_json('${taxMeta.replace(/'/g, "''")}', format='newline_delimited', union_by_name=true)`);
    console.log('mapped taxphotos_1940 -> events');
  }

  // ChronAm mentions (Phase 4): only double-verified rows (LLM YES + strong-model audit).
  const chronamVerified = path.join(config.rawDir, 'chronam_mentions', 'verified.jsonl');
  if (fs.existsSync(chronamVerified)) {
    await sql(`INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator, extraction_method, confidence)
      SELECT bbl, house || ' WEST 125 STREET', TRY_CAST(date AS DATE), 'mention',
             to_json({type: 'newspaper_mention', paper: paper, page_url: page_url,
                      excerpt: left(snippet, 240), provenance: audit}),
             'chronam', page_url || '/' || house, 'ocr+rules+llm', 0.6
      FROM read_json('${chronamVerified.replace(/'/g, "''")}', format='newline_delimited', union_by_name=true)`);
    console.log('mapped chronam_mentions -> events (double-verified only)');
  }

  // Wayback snapshots (Phase 6): curated domain->address mappings, one event per year.
  const waybackDir = path.join(config.rawDir, 'wayback');
  if (fs.existsSync(waybackDir) && fs.readdirSync(waybackDir).some((f) => f.endsWith('.jsonl'))) {
    const wbGlob = path.join(waybackDir, '*.jsonl').replace(/'/g, "''");
    await sql(`INSERT INTO events (bbl, address_raw, date_start, kind, payload, source_id, locator, extraction_method, confidence)
      SELECT bbl, address_raw, TRY_CAST(year || '-01-01' AS DATE), 'mention',
             to_json({type: 'web_snapshot', domain: domain, snapshot_url: snapshot_url}),
             'wayback', domain || '/' || year, 'structured', 0.9
      FROM read_json('${wbGlob}', format='newline_delimited', union_by_name=true)`);
    console.log('mapped wayback -> events');
  }

  await sql(`CREATE INDEX IF NOT EXISTS idx_events_bbl ON events (bbl)`);
  const counts = await db.run(`SELECT kind, COUNT(*) FROM events GROUP BY kind ORDER BY 2 DESC`);
  for (const [kind, n] of await counts.getRows()) console.log(`  events/${kind}: ${Number(n).toLocaleString()}`);
  const total = await db.run(`SELECT COUNT(*) AS n, COUNT(DISTINCT bbl) AS lots FROM events`);
  const [n, lots] = (await total.getRows())[0];
  console.log(`TOTAL: ${Number(n).toLocaleString()} events across ${Number(lots).toLocaleString()} distinct BBLs`);
  db.closeSync();
  instance.closeSync?.();
  // Atomic swap: readers opening after this see the new build.
  fs.rmSync(config.duckdbPath + '.wal', { force: true });
  fs.renameSync(buildPath, config.duckdbPath);
  console.log(`swapped in ${config.duckdbPath}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
