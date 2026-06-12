// Source registry: every Phase 0 dataset, IDs verified against the live catalog 2026-06-12.
// priority: lower runs first (small wins early, multi-hour giants last).
// select/where trim columns server-side where the full payload isn't needed.
export const SOURCES = [
  {
    key: 'pad', id: 'bc8t-ecyu', name: 'Property Address Directory', priority: 10,
    type: 'blob', blobUrl: 'https://data.cityofnewyork.us/download/bc8t-ecyu/application%2Fzip',
    blobFile: 'pad.zip', unzip: true,
    note: 'address-range -> BBL spine; blob dataset, not SODA-enabled',
  },
  {
    key: 'pluto', id: '64uk-42ks', name: 'Primary Land Use Tax Lot Output (PLUTO)', priority: 11,
    note: 'lot base table: address, cd, yearbuilt, ownername',
  },
  {
    key: 'hpd_registrations', id: 'tesw-yqqr', name: 'Multiple Dwelling Registrations', priority: 12,
  },
  {
    key: 'dof_rolling_sales', id: 'usep-8jbt', name: 'NYC Citywide Rolling Calendar Sales', priority: 13,
  },
  {
    key: 'dof_annualized_sales', id: 'w2pb-icbu', name: 'NYC Citywide Annualized Calendar Sales Update', priority: 14,
  },
  {
    key: 'dcwp_licenses', id: 'w7w3-xahh', name: 'Issued Licenses', priority: 15,
  },
  {
    key: 'restaurant_inspections', id: '43nn-pn8j', name: 'DOHMH New York City Restaurant Inspection Results', priority: 16,
  },
  {
    key: 'oldnyc', name: 'OldNYC geocoded NYPL photos (danvk/oldnyc)', priority: 17,
    type: 'blob', blobUrl: 'https://raw.githubusercontent.com/danvk/oldnyc/master/data/images.geojson',
    blobFile: 'images.geojson', unzip: false,
    note: 'Phase 1: ~40k geocoded Milstein photos; nearest-lot BBL assignment at materialize time',
  },
  {
    key: 'dob_cofo', id: 'bs8b-p36w', name: 'DOB Certificate Of Occupancy', priority: 20,
  },
  {
    key: 'dob_permits', id: 'ipu4-2q9a', name: 'DOB Permit Issuance', priority: 21,
  },
  {
    key: 'dob_jobs', id: 'ic3t-wcy2', name: 'DOB Job Application Filings', priority: 22,
  },
  {
    key: 'hpd_violations', id: 'wvxf-dwi5', name: 'Housing Maintenance Code Violations', priority: 23,
  },
  {
    key: 'acris_master', id: 'bnx9-e6tj', name: 'ACRIS - Real Property Master', priority: 30,
  },
  {
    key: 'acris_legals', id: '8h5j-fqxa', name: 'ACRIS - Real Property Legals', priority: 31,
  },
  {
    key: 'acris_parties', id: '636b-3b5g', name: 'ACRIS - Real Property Parties', priority: 32,
  },
  {
    // NB: city rescoped this dataset from 2010→2020 start; a separate historic dataset may exist for 2010-2019.
    key: 'three11', id: 'erm2-nwe9', name: '311 Service Requests from 2020 to Present', priority: 40,
    select: 'created_date,closed_date,complaint_type,descriptor,location_type,incident_zip,incident_address,street_name,borough,bbl,status,latitude,longitude',
    where: 'bbl IS NOT NULL',
    note: 'address-resolved complaints only; texture-of-life events',
  },
];

// Work the harvester must never attempt on its own (surfaced in status.md).
export const BLOCKED_ON_HUMAN = [
  'Email DORIS/Municipal Archives: bulk/research access to 1940s + 1980s tax photo collections (longest lead item)',
  'Email Office for Metropolitan History (metrohistory.com): ask for NB permit database 1900-1986 before any crawling',
  'IPUMS full-count census: create account, verify address-field terms for 1940/1950',
  'NYPL Milstein library day: reverse-directory microfilm sampling for pilot CD (Phase 3b)',
  'Install Ollama + pull a local VLM/LLM before Phase 2/3 extraction (no paid API runs without explicit approval)',
  'Choose pilot Community District (suggest MN CD10/Harlem to share the retail-plan corridor)',
];
