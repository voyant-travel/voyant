---
"@voyant-travel/framework-migrations": minor
---

Add the D.2 dual-path collector engine. `applyD2Migrations(client, sources, { cutline, existing })` applies per-package + deployment sources, import-baselining cutline-covered migrations on an existing database (record-without-execute) while executing fresh databases and post-cutline increments — the retired framework bundle's `framework/*` rows are left as inert history. `loadCutline()` reads the shipped `cutline.generated.json`. The operator migrate runner is rewired to use these in a follow-up.
