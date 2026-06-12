# NYC Address Dossier: Every Address, Every Era, 1786 → Present

**Status:** Plan (2026-06-12) · no build started, no spend approved
**Goal:** A per-address (per-BBL) dossier for New York City — who lived there and when they moved, who owned it, what was built and demolished, what businesses operated, what happened there, with photos — assembled from primary sources, queryable in natural language, and browsable on a map. Runs end-to-end on a laptop.
**Relationship to other plans:** Supersets [nyc-retail-timemap-plan.md](nyc-retail-timemap-plan.md). The retail time-map is effectively Phase 1b of this project: it builds the BBL spine, the tax-photo join, and the evidence-pin UI that the dossier inherits. Build both against the same spine.

---

## 1. The shape of the record: three regimes

Coverage is not uniform in time. The plan is organized around three regimes with different physics:

| Regime | Years | Character | Backbone sources |
|---|---|---|---|
| **Archival era** | 1786–1950 | Scanned but unstructured; extraction problem | City directories (1786–1933/34), voter lists, federal census 1880–1950 (addresses from 1880), NY State census 1905/15/25, Real Estate Record 1868–1922, deeds, draft cards, newspapers, 1940 tax photos, 1924/1951 aerials |
| **The middle era** | 1950–1990 | Records exist but mostly on microfilm/print — a digitization gap plus the census privacy wall, not an archival gap | Reverse/criss-cross directories (1929–present, by address, annual), 1980s tax photos, Yellow Pages, D&B, ACRIS from 1966, permits/COs, USGS aerials, LOC/MCNY/Municipal Archives photo collections, NHGIS block stats |
| **Data-exhaust era** | 1990–present | Born-structured; ingestion problem, plus a privacy problem | NYC Open Data (ACRIS, DOB, HPD, DOF, licenses, 311, inspections), biennial aerials, Street View, Wayback Machine |

Two hard walls to design around:

- **The 1950 privacy wall.** Federal census records unseal after 72 years: 1950 opened in 2022; **1960 opens April 2032**, 1970 in 2042. Per-person occupancy data goes dark 1950→present by law, not by digitization gaps. The dossier's "who lived here" layer is rich to 1950, then degrades to owners-and-businesses-only. Plan for the 2032 unsealing as a future data drop, not a blocker.
- **The living-persons line.** Post-1990 sources name living people. Policy (see §8): the dossier displays only public-records-by-design (property ownership, business licenses, permits) for the modern era; no voter-file display, no aggregation that re-identifies tenants.

Archive.org's role, precisely: it carries the **1786–1934 text layer** (directories, voter lists, gray literature — the NYPL directory scans live on IA) and the **1996–present web layer** (Wayback captures of business sites, menus, real-estate listings). The 60 years in between belong to municipal and federal records that are not on IA.

---

## 2. Spine and data model

### 2.1 BBL is the master key

Everything joins on borough-block-lot, exactly as in the retail plan: tax photos are BBL-keyed natively, deeds and assessments are lot-keyed natively, and MapPLUTO/PAD give the modern polygon + address ranges (~860k lots, ~1M addresses). Address strings are a *view* onto BBL, era-dependent (see §6, gazetteer).

### 2.2 Event-sourced dossier

One append-only table of evidence-bearing events; the dossier is a query, not a document:

```
{ bbl,                    // master key (nullable until geocoded; keep address_raw)
  address_raw,            // as it appears in the source
  address_era,            // which gazetteer epoch the string belongs to
  date_start, date_end,   // point or range; ISO, year-precision OK
  kind,                   // occupancy | ownership | construction | commerce |
                          //   event | photo | assessment | mention
  payload,                // kind-specific JSON (name, occupation, instrument type, …)
  source_id, locator,     // corpus + page/frame/document id — every row cites
  extraction_method,      // structured | regex | ocr+rules | vlm | manual
  confidence }            // calibrated against gold per corpus
```

Storage: Parquet partitioned by source, DuckDB for queries, one materialized JSON dossier per BBL for the QA layer. SQLite for the gazetteer. No server anywhere — the published artifact is static files (PMTiles + JSON), same architecture as the retail plan.

---

## 3. Source inventory by regime

### 3.1 Archival era (1786–1950)

| Source | Yields per address | Access | Laptop cost |
|---|---|---|---|
| City directories 1786–1933 (IA, NYPL scans) | ~100–300 dated name+occupation entries (head-of-household biased) | IA bulk: existing OCR text (`djvu.txt`) free per item; page images only where re-OCR needed | OCR text ~2–5 GB; images deferred |
| Voter enrollment lists (IA/HathiTrust, by address!) | Potentially hundreds of voter-year entries | Same IA pattern; coverage spotty by year — inventory first | ~GBs text |
| Federal census 1880–1950 | Full household roster each decade; 1940 includes "residence in 1935" | NARA (1950: free images + name index + API), FamilySearch (free, not bulk), **IPUMS full-count for bulk** (verify address-field terms) | Pilot: per-ED image pulls; city scale: IPUMS extract, ~GBs |
| NY State census 1892/1905/1915/1925 | Mid-decade rosters; 1892 partially substitutes for the burned 1890 federal census (borough survival varies — verify) | FamilySearch browse; not bulk | Pilot-scale manual/VLM |
| WWI + WWII draft cards | Every adult male: address, employer | FamilySearch/Fold3; indexed, not bulk | Pilot-scale |
| Real Estate Record 1868–1922 | Every conveyance, mortgage, permit (Mhtn/Bx) | Columbia CORE, page images + OCR | ~tens of GB if mirrored; fetch-on-demand instead |
| Pre-1966 deeds + grantor/grantee indexes | Ownership chain to the farm grants | FamilySearch microfilm scans, browse-only, some center-restricted — dark corpus, pilot only | on-demand |
| Newspapers (Chronicling America, NYS Historic Newspapers, Brooklyn Eagle) | 10–100 mentions median; 10³–10⁵ for notable buildings | **ChronAm bulk OCR downloads** (filter to NYC titles); NYSHN per-title | ~tens of GB compressed text, filterable |
| 1940 tax photos (~720k) + 1980s (~900k) | ≥1 photo per era per lot | Municipal Archives / DORIS outreach (retail plan, week 1) | metadata + pilot thumbnails only; full res stays remote |
| 1924 + 1951 aerials | 1 rooftop view each | NYC GIS tile services | store tile URLs per lot, not tiles |
| OldNYC geocoded NYPL photos (~40k) | Long-tail street photos, Manhattan-skewed | **Already extracted — dataset on GitHub** | <1 GB, day one |
| LPC designation reports (~37k properties) | Researched building histories, free PDFs | lpc site / NYC Open Data index | ~GBs PDF, pilot districts first |

### 3.2 The middle era (1950–1990): a digitization gap, not an archival gap

An earlier draft called this "the thin middle." That's true only of *bulk-downloadable digitized* data. The records themselves largely exist — the corrected inventory:

**Occupancy never actually stops.** Reverse ("criss-cross"/address) directories — annual listings organized by street address — run continuously through the era: NYPL's holdings for NYC and suburbs cover **1929 to present** (microfilm; microfiche 1976–2005), and Cole's Cross Reference Directories (Manhattan/Brooklyn/Queens) run 1971–present. They list phone subscribers — near-universal household coverage by the 1960s. Full white-pages and Yellow Pages runs exist for every year as well. None of it is digitized; all of it is sitting in the Milstein microform room.

**Digitized and ingestable today:**
- **ACRIS 1966+** — ownership and mortgage chains never gap; pre-1966 libers via FamilySearch microfilm scans (§3.1).
- **DOB Certificates of Occupancy** — per-BBL PDFs in BIS spanning the era.
- **Office for Metropolitan History permit database** — searchable abstracts of every Manhattan New Building application **1900–1986** (free, online at metrohistory.com); the construction-history stream runs straight through the middle era (see §3.4).
- **1980s tax photos** (~900k) — the era's visual census.
- **USGS single-frame aerial passes** over NYC through the 1950s–80s, free via EarthExplorer, in addition to the 1951 city ortho.
- **LOC photo collections:** NY World-Telegram & Sun newspaper morgue (~1M items to 1967, partly digitized); Gottscho-Schleisner commissions into the 1970s; **Camilo José Vergara's rephotography archive** (~20k images, 1970s–2020s — the same Harlem/Bronx/Brooklyn addresses reshot every few years; the canonical middle-era storefront source).
- **Municipal Archives online gallery** (870k+ items beyond the tax photos): NYPD photo unit **1914–1975** (30k digitized, address-tagged incident scenes), DOT/bridges/agency photography.
- **MCNY digitized:** Edmund Vincent Gillon (1970s–80s building photography), Wurts Bros. per-address commissions to 1965.
- **NHGIS census block/tract tables 1940–1990** — block-level housing statistics (units, rent, value, crowding) every decade; the statistical floor under the sealed person-level data.
- **Newspapers:** Brooklyn Eagle to 1955 free; NYS Historic Newspapers select titles into the era; NYT for the whole era (licensed TimesMachine); Reclaim The Records–liberated indexes (e.g., NYC marriage license index 1950–1995, on IA) for person-linking.

**Exists on microfilm/print — library-scanning targets, not downloads:** the reverse directories above (the single highest-value digitization target in this entire project); D&B Reference Books (quarterly, credit-rated business listings); voter enrollment lists into the 1950s+; annual tax assessment rolls per lot; Manhattan Land Book editions updated throughout the era (Sanborn updates run into the 1970s; Digital Sanborn licensed coverage ends ~1970); BSA variance decisions; the City Record; community board files.

**Exists but restricted:** rent control/stabilization registrations (DHCR), NYCHA tenant records (LaGuardia & Wagner Archives), post-1950 federal census (1960 unseals April 2032).

Plan consequence: ownership/permits for this era are already covered by Phases 0/5; photos are far better than the tax-photos-only assumption (Phase 1 ingests Vergara, NYPD, MCNY metadata, USGS frames); occupancy is *available but gated on microfilm* — handled as a budgeted sampling workstream (Phase 3b), not written off. The only true wall is sealed census microdata.

### 3.3 Data-exhaust era (1990–present) — the 21st-century continuation

All bulk, all free, all structured; this is Phase 0 because it requires zero extraction:

| Source | Yields per address | Size (est.) |
|---|---|---|
| **ACRIS** (master/legals/parties, 1966→present, daily updates) | Complete ownership + mortgage chain with party names | ~10–20 GB CSV |
| **MapPLUTO + PAD** (+ archived PLUTO vintages ~2002+) | Polygon, address ranges, yearly land-use/building snapshot | ~2 GB |
| **DOB**: BIS permits (1989+), DOB NOW (2016+), COs, violations | Construction history, legal use changes | ~5 GB |
| **HPD**: registrations, violations, complaints | Current owner/agent names per multifamily building; condition history | ~2 GB |
| **DOF rolling/annualized sales (2003+)** + assessment rolls | Price history | ~1 GB |
| **DCWP business licenses, SLA liquor licenses, DOHMH restaurant inspections** | Named businesses per address, dated | ~2 GB |
| **311 (2010+)** | Texture-of-life events (filter to address-resolved) | ~5–15 GB filtered |
| **Aerial orthophotos** 1996, 2001, '04, '06, '08, '10, '12, '14, '16, '18, '20, '22, '24 | Rooftop view every ~2 years | tile URLs only |
| **Street View (2007+)** | Street-level photo, multiple vintages | metadata API only; historical-pano bulk access is ToS-restricted — record pano dates + links, don't scrape imagery |
| **Wayback Machine CDX API** | Archived business websites, StreetEasy/Zillow listings (interior photos, asking prices), menus | on-demand per address/business name |
| NYT Article Search API (1851→present) | Headline + abstract mentions, both regimes | metadata only, free tier |

So yes: continuous coverage to the present. A dossier for a typical lot reads: census rosters 1880–1950 → directory entries → deed chain 1966–2026 → permits, sales, licenses → last month's 311 noise complaint, with photos in 1924, 1940, 1951, ~1985, biennially from 1996, and street-level from 2007.

### 3.4 The official-records trick (era-spanning, place-generalizing)

The Real Estate Record & Builders' Guide was never a primary source — it was a weekly *digest* of two official filing streams (the Register's conveyances/mortgages and the Buildings Department's permit applications) that have flowed continuously since the 1600s and 1866 respectively. Wherever the famous digest is missing, either go to the stream or find another digest:

- **Office for Metropolitan History NB database** — abstracts of every Manhattan New Building application **1900–1986**, searchable free online (Christopher Gray's project, maintained and expanded since his death). The direct RERBG successor for construction, spanning the entire middle era.
- **Newspaper official-records columns** — dailies printed the day's recorded transfers, mortgages, and "plans filed" for over a century: NYT columns from the 1850s on (TimesMachine, licensed), Brooklyn Eagle for Brooklyn (free to 1955), Herald Tribune and others. The columns got digitized wholesale as a side effect of newspaper digitization; parse them exactly like RERBG pages (Phase 4 gains a column-extraction subtask).
- **Post-1922 Record & Guide** — publication continued past Columbia's 1868–1922 scan range; the later run sits undigitized at Avery and NYPL (paper/microfilm). Targeted-scanning candidate, same workstream as Phase 3b.
- **The primary streams themselves** — grantor/grantee indexes + libers (FamilySearch scans, → ACRIS at 1966) and DOB docket books (→ BIS). These never gap; everything else is convenience tabulation on top of them.
- **Beyond NYC, the same ecology repeats** — Philadelphia had its own *Real Estate Record and Builders' Guide* (volumes on IA; a CLIR digitization project is underway), Chicago had *The Economist*, and the *American Contractor* printed weekly permit lists for dozens of cities (HathiTrust trade-journal scans); F.W. Dodge construction reports run 1891–present (proprietary). And the title-insurance industry maintains complete per-parcel "title plants" for most US counties — commercially licensable (CoreLogic, First American) if any project ever needs to buy completeness instead of extracting it.

### 3.5 Era coverage matrix — what autonomous laptop acquisition actually delivers

Legend: ✅ autonomous (free, bulk/API-accessible, in-queue) · ◐ partial — pilot-depth autonomous, city scale gated on human errands (microfilm days, bulk asks) · ◔ structurally limited (sealed records or deliberate privacy policy, not fixable by compute)

| Era | Occupants ("who lived here") | Owners | Building events | Businesses | Photos |
|---|---|---|---|---|---|
| **Turn of the century** (1880–1910) | ✅ directories, voter lists, census 1880/1900/1910 (+1892/1905 state) | ✅ RERBG conveyances; libers at pilot depth | ✅ RERBG permits; OMH from 1900 | ✅ directories, RERBG | ◐ atlases, OldNYC tail, 1924 aerial |
| **1910–1945** | ✅ directories to 1933, census to 1940, draft cards (pilot) | ✅ RERBG to 1922 → libers (pilot) | ✅ OMH 1900–1986, COs | ✅ 1940 Yellow Pages, directories | ✅ 1940 tax photos, 1924/1951 aerials, NYPD, press morgues |
| **Post-war** (1945–1966) | ◐ 1950 census autonomous; reverse directories = microfilm errands | ◐ libers (pilot) → ACRIS at 1966 | ✅ OMH, COs | ◐ Yellow Pages/D&B on microfilm | ✅ 1951 ortho, USGS passes, NYWTS morgue to 1967, MCNY |
| **Late 20th c.** (1966–1990) | ◔ weakest layer: owners-as-proxy (ACRIS) + reverse-directory sampling; census sealed (1960→2032, 1970→2042) | ✅ ACRIS, fully autonomous | ✅ OMH to 1986, DOB, COs | ◐ Yellow Pages/D&B microfilm; some licenses | ✅ ~1985 tax photos, Vergara, Gillon, USGS |
| **1990–present** | ◔ by design: owners/licensees only (§8 privacy policy) | ✅ ACRIS | ✅ DOB/NOW, COs | ✅ licenses, inspections, Wayback | ✅ biennial orthos, Street View vintages |

Read across: the "story of the people" is autonomous and deep for 1880–1950, owner-grade for 1966–present, and tenant-grade in 1950–1990 only at pilot depth until microfilm scanning or the 2032/2042 census unsealings. That is the honest shape of the product; the UI says so per §8.

---

## 4. Pipeline phases (laptop-budgeted)

Standing rule applies throughout: **mock/dry-run mode for anything that calls a paid API; every paid run gets a cost estimate and explicit approval first.** Local models (Ollama/MLX) are unmetered and preferred wherever quality permits.

### 4.0 Operations: the autonomous harvester

Design constraint: one laptop, left running for weeks to months, safe to interrupt at any second, polite to every remote host, zero paid calls without a human gate.

**Architecture — one supervisor, one queue, idempotent workers.**
- A SQLite `jobs` table: `(job_id, source, kind: fetch|verify|extract|geocode|qa|materialize, payload, status, attempts, not_before, last_error)`. A single supervisor loop pulls eligible jobs subject to per-host token buckets and disk watermarks.
- Every worker is idempotent: the raw store is content-addressed (URL + ETag), extraction outputs are keyed by `(source_id, locator, extractor_version)`. `kill -9` at any moment loses at most the in-flight unit; restart resumes from the journal.
- Runs as a macOS `launchd` agent (`KeepAlive`), holds `caffeinate -is` only while jobs are in flight, `nice -n 10`, local-LLM concurrency capped at (performance cores − 2). Optional quiet-hours config: heavy OCR/LLM passes overnight, light fetches anytime.
- **Disk watermarks:** fetch jobs pause below 100 GB free, everything halts below 40 GB. Raw store zstd-compressed. Keep raw + final; derived intermediates are pruned automatically once their materialization passes QA. Optional external-SSD mount path in config for page images.

**Politeness/ToS tiers.** Autonomous tier (in-queue): NYC Open Data via Socrata app token, bulk exports preferred; IA bulk OCR text at ≤1 concurrent with multi-second spacing; ChronAm bulk batch files (built for this); LOC JSON API within published rate guidance; NARA 1950 census API, gently; USGS M2M API (free account); Wayback CDX ≤1 req/s; NYT API free-tier daily caps. **Never autonomously fetched:** Preservica galleries (DORIS ask first), FamilySearch (account-gated, no bulk), metrohistory.com (small independent site — email the maintainer for the database before any crawling), anything licensed.

**Continuous QA + prune loop** (the "as long as it takes" mechanics):
- Per extraction batch: 1–2% random sample re-judged by a second local-model pass against the source page; metrics appended to `quality.parquet`; below-threshold batches auto-quarantined and re-queued under the alternate extractor; repeat failures go to the human-review queue.
- Nightly: dedup/compaction (content hashes; entity-resolution pass merging `(name, address, year)` across sources), geocode-rate recomputation, dossier re-materialization for touched BBLs.
- Weekly: regenerate `status.md` — jobs by state, GB by source, rows extracted, geocode rate by borough-decade, QA trend lines, and the `blocked_on_human` ticket list. The file is the dashboard; no server.

**Human-gate queue.** The supervisor never attempts: paid API runs (house rule — mock first, per-run approval with cost estimate), microfilm digitization (Phases 3b / post-1922 R&G), licensed corpora, or bulk-access asks (DORIS, OMH, IPUMS). It accumulates them as tickets in `status.md`, so human time is spent in batched errands — a library day, an email — not babysitting the machine.

**Wall-clock estimate** (Apple-silicon laptop, polite rates, rough): structured downloads ~1 week; IA text + ChronAm filtering ~1–2 weeks; local-LLM directory/voter parsing ~3–8 weeks continuous; census pilot ED extraction ~1–2 weeks; geocoding/QA/materialization overlap throughout. Order of **2–3 months unattended** to reach: citywide modern spine + citywide directory-era text layer + pilot-CD full-depth dossiers. The queue drains to a defined end state — zero eligible jobs plus the outstanding human-gate list — it does not run forever.

Pilot geography: **one Community District containing the retail plan's corridor** (e.g., Manhattan CD10/Harlem for 125th St, or CD3 for Orchard/Delancey) — shared gold sets, shared DORIS ask. City-scale follows per-corpus, not per-neighborhood.

### Phase 0 — Modern spine (structured downloads only; ~40–60 GB; a weekend of downloads, zero model calls, zero spend)
1. Download MapPLUTO, PAD, ACRIS bulk, DOB, HPD, DOF sales, licenses, inspections, filtered 311.
2. Load to DuckDB; normalize addresses through PAD; key everything to BBL.
3. Emit **dossier v0 for all ~860k lots**: ownership 1966→present, permits, sales, licenses, complaints.
4. Minimal viewer: MapLibre + PMTiles, click a lot → timeline.
- **Gate:** dossier v0 renders for 100 spot-checked lots; ACRIS party names match a handful of known building histories.
- *Working product in week one, before any historical extraction.*

### Phase 1 — Photo spine
1. Ingest OldNYC GitHub dataset (geocoded already). 2. DORIS outreach for tax-photo metadata/bulk (longest lead item — send week 1). 3. Pilot-CD thumbnails for both tax-photo eras. 4. Per-lot aerial tile URLs for every vintage, plus USGS EarthExplorer frame metadata for 1950s–80s passes. 5. Street View metadata (dates of available panos per address). 6. Middle-era photo ingest: Vergara archive metadata (LOC), NYPD 1914–1975 collection (Municipal gallery), MCNY Gillon/Wurts metadata — captions carry addresses; run them through the gazetteer like any text source.
- **Gate:** every pilot lot shows its photo timeline; tax-photo join coverage reported (expect drift on urban-renewal blocks).

### Phase 2 — Census occupants (1880–1950)
1. Pilot: address → ED via Steve Morse/NARA tools; pull ED page images (public domain); extract rosters with a **local VLM**, mock-harness + hand-labeled gold pages first (two annotators, κ reported — same protocol as retail plan Phase 0).
2. City scale: IPUMS full-count extract if address fields/terms permit (verify early); else 1950 via NARA's index/API first, 1940 second.
- **Gate:** roster extraction ≥95% name-level recall on gold ED pages before scaling beyond pilot.

### Phase 3 — Directory & voter-list text (1786–1933)
1. Inventory IA items (directories + voter lists); bulk-download **existing IA OCR text** (~2–5 GB) — parse that first with rules + local-LLM cleanup; re-OCR with a VLM only the pages where parsing fails QA.
2. Parse entries → (name, occupation, address_raw, year); geocode through the era gazetteer (§6).
3. Voter lists: same pipeline; they're address-organized, so parsing is easier and yield is higher.
- **Gate:** entry-level precision ≥95% / recall ≥90% on gold pages per decade bucket (type quality varies by era); geocode rate reported per borough-decade.

### Phase 3b — Middle-era occupancy sampling (1950–1990, reverse directories)
1. NYPL Milstein microform room day-trips: photograph pilot-CD street pages from the reverse directories at 5-year intervals (≈8 snapshots × pilot streets — a few library days with a phone camera/film scanner).
2. Feed through the same parse pipeline as Phase 3 (these are cleaner, address-organized layouts).
3. Output: per-address occupant timelines 1950–1990 for the pilot CD, closing the era gap there end-to-end.
- City scale is explicitly out of laptop scope — it's a negotiated digitization project (NYPL partnership) or licensed data (Ancestry/ProQuest hold some runs); the pilot proves the value to justify either.
- **Gate:** same parse-quality bar as Phase 3.

### Phase 4 — Newspapers
1. ChronAm bulk OCR for NYC titles + NYS Historic Newspapers; address-candidate regex pass (cheap, local) → era geocoder → store as `mention` events with low default confidence.
2. Precision over recall: a wrong address on a crime story is worse than a missed one. Local-LLM verification pass on candidates before they enter dossiers.
- **Gate:** mention precision ≥90% on a 200-sample audit.

### Phase 5 — Ownership deep history (pilot only)
FamilySearch grantor/grantee index images for pilot blocks → VLM extraction → chain pre-1966 deeds to ACRIS. Center-restricted films noted, not fetched. City scale is a future negotiated-access project, not a laptop task.

### Phase 6 — Web layer (1996–present)
Per pilot address: Wayback CDX queries for known business names/domains (from licenses + signage OCR in the retail project) + StreetEasy/Zillow capture URLs. Store links + snippets, not mirrored sites.

### Phase 7 — Ask-the-address layer
1. Materialize per-BBL JSON dossiers. 2. Local embeddings (e.g., nomic-embed via Ollama) + sqlite-vec; RAG answers **must cite event rows**, and refuse beyond the evidence ("records sealed 1950–1990" is a feature answer). 3. **The story artifact:** per-BBL generated narrative timeline — local LLM, every sentence carrying an event-row citation, regenerated whenever the dossier changes, spot-audited on a 50-dossier sample for unsupported claims before any release. 4. Viewer grows the timeline + evidence panes (reusing the retail plan's evidence-pin pattern: click → source image with the relevant crop/line highlighted).
- **Gate:** 50-question eval (who-lived/when-built/who-owned/what-happened) hand-scored against dossier ground truth; no uncited claims.

---

## 5. Laptop budget summary

| Phase | Disk | Compute | Paid spend |
|---|---|---|---|
| 0 modern spine | 40–60 GB | hours (DuckDB) | none |
| 1 photos | 5–10 GB (pilot thumbs + metadata) | hours | none |
| 2 census pilot | 5 GB | days of local VLM | none locally; API run = approval gate |
| 3 directories/voters | 5–10 GB text (+ optional 50–150 GB images on external SSD) | days–weeks local LLM passes | optional approved API runs for hard pages |
| 4 newspapers | 20–40 GB text | days | none |
| 5–7 | 10–20 GB | days | none |

Total: comfortably under 150 GB internal; a 2 TB external SSD only if mirroring page images. Nothing requires a GPU cluster — the unlimited-compute fantasy collapses to "patient weeks of a local model chewing through text" because the high-yield corpora are text, not images, and the existing OCR is free.

---

## 6. Gazetteer workstream (runs alongside Phases 2–4)

The address→BBL crosswalk per era is the project's hardest shared infrastructure:
- Seed with **NYC Space/Time Directory** artifacts (GitHub: historical geocoder, OCR'd directories, georeferenced atlases) — defunct project, reusable data.
- Pilot-CD atlas georeferencing via NYPL Map Warper (Bromley/Perris) for address-range × year.
- Known discontinuities, handled as explicit epoch tables: **Queens wholesale renumbering (1920s)** — every pre-1925 Queens address is a different system; Brooklyn renames after 1898 consolidation; Manhattan avenue renames/renumberings.
- Every geocode records which epoch table resolved it; unresolved strings stay in the dossier as `address_raw` with `bbl = null` rather than being dropped.

---

## 7. What this does NOT cover (honest scope)

- **Pre-1850 outside Manhattan** — thin by nature; pre-1811-grid geography needs bespoke work.
- **1950–1990 occupants at city scale** — reverse directories cover the era annually but live on microfilm; pilot-scale sampling is in scope (Phase 3b), city-scale digitization is a partnership/licensing project. Census microdata stays sealed until 2032+. Label the residual gap in the UI.
- **Tenants generally** — directories/censuses see them; deeds and modern open data see owners. Post-1950 tenancy is structurally invisible, which is itself a finding worth displaying.
- **Rights-walled corpora** — Ancestry/ProQuest phone books, TimesMachine, newspapers.com, Fulton History (no bulk access). Linked-to where possible, not ingested.
- **Undigitized paper** — Municipal Archives police/court/almshouse records, pre-1866 building dockets. Future field trips, not pipeline inputs.

## 8. Privacy & ethics policy (modern era)

- Display for living persons only what is public-record-by-design: property ownership (ACRIS), business licensure, permits. These name people *in their capacity as owners/licensees*.
- No voter-file ingestion for display; no tenant inference from 311/inspections; no aggregation that re-identifies current residents.
- Pre-1950 census/directory persons are displayed (deceased, records unsealed by statute), matching genealogy-sector norms.
- Published dataset ships with a takedown/contact path.

## 9. Risks

- **DORIS bulk access** is the long pole for photos — same risk and same mitigation (week-1 outreach) as the retail plan; share the ask.
- **IA OCR quality pre-1860** may force VLM re-OCR earlier than budgeted — measure on gold per decade before committing.
- **IPUMS address-field terms** may not permit this use — verify in Phase 0 week; fallback path (NARA 1950-first) already specified.
- **Geocode-rate ceiling**: if era geocoding stalls below ~80% in the pilot, the gazetteer becomes the critical path; re-plan before scaling corpora.
- **Scope gravity**: every phase produces a usable artifact on its own (v0 modern dossiers, photo timelines, directory layer…) so the project degrades gracefully if stopped at any gate.

## 10. Milestones

| # | Milestone | Output | Spend gate |
|---|---|---|---|
| 0 | Modern spine, all-city | dossier v0 + minimal map viewer | none |
| 0.5 | Autonomous harvester proven | supervisor + queue running unattended 7 straight days; clean `status.md`; survives sleep/restart/kill tests | none |
| 1 | Photo timelines, pilot CD | per-lot photo strip 1924→present; DORIS ask sent | none |
| 2 | Census rosters, pilot CD | 1880–1950 occupants with gold-set accuracy report | approval if API OCR |
| 3 | Directory/voter layer, pilot CD → city text pass | mention events + geocode-rate report | approval if API OCR |
| 4 | Newspaper mentions, NYC titles | audited mention layer | none |
| 5 | Ask-the-address v1, pilot CD | RAG over dossiers, cited answers, eval report | none |
| 6 | Public release, pilot CD | site + open dataset + methods page | TBD |

## Sources (beyond those in the retail plan)

- NARA 1950 census (free images, index, API): https://1950census.archives.gov/ · 1940: https://1940census.archives.gov/ · 72-year rule: https://www.archives.gov/research/census/about
- IPUMS full-count USA: https://usa.ipums.org/usa/full_count.shtml
- Unified ED finder (address→enumeration district): https://stevemorse.org/census/unified.html
- NYC Open Data portal: https://opendata.cityofnewyork.us/ — ACRIS, PLUTO/PAD, DOB, HPD, DOF sales, licenses, 311
- Chronicling America bulk OCR: https://chroniclingamerica.loc.gov/about/api/ · NYS Historic Newspapers: https://nyshistoricnewspapers.org/
- OldNYC data: https://github.com/danvk/oldnyc · NYC Space/Time Directory: https://github.com/nypl-spacetime
- NYPL Map Warper: https://maps.nypl.org/warper/ · LPC designation reports: https://www.nyc.gov/site/lpc/designations/designation-reports.page
- FamilySearch NYC land records (microfilm images, browse-only): catalog at https://www.familysearch.org/search/catalog
- Wayback CDX API: https://archive.org/developers/wayback-cdx-server.html · NYT Article Search API: https://developer.nytimes.com/docs/articlesearch-product/1/overview
- 1924/1951 + modern orthos: https://maps.nyc.gov/then-now/ and NYC Open Data orthoimagery
- Reverse/criss-cross directories: NYPL telephone directories guide (holdings 1929–present): https://libguides.nypl.org/telephone · Cole's Cross Reference (BPL): https://www.bklynlibrary.org/online-resources/coles-cross-reference · LOC criss-cross inventory: https://guides.loc.gov/address-directories/criss-cross
- Camilo José Vergara archive at LOC: https://guides.loc.gov/vergara-collection-guide · acquisition: https://www.loc.gov/item/prn-15-002/
- NY World-Telegram & Sun collection (LOC): https://www.loc.gov/pictures/collection/nywts/
- Municipal Archives collections incl. NYPD 1914–1975: https://www.nyc.gov/site/records/historical-records/collections.page · gallery: https://nycrecords.access.preservica.com/
- NHGIS block/tract tables: https://www.nhgis.org/ · USGS EarthExplorer aerial frames: https://earthexplorer.usgs.gov/
- Office for Metropolitan History permit search (Manhattan NB 1900–1986): https://www.metrohistory.com/permit-search
- Real Estate Record digitization (Columbia, 1868–1922): https://rerecord.library.columbia.edu/ · full-run catalog: https://catalog.hathitrust.org/Record/008438186
- Philadelphia Real Estate Record & Builders' Guide digitization (CLIR registry): https://registry.clir.org/projects/2222/
