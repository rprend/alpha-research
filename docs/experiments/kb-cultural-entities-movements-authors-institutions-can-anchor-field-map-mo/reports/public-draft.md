# Public Draft Scaffold: A Field Map From Local Cultural Entities

The local humanities knowledge base can now produce a first field map of cultural anchors without going back to the web. The map combines linked entities, source-provided authors, candidate person clusters, institutions, and source topics, then asks which of those anchors also appear in local works or source-document metadata.

## What The Local Map Contains

- 5420 candidate entity anchors are available across linked entities, author rows, person clusters, institutions, and source topics.
- 455 anchors have exact-label links into local works or source-document metadata.
- 250 top evidence links are written for manual inspection.

The largest entity layers are:

- candidate_person_cluster: 1713 entities, 11 with local evidence links.
- source_author: 1713 entities, 11 with local evidence links.
- source_topic: 1058 entities, 332 with local evidence links.
- linked_entity: 919 entities, 94 with local evidence links.
- institution: 17 entities, 7 with local evidence links.

The largest categories are:

- author: 1713 entities.
- name-only: 1707 entities.
- source-subject: 1058 entities.
- concepts: 125 entities.
- works: 125 entities.
- movements: 120 entities.
- artists: 109 entities.
- genres: 98 entities.

Candidate anchors to inspect first:

- musical (linked_entity; 12 evidence links).
- Renaissance (linked_entity; 12 evidence links).
- Symbolism (linked_entity; 12 evidence links).
- authority (linked_entity; 12 evidence links).
- evidence (linked_entity; 12 evidence links).
- Baroque (linked_entity; 11 evidence links).
- Romanticism (linked_entity; 11 evidence links).
- opera (linked_entity; 9 evidence links).
- William Shakespeare (linked_entity; 12 evidence links).
- Nature (linked_entity; 12 evidence links).

Representative local evidence links:

- 19th century -> Ca’ Rezzonico in the 19th Century: The Dispersal of its Collections and the New Uses of the Palace (doaj-humanities).
- 20th century -> Crafts by Nomads of the Ural and Turgai Regions at the Beginning of the 20th Century (doaj-humanities).
- 21st century -> Inclusive Excellence: A new University Model in the 21st Century Based on Universal Design for Learning (doaj-humanities).
- 21st century -> Holocaust Impiety in 21st Century Graphic Novels: Younger Generations ‘No Longer Obliged to Perpetuate Sorrow’ (doaj-humanities).
- Abraham Lincoln -> Abraham Lincoln's First Inaugural Address (project-gutenberg).
- Abraham Lincoln -> Widger's Quotations from the Project Gutenberg Editions of the Works of Abraham Lincoln (project-gutenberg).
- academic art -> Brazilian academic art (wikidata-cultural-entities).
- acculturation -> Favoriser l’acculturation aux discours universitaires dans le programme passerelle Horizon académique : la prise de notes comme objet d’enseignement-apprentissage (doaj-humanities).

## What This Does Not Yet Prove

- This is a local field-map scaffold, not final authority control. Candidate people clusters are deterministic name clusters and must be reviewed before person-level claims.
- Evidence links use exact normalized label matching against local titles, authors, descriptions, venues, subjects, and topic labels; absence of a link does not mean absence from the field.
- Wikidata categories and source-provided topics are useful anchors but contain broad cultural and public figures, so publication claims need source-specific filtering.
- The pipeline uses local metadata and stored KB tables only. It does not fetch new entity data or resolve external identifiers beyond existing KB rows.
- Rights metadata is inherited from the source document rows; quote decisions still require source-specific review.
