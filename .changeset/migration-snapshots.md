---
---

Squash drift in `templates/operator` and `templates/dmc` migrations (#473).

Both templates' `migrations/meta/` had broken snapshot chains — `templates/operator` was missing 12 of 30 snapshot files (gaps at 0002–0004 and 0020–0029), `templates/dmc` was missing 2 of 3. `drizzle-kit generate` failed outright on operator with a snapshot-collision error and required a manual workaround on dmc, forcing recent feature PRs (e.g. #467) to hand-roll SQL instead of generating it.

This squashes both templates' migration folders to a single fresh `0000_baseline.sql` representing the current schema state. Same approach used twice before in repo history (commits `f667127c7`, plus the original dmc consolidation) — templates are starting points, not production state, so squashing is safe.

After this PR:
- `pnpm --filter operator exec drizzle-kit generate` runs cleanly and reports "No schema changes, nothing to migrate" until a real schema change lands.
- `pnpm --filter dmc exec drizzle-kit generate` does the same.
- Future module additions can be expressed via `drizzle-kit generate` (no more hand-rolled SQL).

**Operator note:** anyone running `templates/operator` against an existing dev/staging DB that has applied any of the old `0001_…`–`0029_…` migrations will see a hash mismatch on the first migrate against this PR (the new `0000_baseline.sql` has a fresh hash). Resolution: drop and re-init the DB, or seed the `__drizzle_migrations` table with the new hash by hand. Templates have no production data attached — fresh init is the expected workflow.

No package version bump (this changeset has no scoped packages — it's repo-state hygiene).
