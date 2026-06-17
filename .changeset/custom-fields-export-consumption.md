---
"@voyant-travel/relationships": minor
---

Custom-fields unification (phase 4b — export consumption). The people CSV export now surfaces custom fields: `exportPeopleCsv` appends a column per **export-visible** custom field (`customFieldsVisibleIn(registry, "person", "export")`, resolved per-request from the route runtime), with the field label as the header and the stored value as the cell (objects/arrays as JSON). This is the visibility payoff of the unified registry — a field declared `visibility.export` shows up in the export by construction, unlike the old side-table values that readers couldn't see. Invoice + search follow the same `customFieldsVisibleIn` pattern in their packages.
