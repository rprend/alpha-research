# ResearchVagueClaim Workflow: University Donation Claim

This experiment applies the **ResearchVagueClaim workflow** to the claim that modern tech elites have not founded universities and rarely endow them.

## Primary Artifacts

- `workflow.md`: reusable ResearchVagueClaim workflow for arbitrary vague, connotative, rhetorical, or internet-native claims.
- `report.md`: human-readable case-study report.
- `report.html`: rendered standalone report with charts.
- `artifacts/result.json`: structured H1/H2/H3 adjudication result.
- `artifacts/gifts.csv`: seed public-major-gift dataset.
- `artifacts/sources.csv`: source inventory and observability notes.
- `artifacts/*.svg`: generated visualizations.

## Rebuild

```bash
node docs/experiments/university-donation-claim/scripts/build.mjs
```

The seed dataset is deliberately limited to high-confidence public major-gift evidence. It can falsify broad visible-major-gift versions of the claim, but it is not a census of all giving, anonymous gifts, donor-advised fund gifts, or share-of-wealth philanthropy.
