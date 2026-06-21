---
"@voyant-travel/relationships": patch
---

Stop relationships people reads/updates from breaking when `person_directory` is missing (fixes #1971).

`personDirectoryView` is a `pgView(...).existing()`, so drizzle-kit never emits its DDL — neither the per-package relationships migration source nor `drizzle-kit push` materialises it. A schema-derived operator DB therefore lacked the view, and every relationships read that hydrates contact points failed with Postgres `42P01`: list people degraded to un-hydrated rows, while get/create/update person 500'd.

- The view is now created by the deployment migration source (it spans the relationships `people` and identity `identity_contact_points` tables, so — like the cross-module link tables — it ships in the deployment folder the collector applies last, after both owning packages' tables exist).
- Defense-in-depth: the by-id read path (and CSV export) now degrade to base rows on hydration failure, matching the list path, instead of 500ing.
- `updatePerson` no longer backfills omitted identity fields from the hydrated read before syncing — a partial PATCH that omits email/phone/website now leaves those contact points untouched instead of deleting them when the directory read has degraded. `syncPersonIdentity` treats an omitted (`undefined`) field as "leave unchanged"; only an explicit null/empty value clears it.
- Fixed the stale schema comment that pointed at the wrong migration.
