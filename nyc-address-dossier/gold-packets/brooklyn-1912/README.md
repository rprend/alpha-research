# Gold packet — brooklyn-1912

20 sampled windows (60 OCR lines each) across the volume.

Protocol:
1. Annotator A corrects every `annotator-A/*.json` against the matching `*.ocr.txt`; B likewise, independently.
2. Adjudicate disagreements together; the adjudicated files become `gold/`.
3. Record per-field agreement (Cohen's κ) in `KAPPA.md`.
4. Score the parser: precision/recall vs gold. Plan gate: ≥95% precision / ≥90% recall
   before parsed entries enter dossier events.

The draft rows are the PARSER'S OUTPUT — they are there to speed correction, not to be trusted.
