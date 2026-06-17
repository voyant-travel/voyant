# ADR: D.1 — framework-owned aggregate migration bundle + multi-source collector

- **Status:** Accepted (implementation in slices; foundation landed)
- **Date:** 2026-06-17
- **Amends:** `migration-resilience-rfc.md` (voyant#1608) "Migration generation & ordering" — *light amendment*, the single combined history is preserved; only **ownership** moves deployment → framework.
- **Implements:** `consolidated-deployments-rfc.md` Workstream **D.1**.
- **Validated by:** `spikes/d1-migration-collector/run.mjs` (7/7 on Postgres 16).
- **Does NOT supersede #1608.** D.2 (package-owned migrations) would; it is out of scope here and gated behind its own ADR.

## Context

Workstreams A–C + the operator-settings extraction made the *code* upgrade seamless: a standard deployment bumps `@voyant-travel/framework`, runs `voyant doctor`, and merges no framework-owned files. But the **database** still has an upgrade tax: today the **deployment owns and regenerates** the combined migration folder (`starters/operator/migrations/` + its `meta/_journal.json`) from the aggregate schema (`drizzle.schemas.generated.ts`). When a bumped module changes its schema, the fork must **regenerate migrations** — that regeneration *is* the merge-shaped upgrade tax this whole effort exists to remove.

Drizzle gives no cross-package migration discovery, so this is Voyant-specific work the reference framework gets free from its ORM.

## Decision

Move migration-history **ownership** from the fork to the framework, while keeping the **single, aggregate-generated history** #1608 defines.

1. **Framework ships the standard-profile bundle.** A package (`@voyant-travel/framework-migrations`) ships the aggregate migration bundle generated from the standard profile's `drizzle.schemas.generated.ts` — *exactly as the fork generates it today, only the owner changes*. (Bundle generation is a later slice; this ADR + the collector land first.)
2. **A multi-source collector applies sources in order.** A deployment applies the **framework bundle first**, then its **own** `migrations` (link tables, starter-local schema, custom). Order across sources is `(release-epoch → source priority → in-source sequence)`; for D.1's two sources, **framework-before-deployment** is the load-bearing invariant (deployment link tables FK into framework tables).
3. **One ledger, version-independent.** Applied migrations are recorded in a single `_voyant_migrations(source, tag, content_hash, applied_at)` ledger keyed by **`(source, tag)`** — never by version. A framework upgrade that re-ships historical migration files resolves to the **same** keys, so an upgrade never re-runs old migrations. `introducedInVersion` (if ever needed) is metadata only.
4. **Content-hash immutability.** A shipped migration is immutable once applied: if a `(source, tag)` already in the ledger arrives with a different `content_hash`, the collector **hard-errors** rather than silently diverging.
5. **Ordering is per-run, not a global invariant.** Within one run the order is framework-first. On a later upgrade, a *new* framework migration applies *after* deployment migrations that ran in an earlier run — correct and safe because DDL is forward-only and the ledger tracks only what's applied. (Surfaced by the spike; stated here so nobody assumes deployment migrations are globally last.)
6. **Aggregate replay as the oracle.** Keep `drizzle.schemas.generated.ts`. An aggregate-replay test applies **all** collected migrations onto a fresh DB and asserts equality with the aggregate-schema snapshot — catching cross-source drift per-source generation can't. (Later slice.)

## Transition (do not strand existing forks)

The legacy single-folder runner (`starters/operator/scripts/migrate.ts`, reading drizzle's `__drizzle_migrations` by `created_at`) and the new collector **coexist** during cutover:

- **Baseline/import.** An existing deployment marks the framework migrations "through version X" as already represented in the new `_voyant_migrations` ledger (so the collector does not try to re-apply history the DB already has via the legacy ledger).
- **`voyant doctor` proves parity *before* switching runners** — replay/aggregate-schema parity must pass before a deployment flips from the legacy runner to the collector.
- Both paths stay green so no fork is stranded mid-cutover.

## Scope boundary (D.1 vs D.2)

D.1 is clean for the **standard profile** (a deployment mounting exactly the standard module set). A deployment that **adds/removes modules** diverges from the fixed aggregate bundle — it pins to the standard profile or moves to **D.2** (package-owned migrations + a topological collector), which *supersedes* the single-history model and needs its own ADR. D.1 deliberately does not solve arbitrary module subsets.

## Implementation slices

1. **Foundation (this ADR + the collector).** `@voyant-travel/framework-migrations` exports the productionized multi-source collector — `planMigrations`, `applyMigrations` (the `(source, tag, content_hash)` ledger, per-migration transactions, statement-breakpoint splitting, content-hash immutability) + `loadMigrationFolder`. Integration tests reproduce the spike's 5 scenarios against Postgres. **No live-runner change.**
2. **Bundle generation.** Generate the standard-profile aggregate bundle into the package from `drizzle.schemas.generated.ts`; a `verify:` gate keeps it in sync.
3. **Aggregate replay oracle.** Replay-all-onto-fresh-DB == aggregate snapshot, wired into `voyant doctor`.
4. **Cutover.** Switch `migrate.ts` to the collector (framework bundle → deployment migrations) with baseline/import + doctor parity; legacy path preserved.

The risky core (multi-source apply, idempotency, ordering, immutability) is **validated**; slices 2–4 are well-understood plumbing, with slice 4 (the live-history cutover) the one to stage most carefully.
