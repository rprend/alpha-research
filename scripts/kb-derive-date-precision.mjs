import path from "node:path";
import {
  auditsDir,
  loadRegistry,
  processedDir,
  readJsonl,
  writeJson,
  writeJsonl,
  writeText,
} from "./kb-lib.mjs";

const registry = await loadRegistry();
const sourceClassById = new Map((registry.sources ?? []).map((source) => [source.source_id, source.source_class]));
const sourceDocumentsPath = path.join(processedDir, "source_documents.jsonl");
const worksPath = path.join(processedDir, "works.jsonl");
const sourceDocuments = await readJsonl(sourceDocumentsPath);
const works = await readJsonl(worksPath);

const sourceDocumentUpdates = applyDatePrecision(sourceDocuments);
const workUpdates = applyDatePrecision(works);

await writeJsonl(sourceDocumentsPath, sourceDocuments);
await writeJsonl(worksPath, works);

const report = {
  generated_at: new Date().toISOString(),
  source_document_updates: sourceDocumentUpdates.updated,
  work_updates: workUpdates.updated,
  source_document_counts: sourceDocumentUpdates.counts,
  work_counts: workUpdates.counts,
  notes: [
    "Derived fields are first-pass precision aids for filtering and QA; raw source date strings remain authoritative.",
    "Conference records separate page/post dates from event years where detectable.",
    "Cultural collection records separate object/item dates from accession years where detectable.",
  ],
};

await writeJson(path.join(auditsDir, "date-precision-derivation.json"), report);
await writeText(path.join(auditsDir, "date-precision-derivation.md"), renderMarkdown(report));

console.log(`KB date precision derivation: updated ${sourceDocumentUpdates.updated} source documents and ${workUpdates.updated} works.`);

function applyDatePrecision(rows) {
  let updated = 0;
  const counts = {};
  for (const row of rows) {
    const derived = derive(row);
    if (!derived) continue;
    for (const [key, value] of Object.entries(derived)) {
      row[key] = value;
    }
    updated += 1;
    const bucket = `${row.source_id}:${derived.content_date_kind}:${derived.content_date_precision}`;
    counts[bucket] = (counts[bucket] ?? 0) + 1;
  }
  return { updated, counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) };
}

function derive(row) {
  const sourceClass = sourceClassById.get(row.source_id);
  if (sourceClass === "conference-programs") return deriveConferenceDate(row);
  if (sourceClass === "cultural-collections") return deriveCulturalDate(row);
  return null;
}

function deriveConferenceDate(row) {
  const title = String(row.title ?? "");
  const url = String(row.source_url ?? "");
  const sourceYear = yearFrom(row.publication_year);
  const titleYear = yearFrom(title);
  const urlYear = yearFrom(url);
  const ahaShortYear = row.source_id === "aha-annual-meeting-programs" ? ahaYearFromShortCode(`${title} ${url}`) : "";
  const ahaOrdinalYear = row.source_id === "aha-annual-meeting-programs" ? ahaYearFromOrdinal(`${title} ${url}`) : "";
  const eventYear = ahaShortYear || titleYear || urlYear || ahaOrdinalYear || (row.source_id === "mla-convention-programs" ? sourceYear : "");
  if (eventYear && /annual meeting|convention|conference|program|aha\d{2}|mla/i.test(`${title} ${url}`)) {
    return {
      content_date_kind: "event-year",
      content_date_precision: "year",
      content_year_start: eventYear,
      content_year_end: eventYear,
      content_date_source: eventYear === ahaShortYear
        ? "derived:aha-short-code"
        : eventYear === ahaOrdinalYear
          ? "derived:aha-ordinal-meeting-number"
          : row.content_date_source || "derived:conference-title-or-url",
    };
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(String(row.publication_year ?? ""))) {
    const year = String(row.publication_year).slice(0, 4);
    return {
      content_date_kind: "page-post-date",
      content_date_precision: "day",
      content_year_start: year,
      content_year_end: year,
      publication_date: row.publication_date || String(row.publication_year).slice(0, 10),
      content_date_source: row.content_date_source || "source:conference-page-date",
    };
  }
  if (sourceYear) {
    return {
      content_date_kind: "event-year",
      content_date_precision: "year",
      content_year_start: sourceYear,
      content_year_end: sourceYear,
      content_date_source: row.content_date_source || "source:conference-year",
    };
  }
  return {
    content_date_kind: "undated-conference-metadata",
    content_date_precision: "none",
    content_year_start: "",
    content_year_end: "",
    content_date_source: row.content_date_source || "missing:conference-date",
  };
}

function deriveCulturalDate(row) {
  const dateText = String(row.date || row.creation_date || "");
  const accessionYear = yearFrom(row.accession_year);
  const range = yearRange(dateText);
  if (range) {
    return {
      content_date_kind: row.source_id === "library-of-congress" ? "item-date" : "object-date",
      content_date_precision: range.precision,
      content_year_start: range.start,
      content_year_end: range.end,
      content_date_source: row.content_date_source || sourceDateLabel(row),
    };
  }
  if (accessionYear) {
    return {
      content_date_kind: "accession-year",
      content_date_precision: "year",
      content_year_start: accessionYear,
      content_year_end: accessionYear,
      content_date_source: row.content_date_source || "source:accession-year",
    };
  }
  return {
    content_date_kind: "undated-cultural-metadata",
    content_date_precision: "none",
    content_year_start: "",
    content_year_end: "",
    content_date_source: row.content_date_source || "missing:cultural-date",
  };
}

function sourceDateLabel(row) {
  if (row.source_id === "library-of-congress") return "source:item-date";
  if (row.source_id === "smithsonian-open-access") return "source:object-date-decade";
  return "source:object-date";
}

function yearRange(value) {
  const text = String(value ?? "");
  const bceRange = text.match(/\b(\d{2,4})\s*[-–]\s*(\d{2,4})\s*BCE\b/i);
  if (bceRange) {
    return {
      start: `-${bceRange[1]}`,
      end: `-${bceRange[2]}`,
      precision: "range-bce",
    };
  }
  const bceYear = text.match(/\b(\d{2,4})\s*BCE\b/i);
  if (bceYear) {
    return {
      start: `-${bceYear[1]}`,
      end: `-${bceYear[1]}`,
      precision: "year-bce",
    };
  }
  const shortEraRange = text.match(/\b(\d{3,4})\s*[-–]\s*(\d{2})\s*CE\b/i);
  if (shortEraRange) {
    const start = shortEraRange[1];
    const end = `${start.slice(0, -2)}${shortEraRange[2]}`;
    return { start, end, precision: "range" };
  }
  const eraRange = text.match(/\b(\d{3,4})\s*[-–]\s*(\d{3,4})(?:\s*CE)?\b/i);
  if (eraRange) {
    return { start: eraRange[1], end: eraRange[2], precision: "range" };
  }
  const abbreviatedRange = text.match(/\b((?:1[0-9]|20)\d{2})\s*[-–]\s*(\d{2})\b/);
  if (abbreviatedRange) {
    const start = abbreviatedRange[1];
    const end = `${start.slice(0, 2)}${abbreviatedRange[2]}`;
    return { start, end, precision: "range" };
  }
  const years = [...text.matchAll(/\b(?:[1-9]\d{2}|1[0-9]\d{2}|20\d{2})\b/g)].map((match) => match[0]);
  if (years.length) {
    return {
      start: years[0],
      end: years[years.length - 1],
      precision: years.length > 1 || /[-–]/.test(text) ? "range" : "year",
    };
  }
  const centuryRange = text.match(/\b(1[0-9]|20)(?:st|nd|rd|th)?\s*[-–]\s*(1[0-9]|20)(?:st|nd|rd|th)?\s+century\b/i);
  if (centuryRange) {
    const startCentury = Number(centuryRange[1]);
    const endCentury = Number(centuryRange[2]);
    return {
      start: String((startCentury - 1) * 100),
      end: String((endCentury * 100) - 1),
      precision: "century-range",
    };
  }
  const century = text.match(/\b(1[6-9]|20)(?:st|nd|rd|th)?\s+century\b/i);
  if (century) {
    const centuryNumber = Number(century[1]);
    return {
      start: String((centuryNumber - 1) * 100),
      end: String((centuryNumber * 100) - 1),
      precision: /early|mid|late/i.test(text) ? "century-qualified" : "century",
    };
  }
  const numberedCentury = text.match(/\b([1-9]\d{2}|1[0-9]\d{2}|20\d{2})s\b/);
  if (numberedCentury) {
    const start = Number(numberedCentury[1]);
    return { start: String(start), end: String(start + 99), precision: "century-ish" };
  }
  const decade = text.match(/\b((?:18|19|20)\d0)s\b/);
  if (decade) {
    const start = Number(decade[1]);
    return { start: String(start), end: String(start + 9), precision: "decade" };
  }
  return null;
}

function yearFrom(value) {
  return String(value ?? "").match(/\b(?:1[0-9]|20)\d{2}\b/)?.[0] ?? "";
}

function ahaYearFromShortCode(value) {
  const match = String(value ?? "").match(/\bAHA\s?(\d{2})\b/i);
  if (!match) return "";
  const year = 2000 + Number(match[1]);
  return year >= 2000 && year <= 2099 ? String(year) : "";
}

function ahaYearFromOrdinal(value) {
  const match = String(value ?? "").match(/\b(\d{2,3})(?:st|nd|rd|th)\s+Annual Meeting\b/i);
  if (!match) return "";
  const ordinal = Number(match[1]);
  const year = ordinal + 1886;
  return year >= 1884 && year <= 2099 ? String(year) : "";
}

function renderMarkdown(report) {
  return [
    "# KB Date Precision Derivation",
    "",
    `Generated at: ${report.generated_at}`,
    `Source-document updates: ${report.source_document_updates}`,
    `Work updates: ${report.work_updates}`,
    "",
    "## Source Documents",
    "",
    table(report.source_document_counts),
    "",
    "## Works",
    "",
    table(report.work_counts),
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
  ].join("\n");
}

function table(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) return "No derived rows.";
  return ["| Bucket | Rows |", "| --- | ---: |", ...entries.map(([key, value]) => `| ${key} | ${value} |`)].join("\n");
}
