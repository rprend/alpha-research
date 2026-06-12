# What A Museum Collection Looks Like When It Becomes Data

This is a research draft from a full-source corpus from the Cleveland Museum of Art Open Access API.

## Thesis To Test

A structured open museum API makes collection shape measurable: departments, object dates, acquisition proxies, cultures, object types, rights, and image availability become inspectable as data.

## Corpus Note

The current artifact contains 68742 artwork records from 68743 total available API records.

## Central Finding

A structured museum API turns a full open collection into analyzable records, making department, date, culture, rights, and image-availability patterns inspectable for one institution.

## Caveats

- This run covers the full available API pagination except any record withheld, skipped, or duplicated by the API response sequence.
- Object metadata completeness varies by department, object type, date, culture, and image availability.
- Accession-number dates are a rough acquisition proxy; explicit accession_date exists and audit rows identify mismatches before publication claims.
- One open museum collection cannot stand in for museum collections as a whole.

## Next Moves

- Compare the full corpus against the earlier 5,000-record sample to identify sample bias in department, date, and image-availability distributions.
- Audit accession-number year extraction against explicit acquisition fields where available.
- Compare against another open museum API before making cross-institution claims.
- Use the generated chart artifacts in the public draft.
