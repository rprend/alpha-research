# What Universities Say They Are For

Status: publication draft for editorial review

Source artifact: `docs/experiments/university-mission-statement-drift/reports/result.json`

Audit packet: `docs/experiments/university-mission-statement-drift/reports/audit-packet.json`

Evidence audit: `docs/experiments/university-mission-statement-drift/reports/post-evidence-audit.json` passed 23/23 checks.

## Thesis

University purpose is usually argued about in abstractions: truth, citizenship, excellence, innovation, service, inclusion, leadership, economic mobility. But universities also describe themselves in public web pages, and those pages can be collected as a historical language layer.

This artifact does not prove that universities have changed their institutional purpose. It asks a narrower question: what can current and archived university self-description pages show us, and what would a stronger study need before making public claims about mission drift?

## Corpus Note

The current corpus contains 22 processed pages:

- 10 current university pages
- 12 historical Wayback snapshots
- year range: 2000-2026
- historical evidence across 7 institutions and 8 years
- 3 historical years with at least two institutions: 2003, 2005, and 2020

The audit packet reports 0 automatic flags after replacing a short Harvard 2010 snapshot.

This is not a census of universities. It is a source-probed corpus for testing whether institutional self-description can become a measurable historical layer.

## Finding 1: Current Pages Are Heavy With Global, Knowledge, Innovation, And Civic Language

In the 10 current pages, the largest term families are:

| Term Family | Count |
| --- | ---: |
| global/leadership | 98 |
| truth/knowledge | 52 |
| innovation/impact | 47 |
| civic/public | 37 |
| inclusion/belonging | 23 |
| excellence/prestige | 17 |
| career/economy | 6 |

These counts are not a direct measure of what universities value. They are a map of language in collected public pages.

Still, the shape is suggestive. Current university self-descriptions often combine older knowledge language with global, leadership, innovation, public-service, and inclusion language. That mix is exactly the kind of rhetorical surface a larger longitudinal study should examine.

## Finding 2: Historical Pages Exist, But The Layer Is Thin

The historical layer contains 12 Wayback snapshots from 2000 through 2020.

The snapshot table includes Harvard, University of Pennsylvania, Duke, MIT, Cornell, Princeton, and Stanford. The years with more than one institution are 2003, 2005, and 2020.

That is enough to show that a historical source layer is feasible. It is not enough to make sweeping claims about American higher education.

The strongest public claim right now is not `universities changed from truth to impact`. The stronger claim is:

> University self-description can be studied over time, but the source layer has to separate current pages, archived pages, catalogs, strategic plans, speeches, and mission statements.

## Finding 3: Current And Historical Pages Should Not Be Collapsed

The historical term-family totals are:

| Term Family | Count |
| --- | ---: |
| global/leadership | 34 |
| civic/public | 24 |
| truth/knowledge | 20 |
| innovation/impact | 20 |
| excellence/prestige | 11 |
| career/economy | 5 |
| inclusion/belonging | 2 |

Those totals are useful as audit leads, not as a trend line by themselves. The historical layer has fewer pages, fewer institutions, and page-type instability. Archived HTML can include navigation, templates, scripts, and page fragments. Some pages are about pages, some are mission pages, and some are institutional overview pages.

For that reason, current-page totals and historical totals should not be compared as if they were equivalent samples.

## Finding 4: The Best Next Study Is Genre-Separated

The next version should not simply scrape more pages and count more words. It should separate source genres:

- mission statements
- about pages
- catalogs
- strategic plans
- president speeches
- commencement speeches
- admissions pages
- public-service pages

Each genre answers a different question. Mission statements state institutional purpose. Strategic plans state priorities. Catalogs describe requirements and curricular structures. Speeches stage leadership rhetoric. Admissions pages address prospective students and families.

Mission drift becomes meaningful only when those layers are kept separate.

## What This Can Support

This artifact can support a source-caveated methods post:

- university self-description is measurable as public web text
- current pages and archived pages can be collected together but must be interpreted separately
- term families can identify where to audit language
- like-for-like historical comparison is the next requirement

It should not support a broad claim that universities as a whole have abandoned one purpose for another. It should not infer institutional motive from term counts. It should not quote snippets without checking the audit packet and source pages.

## Why This Matters

Universities are unusually good subjects for Archive Signals because they are both knowledge institutions and self-explaining institutions. They constantly tell students, donors, governments, alumni, faculty, and the public what they are for.

Those explanations leave traces. The traces are imperfect, but they can be collected.

The quantitative humanities question is not whether a word count can settle a debate about higher education. It cannot. The question is whether a carefully built source layer can make the history of institutional self-description more inspectable.

## Limitations

This corpus has 10 current pages and 12 historical snapshots. It is not representative of all universities. The historical snapshots cover 7 institutions and 8 years, with only 3 years containing at least two institutions.

Wayback pages preserve public page availability, not stable institutional intention. Archived HTML can include navigation and template text. Current pages may be structured differently from archived pages. Term counts are directional evidence and should be used to guide reading, not replace it.

## Next

The stronger study should build a larger, genre-separated corpus:

- current and archived mission statements
- catalogs at fixed decade checkpoints
- strategic plans
- president and commencement speeches
- source-layer-specific trend lines
- manually audited snippets for high-signal terms

Only then should the public essay ask whether university purpose language has drifted from truth and civic formation toward innovation, impact, global leadership, inclusion, or economic language.

For now, the result is simpler and still useful: university purpose leaves a public language trail, and that trail can be measured if the source layers stay visible.
