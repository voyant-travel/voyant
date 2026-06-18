---
"@voyant-travel/relationships": minor
"@voyant-travel/quotes": minor
"@voyant-travel/framework-migrations": patch
---

Custom-fields unification (phase 3a — `custom_fields` column on quote + activity). `activities` (relationships) and `quotes` gain a `custom_fields jsonb default '{}'` column (framework bundle migration `0003`), completing entity coverage for all four EAV entity types (person, organization, quote, activity) ahead of repointing the value API to the column. Additive — no behavior change yet. Oracle-verified.
