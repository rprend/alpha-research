# Public Draft Scaffold: What Museum Metadata Makes Visible

The local humanities knowledge base can compare museum and cultural-collection metadata at the level of fields: object dates, classification labels, departments, accession identifiers, image URLs, and public-domain/CC0-like indicators.

## What The Local Corpus Contains

- 988 local cultural-collection metadata rows across 4 sources.
- 953 rows carry derived object/item/acquisition year information.
- 784 rows include normalized classification/type metadata.
- 494 rows include image URLs as metadata.
- 352 rows carry public-domain/CC0-like source indicators.

Source coverage starts unevenly, which is itself one of the findings:

- library-of-congress: 308 rows, 296 dated, 150 classified, 142 with image URLs.
- met-collection-api: 255 rows, 251 dated, 234 classified, 152 with image URLs.
- smithsonian-open-access: 225 rows, 206 dated, 200 classified, 0 with image URLs.
- cleveland-museum-open-access: 200 rows, 200 dated, 200 classified, 200 with image URLs.

Acquisition fields are concentrated in sources that expose accession metadata:

- met-collection-api: 251 accession numbers and 251 accession years.
- cleveland-museum-open-access: 200 accession numbers and 0 accession years.
- library-of-congress: 0 accession numbers and 0 accession years.
- smithsonian-open-access: 0 accession numbers and 0 accession years.

Image and rights metadata should be treated as an inspection guide, not a reuse license:

- cleveland-museum-open-access: 200 image URLs; 200 also carry public-domain/CC0-like indicators.
- met-collection-api: 152 image URLs; 152 also carry public-domain/CC0-like indicators.
- library-of-congress: 142 image URLs; 0 also carry public-domain/CC0-like indicators.
- smithsonian-open-access: 0 image URLs; 0 also carry public-domain/CC0-like indicators.

Representative records to inspect first:

- cleveland-museum-open-access: A Genoese Lady with Her Child (c. 1623–25; Painting).
- cleveland-museum-open-access: A Hare and a Leg of Lamb (1742; Painting).
- cleveland-museum-open-access: A Woman's Work (1912; Painting).
- cleveland-museum-open-access: Adeline Ravoux (1890; Painting).
- cleveland-museum-open-access: Altarpiece with The Passion of Christ (c. 1440s; Painting).
- cleveland-museum-open-access: Amitabha Triad (1400s; Sculpture).
- cleveland-museum-open-access: Amulet in the Form of a Seated Figure with Bovine Head (c. 4700–2920 BCE; Jade).
- cleveland-museum-open-access: Antiochus and Stratonice (c. 1838; Painting).

## What This Does Not Yet Prove

- Rows are local KB object/collection metadata, not complete institutional collections.
- Image URLs are retained as metadata; media files are not stored and reuse requires item-level rights review.
- Public-domain and CC0 indicators are source metadata fields and should be verified before publication reuse.
- Acquisition coverage is source-specific: Met/Cleveland expose accession fields; LOC and Smithsonian rows often do not.
- Date precision is derived from source object/item date strings and accession years where available; raw date strings remain authoritative.
