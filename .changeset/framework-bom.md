---
"@voyant-travel/framework": minor
---

New `@voyant-travel/framework` BOM (bill of materials) package. Its `dependencies` pin the tested runtime-module set (the 16 mounted modules), so a deployment tracks **one framework version** and upgrades atomically — no per-package compatibility matrix. Deliberately not global lockstep: runtime packages keep independent versions (only changed ones republish, avoiding the per-package npm email spam), and the BOM is the single package that tracks the framework version. The dep list is generated from the membership manifest (`scripts/generate-framework-bom.mjs`), gated in CI via `verify:framework-bom`. Exports `FRAMEWORK_RUNTIME_PACKAGES` for `voyant upgrade`.
