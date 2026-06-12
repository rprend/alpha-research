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

  const instance = await DuckDBInstance.create(config.duckdbPath);
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
             unitsres, unitstotal, bldgclass, landuse, ownername
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
             trim(lhnd) AS lhnd, trim(hhnd) AS hhnd, trim(stname) AS stname, trim(zipcode) AS zipcode,
             mk_bbl(trim(boro), trim(block), trim(lot)) AS bbl
      FROM read_csv('${padCsv.replace(/'/g, "''")}', header=true, all_varchar=true)
      WHERE trim(stname) != ''`);
    const n = await db.run('SELECT COUNT(*) FROM pad_addresses');
    console.log(`pad_addresses: ${(await n.getRows())[0][0]} address ranges`);
  }

  await sql(`CREATE INDEX IF NOT EXISTS idx_events_bbl ON events (bbl)`);
  const counts = await db.run(`SELECT kind, COUNT(*) FROM events GROUP BY kind ORDER BY 2 DESC`);
  for (const [kind, n] of await counts.getRows()) console.log(`  events/${kind}: ${Number(n).toLocaleString()}`);
  const total = await db.run(`SELECT COUNT(*) AS n, COUNT(DISTINCT bbl) AS lots FROM events`);
  const [n, lots] = (await total.getRows())[0];
  console.log(`TOTAL: ${Number(n).toLocaleString()} events across ${Number(lots).toLocaleString()} distinct BBLs`);
  db.closeSync();
}

run().catch((e) => { console.error(e); process.exit(1); });
