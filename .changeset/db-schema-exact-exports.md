---
"@voyantjs/db": patch
---

Expose concrete schema file subpaths in the published `@voyantjs/db` export map so Vite/Rollup can resolve deep imports such as `@voyantjs/db/schema/iam/kms`.
