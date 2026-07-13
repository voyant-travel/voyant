---
"@voyant-travel/accommodations": minor
"@voyant-travel/admin-host": minor
"@voyant-travel/catalog": minor
"@voyant-travel/cruises": minor
"@voyant-travel/framework": minor
"@voyant-travel/inventory": minor
"@voyant-travel/operator-standard": minor
"@voyant-travel/runtime-core": minor
"@voyant-travel/runtime": minor
---

Make `@voyant-travel/runtime` the single public Node project host, move low-level
host primitives to `@voyant-travel/runtime-core`, and remove the package-owned
runtime CLI. Rename remaining first-party operator-specific subpaths to generic
runtime or runtime-support surfaces.
