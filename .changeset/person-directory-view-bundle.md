---
"@voyant-travel/framework-migrations": patch
"@voyant-travel/relationships": patch
---

Ship the `person_directory` view in the framework migration bundle (fixes #1971).

`personDirectoryView` is a `pgView(...).existing()`, so drizzle-kit never emits its DDL — the view only ever existed in starter baselines. A schema-derived operator DB (built from the framework bundle) therefore lacked the view, and every relationships read that hydrates contact points failed with Postgres `42P01`: list people degraded to un-hydrated rows, while get/create/update person 500'd.

- `@voyant-travel/framework-migrations` now ships `0008_person_directory_view` (idempotent `CREATE OR REPLACE VIEW`), so schema-derived deployments get the view regardless of baseline. The replay-parity oracle seeds the same DDL into its `drizzle-kit push` reference (push skips `.existing()` views) to keep the fingerprint in parity.
- `@voyant-travel/relationships` defense-in-depth: the by-id read path (and CSV export) now degrade to base rows on hydration failure — the same fallback the list path already used — instead of 500ing. Also fixes the stale schema comment that pointed at the wrong migration.
