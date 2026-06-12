# Gazetteer worklist — brooklyn-1912 (boro 3)

_Generated 2026-06-12T17:33:12.713Z_

Street-name match coverage: **9,226 / 49,170 entries (18.8%)** have a street name that exists in modern PAD.
The rest fail for two distinct reasons — OCR damage (fix: re-OCR/fuzzy match) vs genuine
historical renames (fix: era alias table). Top unmatched street strings by entry volume:

| entries | street string (normalized) |
|---|---|
| 615 | FULTON |
| 433 | PACIFIC |
| 358 | BERGEN |
| 345 | DEAN |
| 316 | DECATUR |
| 310 | HANCOCK |
| 284 | MADISON |
| 277 | JEF AVENUE |
| 223 | BWAY |
| 223 | STREET MARK'S AVENUE |
| 223 | HALSEY |
| 202 | HART |
| 201 | LAF AVENUE |
| 196 | HERKIMER |
| 194 | UNION |
| 188 | 3D AVENUE |
| 186 | STREET JOHN'S PLACE |
| 183 | 10 |
| 178 | 53D |
| 161 | MONROE |
| 158 | COURT |
| 152 | 50 |
| 152 | MACON |
| 143 | 57 |
| 143 | CLINTON |
| 143 | PALMETTO |
| 142 | 40 |
| 142 | PREST |
| 140 | HENRY |
| 137 | 52D |
| 135 | WILBY AVENUE |
| 135 | 55 |
| 135 | PULASKI |
| 132 | BWICK AVENUE |
| 130 | 11 |
| 125 | 58 |
| 124 | LEONARD |
| 121 | WOODBINE |
| 116 | 51 |
| 116 | CARROLL |

Next actions: (1) alias entries for recognizable renames go into a curated
`gazetteer/aliases-3.json`; (2) high-volume OCR garbage motivates the local-VLM
re-OCR pass on those pages; (3) re-run the parse report after each fix and watch the
geocode rate climb. This ranking IS the prioritization — top 10 rows cover the bulk.
