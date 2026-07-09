---
"@voyant-travel/framework-migrations": patch
"@voyant-travel/framework": patch
---

Harden the managed custom-module migration path (voyant#3069 follow-ups).

- `loadModuleBundleSource` now resolves ESM-only ("import"-only `exports`)
  packages. `require.resolve` applies the CommonJS `require` condition and throws
  `ERR_PACKAGE_PATH_NOT_EXPORTED` for import-only packages (the repo's publish
  shape), which silently skipped a schema-owning package's committed
  `migrations/`. It now falls back to a `node_modules` package-root walk that
  ignores export conditions when `require.resolve` rejects.
- `customSource` is now validated: `validateVoyantProject` rejects a non-object
  `customSource` or a non-string-array `customSource.modules`/`.extensions`, and
  `getVoyantProjectMigrationMetadata` defensively coerces the value before
  deriving migration sources — so a malformed snapshot (e.g. a string instead of
  an array) no longer yields one "package" per character.
