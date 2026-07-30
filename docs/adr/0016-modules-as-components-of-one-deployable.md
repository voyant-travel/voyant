# ADR-0016: Modules are components of one deployable; boundaries are enforced, not packaged

- **Status:** Proposed (2026-07-30)
- **Relates to:** [#3898](https://github.com/voyant-travel/voyant/issues/3898),
  [ADR-0002](./0002-contract-packages.md) (contract packages — upheld),
  [ADR-0007](./0007-module-subsetting-and-capability-ports.md) (superseded — this ADR
  records the consequence),
  [ADR-0008](./0008-convention-driven-deployment-surface.md),
  [ADR-0012](./0012-application-authoring-and-product-defaults.md),
  [unified-deployment-graph](../architecture/unified-deployment-graph.md),
  [module-provider-plugin-taxonomy](../architecture/module-provider-plugin-taxonomy.md),
  [packaged-admin-rfc](../architecture/packaged-admin-rfc.md),
  [managed-profile-runtime](../architecture/managed-profile-runtime.md)
- **Supersedes the open question left by:** ADR-0007's supersession, which removed the
  subsetting implementation without recording what the package boundary is *for*.

## Context

The package-per-module layout was adopted on the premise that **deployments would
select modules**. That premise no longer holds anywhere in the tree:

- One starter remains; `starters/federated-operator` is absent from `pnpm-workspace.yaml`.
- `createVoyantApp({ exclude })` has zero call sites. The only surviving occurrences are
  prose in `packages/hono/src/composition.ts:111,131` and `packages/hono/src/openapi.ts:70`.
- ADR-0007 is superseded; its runtime-manifest implementation, framework manifest
  projections, and synthetic unit generators were deleted.
- `packages/framework/src/operator-distribution.ts` is one line re-exporting
  `@voyant-travel/operator-standard`.
- `unified-deployment-graph.md` already states the outcome: *"lowered to one resident
  Node application."*

Meanwhile the package boundary provides **no isolation**. Modules import each other's
services and raw Drizzle tables directly:

```ts
// in a sibling package's src/, not bookings'
import { bookingItems, bookings, bookingTravelers } from "@voyant-travel/bookings"
```

`bookings` has ~37 in-repo importing packages; `finance/src` references 22 distinct
siblings. Some of this coupling is inherent — a booking genuinely *is* a join across
catalog, availability, finance, traveler identity, and legal documents. Some is drift,
because nothing forbids reaching past a module's public surface. **Today the two are
indistinguishable**, which is the core problem.

Enforcement was attempted, imperatively and per-module: 47 scripts matching `*authority*`
totalling 5,578 lines, chained into `verify:architecture`, written against hardcoded
package arrays (`scripts/check-client-package-boundaries.mjs` opens with a literal list
of 13 paths). No generic dependency-boundary tooling is installed. None of these scripts
would have caught the table import above, and none generalise to the next one.

### What changed the analysis

An earlier reading justified the Tier 1 and Tier 2 packages by pointing at `pms` (~76
packages) and `acme-travel` (38). Both are now excluded:

- **`pms` is cancelled.**
- **`acme-travel` is a private local testbed** — its README opens *"Acme Travel is a
  local Voyant testbed"* — not an independent deployment.

Recomputed, the packages with a genuine **third-party** consumer are ~22:

| Consumer | Pulls |
|---|---|
| `plugin-netopia` | `core`, `finance`, `hono`, `notifications`, `payments`, `utils` |
| `plugin-smartbill` | `core`, `finance`, `finance-react`, `hono`, `storage`, `ui`, `utils` |
| `module-ro-fiscal` | `bookings`, `core`, `data-sdk`, `finance`, `hono`, `workflows` |
| `connect-sdk` | `catalog`, `cruises`, `flights-contracts` |
| `hisky-connector` | `flights` |
| `algolia-adapter` | `catalog-contracts` |
| `smartbill-app` | `admin-extension-sdk`, `apps`, `ui` |
| `voyant-cloud` (portal, site) | `i18n`, `storefront`, `storefront-react`, `ui`, `types` |

The remaining ~96 packages have no third-party consumer. They are justified by a
different mechanism entirely: **source-free managed delivery**. `packaged-admin-rfc.md`
records that *"there is no source-installed layer anymore"*, `managed-profile-runtime.md`
describes a *"source-free Node implementation"*, and
`voyant-cloud/apps/voyant-operator-runtime` installs ~100 published packages at **exact
pinned versions** rather than building from source.

This matters for honesty about the rationale: the packaging of domain and presentation
packages rests almost entirely on the managed delivery model, not on third-party reuse.
If managed delivery ever became source-installed, that justification would need to be
rewritten rather than assumed.

## Decision

### 1. Four tiers, one dependency direction

The packages already fall into tiers; nothing names or enforces them. Name them, and
declare each package's tier in its `voyant.package.v1` manifest.

| Tier | Contents | May depend on |
|---|---|---|
| **0 · Contracts** | Zod schemas, inferred types, vocabularies, schema-version constants. No Drizzle, Hono, or DB. | Tier 0 |
| **1 · Domain runtime** | Tables, services, routes, workflows, booking engines | Tier 0; Tier 1 **public surfaces only** |
| **2 · Presentation** | `-react`, `ui`, admin registries, extension SDK | Tier 0, Tier 2, admin client |
| **3 · Composition** | `framework`, `hono`, `operator-standard`, the starter | everything |

**The rule is `3 → 2 → 1 → 0`, never backwards.** Tier 2 never imports Tier 1 server
runtime. A Tier 0 package never imports its runtime sibling — this is ADR-0002's arrow,
stated once and enforced rather than restated per package.

This single rule covers both known defect classes: the cross-package Drizzle-table import
above, and Connect's `import type { SourceAdapter } from "@voyant-travel/catalog"` where
`SourceAdapter` is specified by ADR-0002 to live in `catalog-contracts`.

### 2. Package-ness is decided by consumer, not by domain

A directory becomes a published npm package **iff** one of these holds:

1. Something outside the operator graph imports it — plugin, connector, adapter, edge
   worker, admin extension.
2. It is the dependency-light Tier 0 surface for such a consumer (ADR-0002).
3. It is delivered to a **source-free managed deployment** that installs published
   artifacts rather than building from source.

Everything else is a directory inside a package, with the tier rule still enforced across
directories. Domain separation alone is not a justification. New packages state which
clause they satisfy in the PR description.

### 3. One boundary checker, plus graph-derived conformance

Two families replace the 47 hand-written scripts:

- **Boundary checker** — one engine reading tier, allowed dependencies, and public
  surface from each `voyant.package.v1`, with a ratcheting violations file so CI is green
  on day one and the count can only decrease. We already run this pattern in
  `verify:v1-package-cleanup:strict --fail-on-temporary`.
- **Graph conformance** — the checks that are *not* static import rules (runtime-binding
  provenance, subscriber registration, OpenAPI coverage) asserted over
  `voyant.resolved-graph.v1` instead of hardcoded package arrays.

The reason there are 47 scripts is not 47 distinct rules; it is that each was written
imperatively against a literal package list, so every new module required a new script.
Derived from the graph, they collapse into a small set of generic assertions.

### 4. Two runtime shapes, not three

- **Operator** — one resident Node app, whole graph, no subsetting.
- **Edge apps** (storefront, federated, portal, site) — Workers consuming Tier 0 + Tier 2
  + the storefront SDK. This is the only real subsetting boundary and the only one that
  should exist.

The third, phantom shape — "operator with modules subtracted" — has no implementation, no
consumer, and a superseded ADR. Remove its residue from `packages/hono/src` and from the
architecture docs.

### 5. Substitution lives at adapters and providers, permanently

Ports exist where a vendor exists: payments, connectors/fulfillment, indexer/search,
storage, notifications, cache, database. **No ports for business modules.** This is a
standing rule, not a deferral.

### 6. One Postgres schema; module-owned tables are private

Not isolated schemas — the in-memory-join tax is not worth paying for a domain whose
entanglement is largely genuine. The narrower, enforceable rule: **a module's tables are
private to it.** Cross-module access goes through its service or a link definition. This
is what converts invisible coupling into either a declared dependency or a ratchet entry,
and it is the only way to learn which coupling is inherent and which is drift.

## Consequences

- **Package count barely moves, and that is the intended outcome.** With the three-clause
  test, ~96 packages survive on source-free managed delivery. Realistic pruning is a
  handful — currently only `identity-contracts` has no consumer and no forward-looking
  vertical. The deliverable is enforcement, not consolidation.
- **~5,600 lines of bespoke checkers become ~2 engines plus generated assertions.**
- **Coupling becomes visible.** Every cross-module reach-in is either declared or in the
  ratchet, with a number that only decreases.
- **Package creation becomes mechanical** rather than argued.
- **ADR-0002 is upheld and finally enforced.** The `*-contracts` split is correct; the
  arrow it specifies has never been checked, which is why `connect-cruises`,
  `connect-adapter`, and `plugin-voyant-connect` take runtime dependencies where a
  contracts package publishes the same type. `connect-flights` is the reference
  implementation.
- **The managed-delivery dependency is now explicit.** If source-free delivery changes,
  clause 3 and roughly 96 packages need re-justification.
- Short-term cost: tier declarations across 118 manifests, and a migration of Connect onto
  Tier 0.

## Alternatives considered

**Full module isolation with substitution ports.** Rejected, restating ADR-0007's
reasoning, which still holds: *"decoupling every consumer (`legal`, storefront
customer-portal, the bookings billing/traveler resolvers) onto a port — and keeping a
parallel DTO contract in sync — is a large refactor whose only payoff is CRM-replacement,
which is not a v1 goal."* Isolation buys substitution; there are no substituters for
business modules. The real substitution axis is adapters and providers, where the boundary
already works (decision 5).

**Collapse to a single package.** Rejected. The publishing boundary is load-bearing for
source-free managed delivery and for version-pinned third parties.

**Status quo — keep adding authority checkers.** Rejected. The count grows linearly with
modules, the checks encode single historical migrations, and they do not catch the defect
class they exist to prevent.

## Non-goals

- No change to the shared Postgres schema, to `packages/framework` composition behaviour,
  or to the resolved deployment graph format.
- No deletion of `*-contracts` packages for tidiness. Unadopted is not the same as
  unnecessary — see #3898 W3.
- No revival of module subsetting or capability ports in any form.

## Sequencing

1. Tier declarations plus the boundary checker with a fully-open ratchet. CI green day one;
   no code moves. This is the keystone — everything after it cannot regress.
2. Migrate Connect onto Tier 0 (#3898 W3).
3. Retire the subsetting narrative in `packages/hono/src` and the architecture docs.
4. Convert authority checkers into graph assertions, deleting as they are subsumed and
   recording removed line counts.
5. Ratchet down table reach-ins opportunistically; resolve `identity-contracts`.

Steps 1–3 change how the codebase behaves. Steps 4–5 are debt paydown that can run for a
year without blocking anything.
