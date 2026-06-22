# ADR-0007: Module subsetting and capability ports

- **Status:** Proposed (2026-06-22)
- **Relates to:** [consolidated-deployments-rfc](../architecture/consolidated-deployments-rfc.md) (Workstream B / D.1), [ADR-0006](./0006-live-availability-search-contract.md) (capability-gated adapters as precedent), [custom-modules](../architecture/custom-modules.md)
- **Implemented by:** Phase 1 runtime mechanism (this PR) — `createVoyantApp({ exclude, provideCapabilities })`, `FRAMEWORK_CAPABILITY_GRAPH`, and the pure `findCapabilityGaps` / `subsetStandardManifest` validators. Schema-side exclusion and the `PeopleDirectory` port extraction (Phases 1-schema → 4) are follow-ups.

## Context

A deployment cannot currently drop or replace a standard module. `createVoyantApp`
always mounts the full `FRAMEWORK_RUNTIME_MANIFEST` and only **appends** the
deployment's local modules (`packages/framework/src/create-app.ts:20-23`,
`packages/framework/src/manifest.ts:11-14`). The D.1 scope froze the standard
profile deliberately to ship Workstream B and punted subsetting to "a later
workstream." This is that workstream.

The forcing use case is **replacement, not just removal**: a deployment that runs
its CRM on HubSpot wants to drop `@voyant-travel/relationships` (people,
organizations, activities, segments, signals) yet keep booking, quoting, and
contract rendering working — those still need to resolve a `personId` /
`organizationId` to a name, address, and travel snapshot.

Two facts from the codebase shape the design:

1. **The mechanism to subset already exists.** `composeFromManifest`
   (`packages/hono/src/composition.ts:71-101`) mounts *strictly* what the manifest
   names and throws on a missing factory. Subsetting is "pass a shorter manifest";
   the registry can stay whole. What is missing is a *safe, config-driven* way to
   do it, and alignment with the schema/migration side.

2. **There are two manifests that can drift.** `voyant.config.ts` `modules` drives
   schema/migration/CLI (`db doctor`, drizzle config), while
   `FRAMEWORK_RUNTIME_MANIFEST` drives runtime mounting. They are *not* identical
   lists today — `db doctor` exists precisely to diff them. A naive runtime
   `exclude` would un-mount routes while still migrating the dropped module's
   tables.

3. **One real port already works; others bypass it.** Bookings reads person/org
   *only* through injected closures —
   `resolveBillingPersonById`, `resolveBillingOrganizationById`,
   `loadPersonTravelSnapshot`, `upsertPersonFromContact`
   (`packages/framework/src/composition.ts:464-491`) — so bookings is *already*
   swap-ready. But `packages/legal/src/contracts/contract-variables.ts:34` imports
   `relationshipsService` directly (`getPersonById` / `getOrganizationById` /
   `listAddresses`), and `legal/src/contracts/service-contracts.ts` +
   `customer-portal/service-public-impl.ts:25` import `relationships` schema and
   services directly. The lead-intake write path, by contrast, is *already*
   abstracted behind `StorefrontIntakePersistence`
   (`runtime/storefront-intake-runtime.ts`) — a precedent for the write port.

Without a declared dependency graph, a bare `exclude` flag is just a sharper-edged
fork: it would boot or 500 in production when a still-mounted module reaches for a
capability that is no longer there.

## Decision

**1. Unify on one manifest with a subtract.** `voyant.config.ts` becomes the
single source of truth for *both* runtime and schema. The framework standard set
is the default; the deployment subtracts from it. `createVoyantApp` gains:

```ts
createVoyantApp({
  providers,
  exclude: ["@voyant-travel/relationships"],   // pares the standard set
  modules: deploymentLocalModules,
})
```

The same `exclude` set feeds drizzle-config generation, so routes **and** schema
drop together — no "routes gone, tables still migrated" split. `db doctor` is
extended to validate the post-exclude manifest/registry/schema parity.

**2. A capability dependency graph, validated at build.** Every module declares,
on its manifest entry, the capability tokens it `provides` and `requires`:

```ts
// relationships
{ resolve: "@voyant-travel/relationships", provides: ["people-directory"] }
// bookings
{ resolve: "@voyant-travel/bookings", requires: ["people-directory"] }
```

Composition resolves the graph: excluding a module whose capability is still
`require`d by a mounted module — and not satisfied by an injected alternate — is a
**build/boot error with a named message** (`"people-directory" required by
bookings, finance — provide an alternate or exclude them too`), never a runtime
500. This is the part that makes `exclude` safe rather than sharp.

**3. Capability ports, so a module can be *replaced*.** A capability token is
backed by a typed **port** on `FrameworkProviders`. The owning module is the
*default implementation*; consumers read through the port, never by importing the
module. For CRM the port is `PeopleDirectory`, scoped to exactly what the coupling
map proved other modules need:

```ts
interface PeopleDirectory {
  getPersonById(db, id): Promise<PersonRef | null>
  getOrganizationById(db, id): Promise<OrganizationRef | null>
  listAddresses(db, entity: "person" | "organization", id): Promise<Address[]>
  findPersonByContactPoint(db, kind, value): Promise<PersonRef | null>
  upsertPersonFromContact(db, contact, ctx): Promise<string>   // returns personId
  loadPersonTravelSnapshot(db, personId, { kms }): Promise<PersonTravelSnapshot | null>
}
```

`relationshipsService` already satisfies this surface, so the default impl is
free — the work is *narrowing* legal + storefront from direct imports to the port.
The lead-intake write surface stays its own port (`StorefrontIntakePersistence`,
already extracted). A HubSpot deployment then does: `exclude` relationships +
inject a `hubspotPeopleDirectory` for the port + a HubSpot-backed intake
persistence.

**4. Portable vs. removable is explicit.** Only the *read/upsert + intake* surface
is portable. Deep CRM features — activities, communications, segments, person
relationships, merges, custom fields, notes, payment methods — have **no
cross-module consumers** (only the CRM admin UI). They are removed wholesale with
the module; they are not part of any port.

## Consequences

- **Replacement is first-class, not a fork.** "Run CRM on HubSpot" is `exclude` +
  inject a port impl — the same injection seam the framework already uses for
  storage, FX, and notifications.
- **Breaking a deployment becomes a build error.** The `provides`/`requires` graph
  turns silent runtime breakage into a named composition failure listing the
  unsatisfied consumers.
- **Decoupling debt must be paid first.** `legal` (contract variables + party
  search over `personDirectoryView`) and `storefront` customer-portal currently
  import `relationships` services/schema directly; until they read through
  `PeopleDirectory`, relationships is not actually excludable. This is the bulk of
  the implementation, and it is mechanical, not speculative.
- **The admin UI is a separate, later concern.** `@voyant-travel/relationships-react`
  hooks and the CRM admin nav assume the module is present; person/org *pickers*
  embedded in bookings/quotes/trips UIs read its API. Excluding the backend module
  must also drop the CRM admin surface and repoint pickers at the replacement's
  `/v1/admin/people` contract. Phase 1 ships the backend port; the UI contract is
  Phase 2.
- **Schema for excluded modules is not auto-dropped.** Excluding stops *future*
  migration of those tables; an existing deployment that excludes a module still
  owns its historical tables and must drop them deliberately. `db doctor` reports
  orphaned-schema drift.

## Phasing

1. **Dependency graph + validated `exclude`** — `provides`/`requires` on manifest
   entries; `createVoyantApp({ exclude })` filtering runtime + schema; `db doctor`
   parity over the result. Ships the mechanism with safety, no ports yet.
2. **Extract `PeopleDirectory`** — narrow legal + storefront from direct
   `relationships` imports to the port; relationships becomes the default impl.
   After this, relationships is genuinely excludable backend-side.
3. **Reference substitute** — a HubSpot `PeopleDirectory` + intake persistence as
   the proof the port fits an external CRM (mirrors ADR-0006's "validate the
   generic contract against a real third party").
4. **Admin UI subsetting** — drop excluded modules' admin nav; stabilize the
   `/v1/admin/people` picker contract so embedded pickers work against a substitute.

## Alternatives considered

- **Bare `exclude` flag, no dependency graph.** Rejected: it is the hand-filtered
  `createApp` fork with nicer syntax — still 500s in production when a consumer's
  capability vanishes. The graph is the point.
- **Per-module feature flags instead of capability ports.** Rejected: flags gate
  *behavior within* a module; they do not let a *different* implementation satisfy
  a consumer. Replacement needs an injected port, not a boolean.
- **Let consumers keep importing `relationships` directly and stub it.** Rejected:
  a stub of the full `relationshipsService` surface (50+ methods, schema tables,
  views) is far larger than the ~6-method read port and re-couples every consumer
  to the CRM's internal shape. The port is the minimal contract the coupling map
  actually proved.
- **Two manifests, sync them by tooling.** Rejected: `db doctor` already exists to
  paper over the drift; a config-time subtract that feeds both removes the drift
  at the source instead of detecting it after.
