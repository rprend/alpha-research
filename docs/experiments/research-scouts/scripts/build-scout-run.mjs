import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("docs", "experiments");
const scoutRoot = path.join(root, "research-scouts");
const args = parseArgs();
const runId = args["run-id"] ?? "2026-06-12-cultural-memory";
const outDir = path.join(scoutRoot, runId);

const queue = await readJson(path.join(root, "publication-queue", "reports", "publication-queue.json"));
const backlog = await readJson(path.join(root, "research-backlog", "backlog.json"));

const context = buildSourceContext(queue, backlog);
const proposals = buildProposals();
const audits = proposals.map(auditProposal);
const selected = proposals
  .filter((proposal) => ["accept", "narrow"].includes(audits.find((audit) => audit.id === proposal.id)?.decision))
  .map((proposal) => buildSelectedBrief(proposal, audits.find((audit) => audit.id === proposal.id)));

await fs.mkdir(outDir, { recursive: true });
await writeText(path.join(outDir, "prompt.md"), buildPrompt(context));
await writeText(path.join(outDir, "source-context.md"), context);
await writeJson(path.join(outDir, "proposals.json"), {
  runId,
  generatedAt: new Date().toISOString(),
  field: "cultural memory and institutional change",
  proposalCount: proposals.length,
  proposals,
});
await writeText(path.join(outDir, "audit.md"), buildAuditMarkdown(audits));
await writeText(path.join(outDir, "selected-briefs.md"), buildSelectedMarkdown(selected));

console.log(`Built research scout run ${runId} with ${proposals.length} proposals and ${selected.length} selected briefs`);

function buildSourceContext(publicationQueue, researchBacklog) {
  const readyRows = publicationQueue.rows.filter((row) => row.readiness_status === "ready-for-editorial-review");
  const backlogRows = researchBacklog.items;
  return [
    "# Source Context",
    "",
    "## Current Publication Queue",
    "",
    `- Ready artifacts: ${readyRows.length} of ${publicationQueue.itemCount}`,
    ...readyRows.map((row) => `- ${row.title}: ${row.format}; ${row.summary || row.recommended_action}`),
    "",
    "## Existing Backlog Signals",
    "",
    ...backlogRows.map((item) => [
      `### ${item.title}`,
      "",
      `- Status: ${item.status}`,
      `- Unit: ${item.unitOfAnalysis}`,
      `- Question: ${item.researchQuestion}`,
      `- Sources: ${item.primarySources.join("; ")}`,
      `- Next sources: ${(item.nextSources ?? []).join("; ") || "none recorded"}`,
      `- Risks: ${(item.qualityRisks ?? []).join("; ")}`,
      "",
    ].join("\n")),
    "## Scout Direction",
    "",
    "Prefer proposals that extend ready artifacts into second-layer source corpora or create new longitudinal public essays. Do not rely on tiny slices as final evidence. Use probes only to validate schema, access, and normalization before a broader backfill.",
    "",
  ].join("\n");
}

function buildPrompt(sourceContext) {
  return [
    "# Research Scout Prompt",
    "",
    "You are proposing source-backed public research essays for Archive Signals / The Cultural Observatory.",
    "",
    "Field or domain:",
    "",
    "Cultural memory, institutional language, canons, public humanities datasets, and scholarly field change.",
    "",
    "Existing context:",
    "",
    sourceContext,
    "Return candidate studies. For each study, include research question, why the question matters, unit of analysis, likely sources, required transformations, expected charts or tables, representative records needed, reasons the idea might be wrong, first runnable corpus build, and public essay angle.",
    "",
    "Do not propose a study unless the unit of analysis can plausibly be measured from public or already available sources.",
    "",
  ].join("\n");
}

function buildProposals() {
  return [
    {
      id: "museum-annual-report-language",
      title: "When Museums Started Explaining Repair",
      researchQuestion: "How did museum annual reports and public accountability documents change their language around provenance, restitution, repatriation, access, and community between 2000 and 2026?",
      whyItMatters: "The existing museum-language artifact is ready as a source-caveated page study; annual reports would test whether public-facing web copy matches institutional self-reporting over time.",
      unitOfAnalysis: "museum annual report section or paragraph snapshot",
      likelySources: [
        "museum annual report PDFs",
        "museum accountability or impact reports",
        "museum archive/news pages",
        "Internet Archive snapshots for report indexes"
      ],
      requiredTransformations: [
        "PDF text extraction with page anchors",
        "report-year normalization",
        "paragraph segmentation",
        "term-family and contextual snippet scoring",
        "museum and document-genre labels"
      ],
      expectedChartsOrTables: [
        "term-family share by year",
        "museum-by-term heatmap",
        "representative annual-report excerpts",
        "source coverage table by museum and year"
      ],
      representativeRecordsNeeded: [
        "one pre-2010 annual report page per source where available",
        "one post-2020 provenance/restitution passage",
        "one no-signal control paragraph per museum"
      ],
      reasonsTheIdeaMightBeWrong: [
        "annual reports may be written for donors rather than public interpretation",
        "PDF availability may be uneven by museum and year",
        "report design and OCR quality may create artificial language shifts"
      ],
      firstRunnableCorpusBuild: "Select 12 museums already present in museum-language-drift, fetch all public annual reports available for 2000-2026, extract text into paragraph records, and reuse the existing museum term taxonomy with a document-genre label.",
      publicEssayAngle: "A follow-up to the museum language post: not just what museums say on web pages, but when repair and accountability entered their institutional record.",
    },
    {
      id: "university-strategic-plan-drift",
      title: "The Strategic Plan University",
      researchQuestion: "Do university strategic plans show a stronger shift toward innovation, impact, global leadership, belonging, and workforce language than mission/about pages?",
      whyItMatters: "Mission pages are stable public signals, but strategic plans are where universities describe intended change. Comparing the two source genres can separate institutional identity from managerial priorities.",
      unitOfAnalysis: "university strategic-plan section or page",
      likelySources: [
        "current strategic-plan pages",
        "strategic-plan PDFs",
        "university president messages",
        "Internet Archive snapshots of plan pages"
      ],
      requiredTransformations: [
        "PDF and HTML extraction",
        "institution and year normalization",
        "source-genre labeling",
        "term-family scoring",
        "snippet audit for high-signal claims"
      ],
      expectedChartsOrTables: [
        "mission-page vs strategic-plan term shares",
        "institution-year coverage matrix",
        "top changing terms by decade",
        "representative snippets by source genre"
      ],
      representativeRecordsNeeded: [
        "mission page and strategic plan from the same institution-year where possible",
        "older plans from 2000-2010",
        "post-2020 plans with inclusion and workforce language"
      ],
      reasonsTheIdeaMightBeWrong: [
        "strategic plans may be episodic and not comparable year by year",
        "universities may remove old plans from public sites",
        "consultant-written plans can converge stylistically without reflecting institutional purpose"
      ],
      firstRunnableCorpusBuild: "Use the 10 universities in university-mission-statement-drift, collect public strategic plans and president messages for 2000, 2010, 2015, 2020, and 2026 anchors, then compare against existing mission-page term families.",
      publicEssayAngle: "Universities may not have changed what they say they are for as much as how they plan, manage, and justify themselves.",
    },
    {
      id: "humanities-ai-corpora-map",
      title: "What Humanities AI Actually Studies",
      researchQuestion: "Which corpora, archives, languages, periods, and media types appear most often in AI-for-humanities work from 2020 onward?",
      whyItMatters: "The literature radar maps AI and quantitative humanities works, but the next public question is what cultural material those methods actually touch.",
      unitOfAnalysis: "scholarly work to named corpus/archive/dataset mention",
      likelySources: [
        "humanities-literature-radar processed works",
        "OpenAlex abstracts",
        "arXiv abstracts",
        "Knowledge Commons records",
        "paper full text where open and permitted"
      ],
      requiredTransformations: [
        "corpus/archive entity extraction",
        "language and period tagging",
        "media/source-type classification",
        "manual audit of high-frequency extracted entities",
        "deduplication of corpus names"
      ],
      expectedChartsOrTables: [
        "top corpora and archives",
        "source-type distribution",
        "language and geography coverage",
        "method-by-corpus matrix"
      ],
      representativeRecordsNeeded: [
        "works using canonical literary corpora",
        "works using museum/archive collections",
        "works using newspapers or social media",
        "works with non-English corpora"
      ],
      reasonsTheIdeaMightBeWrong: [
        "metadata abstracts may omit corpus names",
        "full-text access may bias toward open preprints",
        "named entity extraction can merge projects, datasets, and institutions incorrectly"
      ],
      firstRunnableCorpusBuild: "Start from the 593 quantitative/computational candidates in humanities-literature-radar, extract corpus/entity mentions from titles and abstracts, then audit the top 100 mentions before scaling to open full text.",
      publicEssayAngle: "AI in the humanities is not only a method trend; it is a map of which parts of culture are becoming computationally visible.",
    },
    {
      id: "anthology-toc-canon-pilot",
      title: "The Anthology Table Of Contents As Canon Sensor",
      researchQuestion: "Can public anthology tables of contents and publisher previews measure author and work turnover across editions in a narrow literary field?",
      whyItMatters: "The canon drift feasibility artifact says canon drift is multi-source. A bounded anthology pilot can test one signal deeply before making wider claims.",
      unitOfAnalysis: "author-work appearance in an anthology edition table of contents",
      likelySources: [
        "publisher preview pages",
        "Google Books snippets where permitted for bibliographic metadata",
        "Internet Archive controlled metadata pages",
        "library catalog edition metadata",
        "public syllabi as comparison only"
      ],
      requiredTransformations: [
        "edition normalization",
        "table-of-contents extraction",
        "author and work title matching",
        "edition-year timeline",
        "appearance/disappearance scoring"
      ],
      expectedChartsOrTables: [
        "author retention by edition",
        "newly added and removed works",
        "period/geography shifts",
        "source confidence table"
      ],
      representativeRecordsNeeded: [
        "two or more editions of the same anthology",
        "author-work rows with page or section evidence",
        "ambiguous title cases for audit"
      ],
      reasonsTheIdeaMightBeWrong: [
        "tables of contents may be copyrighted or not publicly extractable at scale",
        "anthologies differ in market and course level",
        "edition changes can reflect permissions and price rather than canon judgment"
      ],
      firstRunnableCorpusBuild: "Pick one anthology family with public TOC evidence across at least three editions, build an edition-level table, and compare against a small public syllabus control set without treating syllabi as representative.",
      publicEssayAngle: "Canon drift becomes measurable only when the source is narrow enough to audit edition by edition.",
    },
    {
      id: "dataset-afterlife-study",
      title: "The Afterlife Of Humanities Datasets",
      researchQuestion: "What happens to public humanities datasets after release: do they get cited, forked, reused in papers, linked from projects, or quietly disappear?",
      whyItMatters: "The dataset registry identifies ready-now corpora. A follow-up can test whether dataset quality predicts actual scholarly and public reuse.",
      unitOfAnalysis: "dataset or corpus release",
      likelySources: [
        "humanities-dataset-registry candidates",
        "Zenodo and Dataverse metadata",
        "OpenAlex citation and related-work metadata",
        "GitHub repository metadata where public",
        "project pages and documentation"
      ],
      requiredTransformations: [
        "dataset identifier normalization",
        "DOI and URL matching",
        "citation and mention collection",
        "repository activity metrics",
        "access/license status checks"
      ],
      expectedChartsOrTables: [
        "reuse signal by dataset type",
        "citation/mention timeline",
        "license/access vs reuse table",
        "dead-link and maintenance status table"
      ],
      representativeRecordsNeeded: [
        "datasets with DOI citations",
        "datasets reused without formal citation",
        "datasets with broken links or access changes",
        "ready-now datasets with no visible reuse"
      ],
      reasonsTheIdeaMightBeWrong: [
        "reuse is often informal and hard to observe",
        "citations may attach to papers rather than datasets",
        "older datasets may predate modern DOI and repository practices"
      ],
      firstRunnableCorpusBuild: "Take the 15 dataset-registry candidates, collect DOI/URL/repository identifiers, query OpenAlex and repository metadata for reuse signals, and hand-audit the top and bottom cases.",
      publicEssayAngle: "Humanities datasets are infrastructure, but their public afterlife is uneven and measurable.",
    },
  ];
}

function auditProposal(proposal) {
  const common = {
    id: proposal.id,
    title: proposal.title,
    sourcesExist: "yes",
    unitSpecificEnough: "yes",
    distinguishesInterpretations: "yes",
    interestingIfFalse: "yes",
  };
  if (proposal.id === "anthology-toc-canon-pilot") {
    return {
      ...common,
      decision: "narrow",
      publicCoverageCaveat: "Public TOC evidence is not complete enough for a general canon claim; use a named anthology family and publish as a methods pilot.",
      smallestRunnableCorpus: proposal.firstRunnableCorpusBuild,
      publishableEvidence: "At least three editions with auditable TOC rows, edition-year metadata, and explicit missing-source notes.",
      auditNotes: "Strong idea only if source rights and TOC visibility are handled conservatively.",
    };
  }
  if (proposal.id === "humanities-ai-corpora-map") {
    return {
      ...common,
      decision: "narrow",
      publicCoverageCaveat: "Abstract-only extraction undercounts corpus mentions; present early results as metadata-visible corpora until open full text is added.",
      smallestRunnableCorpus: proposal.firstRunnableCorpusBuild,
      publishableEvidence: "Audited top corpus mentions with source links and false-positive estimates.",
      auditNotes: "Best as a field-map sequel to the literature radar.",
    };
  }
  return {
    ...common,
    decision: "accept",
    publicCoverageCaveat: "Coverage varies by source availability and must be shown as a matrix, not hidden behind trend lines.",
    smallestRunnableCorpus: proposal.firstRunnableCorpusBuild,
    publishableEvidence: "Broad backfill, raw manifests, processed records, and representative audited snippets tied to every major claim.",
    auditNotes: "Measurable from public sources and naturally extends an existing artifact.",
  };
}

function buildSelectedBrief(proposal, audit) {
  return {
    id: proposal.id,
    title: proposal.title,
    status: audit.decision === "accept" ? "source-probed" : "idea",
    format: proposal.id.includes("map") ? "field-map" : proposal.id.includes("anthology") ? "moving-canon" : "what-changed",
    researchQuestion: proposal.researchQuestion,
    unitOfAnalysis: proposal.unitOfAnalysis,
    primarySources: proposal.likelySources,
    firstRunnableBuild: proposal.firstRunnableCorpusBuild,
    publicationAngle: proposal.publicEssayAngle,
    qualityRisks: proposal.reasonsTheIdeaMightBeWrong,
    publishableEvidence: audit.publishableEvidence,
  };
}

function buildAuditMarkdown(audits) {
  return [
    "# Scout Audit",
    "",
    ...audits.flatMap((audit) => [
      `## ${audit.title}`,
      "",
      `- Decision: ${audit.decision}`,
      `- Sources exist and appear accessible: ${audit.sourcesExist}`,
      `- Unit of analysis is specific enough: ${audit.unitSpecificEnough}`,
      `- Can distinguish competing interpretations: ${audit.distinguishesInterpretations}`,
      `- Interesting if main hypothesis is false: ${audit.interestingIfFalse}`,
      `- Public source caveat: ${audit.publicCoverageCaveat}`,
      `- Smallest runnable corpus: ${audit.smallestRunnableCorpus}`,
      `- Publishable evidence: ${audit.publishableEvidence}`,
      `- Notes: ${audit.auditNotes}`,
      "",
    ]),
  ].join("\n");
}

function buildSelectedMarkdown(selectedBriefs) {
  return [
    "# Selected Study Briefs",
    "",
    "These briefs are ready to become experiment folders after a source-probe command is chosen.",
    "",
    ...selectedBriefs.flatMap((brief) => [
      `## ${brief.title}`,
      "",
      `- ID: ${brief.id}`,
      `- Status: ${brief.status}`,
      `- Format: ${brief.format}`,
      `- Research question: ${brief.researchQuestion}`,
      `- Unit of analysis: ${brief.unitOfAnalysis}`,
      `- Primary sources: ${brief.primarySources.join("; ")}`,
      `- First runnable build: ${brief.firstRunnableBuild}`,
      `- Publication angle: ${brief.publicationAngle}`,
      `- Publishable evidence: ${brief.publishableEvidence}`,
      `- Quality risks: ${brief.qualityRisks.join("; ")}`,
      "",
    ]),
  ].join("\n");
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value.endsWith("\n") ? value : `${value}\n`);
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value = "true"] = arg.slice(2).split("=");
    out[key] = value;
  }
  return out;
}
