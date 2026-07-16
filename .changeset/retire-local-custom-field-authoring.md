---
"@voyant-travel/bookings": minor
"@voyant-travel/core": minor
"@voyant-travel/custom-fields": minor
"@voyant-travel/framework-migrations": minor
"@voyant-travel/quotes": minor
"@voyant-travel/relationships-contracts": minor
"@voyant-travel/relationships": minor
"@voyant-travel/schema-kit": minor
---

Remove project-local TypeScript custom-field declarations, discovery globs,
executable validation callbacks, and code/database merge helpers. The generic
custom-fields package now owns canonical value routes and dispatches operations
to selected entity-owning packages through typed runtime contributions, with no
Relationships compatibility adapter.
