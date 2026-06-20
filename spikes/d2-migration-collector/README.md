# Spike — D.2 package-owned migrations + topological collector

Throwaway harness validating the **D.1 → D.2 transition** before any production
package or publish contract is touched. See `docs/architecture/migration-collector-d2.md`.

## The question it retires

Can one migrate path be correct for **both** starting states, given the D.1
`framework` bundle is frozen and its `0000_framework_baseline.sql` creates every
standard table with bare `CREATE TABLE`?

- **Fresh DB** (arbitrary subset): the monolithic bundle is **decommissioned**
  from the apply path — only per-package sources run.
- **Existing D.1 DB**: schema already materialised by the bundle (recorded under
  `framework/*`). Re-running those `CREATE TABLE`s would collide.

## The mechanism it proves (ADR decision 5)

One collector path, branch on **presence of `framework/*` ledger rows**:

| | Fresh | Existing D.1 |
|---|---|---|
| bundle-covered package baselines | **execute** | **import-baseline** (record, do *not* run), gated by a parity guard |
| genuinely-new package increments | execute | execute |
| `framework/*` rows | absent | kept as **inert audit history**, never rewritten |

No applied ledger row is ever re-keyed, so the `(source, tag)` immutability law
is never tripped — and no bundle-owned table is re-created.

## Modelled world

`db → {catalog, operator_settings} → deployment(links)` — an FK chain that fails
if applied out of order. Ordering comes from a topo-sort of `requiresSchemas`
(real packages declare it in `package.json`) with `voyant.config` module order
as the tie-breaker. Each package declares `baselineTags` — the migrations the
retired bundle already materialised (see "finding" below).

## Scenarios (all PASS)

1. **Fresh D.2** — package sources only, topo order, no `framework/*`, FK chain holds, post-bundle increment applies.
2. **Existing D.1 → D.2** — baseline tags import-baselined (same table oids → nothing re-created), new increment executes, old `framework/0000` preserved, ledger carries both.
3. **Negative control** — naively executing a bundle-owned baseline raises `duplicate_table` (proves import-baseline is required, not optional).
4. **Idempotent re-run** — nothing applied or baselined.
5. **Cycle rejection** — a `requiresSchemas` cycle throws.
6. **Convergence** — a fresh D.2 DB and a transitioned D.1 DB end up with an identical schema, compared **column-for-column** (a table-name check would miss column/index drift between a package baseline and the bundle it replaces — e.g. a missing `product.sku`).

## Finding to fold back into the ADR

The transition needs a per-package **baseline cutline**: each package must
declare which of its migrations the retired framework bundle already
materialised (modelled here as `baselineTags`). On an existing D.1 DB the
collector import-baselines those and executes everything after. Without this
declaration the collector cannot tell "already created by the bundle" from
"genuinely new", and would either re-create (collision) or skip new DDL. This is
a concrete addition to ADR decision 5 / Required Slice 1 (generation workflow
must emit the cutline).

## Run

```sh
TEST_DATABASE_URL=<docker test DB url> node spikes/d2-migration-collector/run.mjs
```

Isolates itself in a `voyant_d2_spike` schema and drops it on exit; any
throwaway Postgres works.
