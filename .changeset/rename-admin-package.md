---
"@voyantjs/admin": minor
---

Published `@voyantjs/admin` (renamed from the previously-private `@voyantjs/voyant-admin`). The redundant scope/prefix was inconsistent with the rest of the workspace (`@voyantjs/auth`, `@voyantjs/crm`, …). Templates that referenced `@voyantjs/voyant-admin` as `workspace:*` now use `@voyantjs/admin` and resolve to the published package on scaffold.

Includes the full publish setup: `tsconfig.build.json`, `build` / `prepack` scripts, `files: ["dist"]`, `publishConfig.exports` for all 9 subpaths (`.`, `./extensions`, `./providers/{theme,locale,query-client,admin-provider}`, `./lib/{i18n,initials}`, `./types`).
