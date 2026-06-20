---
"@voyant-travel/framework-migrations": patch
---

D.2 parity-check correctness fixes (found validating real legacy→D.2 deployment transitions on Neon production-copy branches):

- **`expectedSchema` now honors `ALTER TABLE … DROP COLUMN`** — a column added by an earlier migration and dropped by a later one (e.g. a deployment experiment later reverted) is no longer expected at baseline. Without this the import-baseline parity check demanded 31 columns that a deployment had deliberately dropped.
- **`expectedSchema` now honors `ALTER TABLE … RENAME COLUMN`** — a renamed column is expected under its NEW name, not the original the baseline declared (e.g. a deployment that renames a package column).
- The parity-failure error no longer recommends `drizzle-kit push` (unsafe in production); it explains that a behind database must reach the cutline via its normal migration path, or be dropped + FRESH-migrated if disposable, and clarifies that import-baseline only records the cutline — it never alters schema.
