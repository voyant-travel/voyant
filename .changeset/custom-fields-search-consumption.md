---
"@voyant-travel/relationships": minor
---

Custom-fields unification (search consumption). The people search now matches **search-visible** custom fields: `listPeople`/`buildPersonSearchCondition` accept the search-visible field set (`customFieldsVisibleIn(registry, "person", "search")`, resolved per-request from the route runtime) and OR a `custom_fields ->> key ILIKE term` condition per field into the query. So a custom field declared `visibility.search` becomes findable in the people search — the search payoff of the unified registry. Mirrors the export consumption; invoice follows the same pattern in finance.
