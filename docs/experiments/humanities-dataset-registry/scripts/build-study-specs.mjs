import path from "node:path";
import {
  experimentDir,
  readJson,
  toCsv,
  writeJson,
  writeText,
} from "./lib.mjs";

const processedDir = path.join(experimentDir, "data", "processed");
const reportsDir = path.join(experimentDir, "reports");
const candidates = await readJson(path.join(processedDir, "candidates.json"));
const ready = candidates.filter((candidate) => candidate.readiness_bucket === "ready-now").slice(0, 5);
const specs = ready.map((candidate) => buildSpec(candidate));

await writeJson(path.join(processedDir, "study-specs.json"), {
  generatedAt: new Date().toISOString(),
  count: specs.length,
  specs,
});
await writeText(path.join(processedDir, "study-specs.csv"), toCsv(specs, [
  "id",
  "working_title",
  "dataset",
  "format",
  "research_question",
  "unit_of_analysis",
  "first_runnable_build",
  "publication_angle",
  "readiness_bucket",
]));
await writeText(path.join(reportsDir, "study-specs.md"), buildMarkdown(specs));

console.log(`Built ${specs.length} humanities dataset study specs`);

function buildSpec(candidate) {
  const defaults = {
    "cleveland-art-open-access": {
      working_title: "What A Museum Collection Looks Like When It Becomes Data",
      format: "what-changed",
      research_question: "What acquisition, creation-date, department, geography, and medium patterns become visible in a fully open museum API?",
      unit_of_analysis: "artwork metadata record",
      first_runnable_build: "Fetch the first 5,000 Cleveland Museum of Art API records, normalize dates/departments/creators, and produce acquisition/date/department tables.",
      expected_outputs: ["department counts", "creation-date distribution", "acquisition-date distribution", "public-domain/image-availability counts"],
      publication_angle: "A practical demonstration of how museum collections become analyzable once metadata is open and structured.",
    },
    wikidata: {
      working_title: "The Public Knowledge Graph Of Culture",
      format: "research-agenda",
      research_question: "How are authors, artworks, institutions, movements, languages, and places connected in public linked data?",
      unit_of_analysis: "Wikidata entity and statement",
      first_runnable_build: "Run bounded SPARQL queries for authors, artworks, movements, languages, and institutions, then inspect missingness and relation density.",
      expected_outputs: ["entity counts by class", "relationship graph", "missingness table", "starter query library"],
      publication_angle: "A field guide to what public linked data can and cannot say about cultural history.",
    },
    "library-of-congress-digital-collections": {
      working_title: "What The Library Of Congress Has Digitized",
      format: "field-map",
      research_question: "Which subjects, formats, periods, and collection types dominate digitized public collections?",
      unit_of_analysis: "collection or item metadata record",
      first_runnable_build: "Fetch LOC collection metadata and one item sample per collection, normalize subjects/formats/dates, and rank collection visibility.",
      expected_outputs: ["collection inventory", "subject counts", "format counts", "date coverage table"],
      publication_angle: "A map of digitized cultural memory that distinguishes collection visibility from historical importance.",
    },
    "met-collection-api": {
      working_title: "The Shape Of The Met Collection",
      format: "field-map",
      research_question: "How do object dates, geographies, departments, acquisition histories, and public-domain availability differ across the Met collection?",
      unit_of_analysis: "object metadata record",
      first_runnable_build: "Fetch object IDs and a bounded object-detail sample, normalize department/culture/period/date/acquisition fields, and produce collection-shape charts.",
      expected_outputs: ["department counts", "culture/geography table", "object-date distribution", "public-domain counts"],
      publication_angle: "A source-backed essay on what a major museum collection looks like through its public API.",
    },
    "open-syllabus": {
      working_title: "What Teaching Data Can And Cannot Tell Us About The Canon",
      format: "moving-canon",
      research_question: "Which works and authors appear in syllabi across institutions, fields, and time, and what access limits constrain public claims?",
      unit_of_analysis: "assigned work or author appearance",
      first_runnable_build: "Resolve access/export terms, then build a narrow pilot around one author cohort and one discipline.",
      expected_outputs: ["author/work appearance table", "field/institution coverage notes", "access constraints memo"],
      publication_angle: "A careful methods essay separating syllabus evidence from broad claims about cultural value.",
    },
    "project-gutenberg": {
      working_title: "The Public-Domain Library Is Not The Literary Canon",
      format: "field-map",
      research_question: "How do publication dates, languages, genres, and author cohorts shape the public-domain literary corpus?",
      unit_of_analysis: "book metadata record",
      first_runnable_build: "Fetch Gutenberg catalog metadata, normalize author/date/language/subject fields, and compare corpus shape against public-domain constraints.",
      expected_outputs: ["year distribution", "language counts", "subject counts", "author cohort table"],
      publication_angle: "A caveated essay showing why public-domain availability is powerful but historically skewed.",
    },
  };
  const base = defaults[candidate.id] ?? {
    working_title: candidate.name,
    format: "research-agenda",
    research_question: candidate.starter_question,
    unit_of_analysis: "dataset record",
    first_runnable_build: `Probe ${candidate.name} at file or record level and normalize the first analyzable sample.`,
    expected_outputs: ["source inventory", "field coverage table", "quality-risk notes"],
    publication_angle: candidate.starter_question,
  };
  return {
    id: candidate.id,
    dataset: candidate.name,
    domain: candidate.domain,
    access_mode: candidate.access_mode,
    readiness_bucket: candidate.readiness_bucket,
    readiness_score: candidate.readiness_score,
    known_risk: candidate.quality_risk,
    ...base,
  };
}

function buildMarkdown(specs) {
  return [
    "# Humanities Dataset Study Specs",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "These specs turn the registry's ready-now candidates into first runnable studies. They are study starts, not publication claims.",
    "",
    ...specs.flatMap((spec) => [
      `## ${spec.working_title}`,
      "",
      `- Dataset: ${spec.dataset}`,
      `- Domain: ${spec.domain}`,
      `- Format: ${spec.format}`,
      `- Unit of analysis: ${spec.unit_of_analysis}`,
      `- Readiness: ${spec.readiness_bucket} (${spec.readiness_score})`,
      "",
      `Research question: ${spec.research_question}`,
      "",
      `First runnable build: ${spec.first_runnable_build}`,
      "",
      "Expected outputs:",
      "",
      ...spec.expected_outputs.map((output) => `- ${output}`),
      "",
      `Publication angle: ${spec.publication_angle}`,
      "",
      `Known risk: ${spec.known_risk}`,
      "",
    ]),
  ].join("\n");
}
