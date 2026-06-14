# Study Template: How do museum collections describe acquisition, classification, and public-domain image availability?

## Local Tables

- source_documents
- rights
- pages
- works
- objects
- venues
- authors
- citations
- topics

## Unit Of Analysis

collection object or public metadata record

## Claim Strength

moderate local evidence for scoping; needs source-specific normalization before publication claims

## Date Coverage

strong-enough-for-scoping: 592 matched local records carry content years spanning 1404-2026; 3 matched sources look longitudinal-ready for scoping.

## Minimum Next Steps

- Review evidence.json for quote restrictions and source URLs.
- Run queries.sql against data/knowledge-base/processed/knowledge-base.sqlite.
- Normalize dates and source-specific identifiers before longitudinal claims.
- Use missing-data.md before any fresh scrape.

## Publication Concept

- Museum Collections Describe Acquisition, Classification, Public-domain Image Availability
- What Local Humanities Data Shows About museum collections describe acquisition, classification, public-domain image availability
- A Field Map Of museum collections describe acquisition, classification, public-domain image availability

## Candidate Charts And Tables

- Objects by institution and classification
- Creation/acquisition year coverage histogram
- Rights and image availability by source

## Follow-Up Acquisition

- Expand cultural-collection API pulls by institution, classification, and accession/acquisition fields.
- Record item-level rights and image availability before quoting or reproducing object descriptions.

## Why This Matters

This question can now start from local cultural-collections evidence instead of fresh scraping, with 18 direct hits and top local sources including Metropolitan Museum of Art Collection API, Cleveland Museum of Art Open Access API, Smithsonian Open Access.
