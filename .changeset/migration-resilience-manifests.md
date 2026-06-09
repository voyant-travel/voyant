---
"@voyantjs/core": minor
"@voyantjs/catalog": patch
"@voyantjs/flights": patch
"@voyantjs/travel-composer": patch
"@voyantjs/workflow-runs": patch
---

Manifest-driven migration schema resolution (#1608).

- `@voyantjs/core` `VoyantConfig` gains `additionalSchemas`, `extensions`, and `schemas` fields (with validation) so a template's migrated schema set is derived from `voyant.config.ts`.
- `catalog`, `flights`, `travel-composer`, and `workflow-runs` declare `package.json#voyant` schema metadata so they resolve into the generated schema manifest (flights pins its non-standard `./reference/local-postgres` subpath).
