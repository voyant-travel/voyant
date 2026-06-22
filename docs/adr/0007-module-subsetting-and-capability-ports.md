# ADR-0007: Module subsetting and capability ports

- **Status:** Proposed (2026-06-22)
- **Relates to:** [consolidated-deployments-rfc](../architecture/consolidated-deployments-rfc.md) (Workstream B / D.1), [ADR-0006](./0006-live-availability-search-contract.md) (capability-gated adapters as precedent), [custom-modules](../architecture/custom-modules.md)
- **Implemented by:** Phase 1 runtime mechanism (this PR) — `createVoyantApp({ exclude, overrideCapabilities })`, `FRAMEWORK_CAPABILITY_GRAPH` (with `isRequired`), and the pure `findCapabilityGaps` / `findCapabilityProviders` / `subsetStandardManifest` validators. Schema-side subsetting and the `PeopleDirectory` port extraction (Phases 1-schema → 4) are follow-ups.

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

The model follows **Medusa**, whose commerce modules are *default-on* (loaded out
of the box, never enumerated) and *replaced by registering a different
implementation at the same module key* (gated by a `canOverride` flag), with core
modules marked `isRequired` so they can be swapped but never removed. Voyant keeps
the default-on stance — which the framework manifest was already designed for
("a new standard module auto-joins the default set; the deployment doesn't
re-list it") — and adopts Medusa's *override-by-key* and `isRequired`, but keys on
the **capability** rather than the module so the deployment never holds two knobs
that must agree.

## Decision

**1. Two ways to pare the default set — remove and replace.** The standard set is
the default; `createVoyantApp` gains two knobs, each for a distinct intent:

```ts
createVoyantApp({
  providers,                                     // substitute impl lives here, typed
  exclude: ["@voyant-travel/flights"],           // REMOVE: a module you don't run
  overrideCapabilities: ["people-directory"],    // REPLACE: displaces the default provider
  modules: deploymentLocalModules,
})
```

- `exclude` removes a module entirely (a non-flights operator drops flights).
- `overrideCapabilities` names a **capability token**; the standard module that
  provides it is **auto-displaced**. You reference the capability, not the
  module, so "drop relationships" and "I provide people-directory" can't fall out
  of sync — the single failure mode of an `exclude` + separate-flag design.

The substitute *implementation* is injected through the typed `providers`
container — Voyant's DI seam, type-checked, unlike Medusa's stringly `resolve`
path. `overrideCapabilities` only declares *which* capability is taken over.

The same subset feeds drizzle-config generation, so routes **and** schema drop
together — no "routes gone, tables still migrated" split. `db doctor` is extended
to validate the post-subset manifest/registry/schema parity. *(Schema-side
alignment is the immediate follow-up; Phase 1 ships the runtime subset.)*

**2. A capability dependency graph, validated at build.** Every module declares,
on its graph entry, the capability tokens it `provides`/`requires`, plus an
`isRequired` flag (Medusa's) for foundational modules:

```ts
// FRAMEWORK_CAPABILITY_GRAPH
"@voyant-travel/identity":      { isRequired: true }   // cannot be excluded
"@voyant-travel/relationships": { provides: ["people-directory"] }
"@voyant-travel/bookings":      { requires: ["people-directory"] }
```

Composition resolves the graph and fails loudly — a **boot error with a named
message**, never a runtime 500 — when: a still-mounted module's `requires` is
unmet by any provider or override (`"people-directory" required by bookings,
legal, storefront`); `exclude` names an `isRequired` module (override it instead);
or `overrideCapabilities` names a token no module provides (a no-op typo). This is
what makes subsetting safe rather than sharp.

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
already extracted). A HubSpot deployment then does: set
`overrideCapabilities: ["people-directory"]` (auto-displacing relationships) +
inject `hubspotPeopleDirectory` into `providers` + a HubSpot-backed intake
persistence — never naming the relationships module at all.

**4. Portable vs. removable is explicit.** Only the *read/upsert + intake* surface
is portable. Deep CRM features — activities, communications, segments, person
relationships, merges, custom fields, notes, payment methods — have **no
cross-module consumers** (only the CRM admin UI). They are removed wholesale with
the module; they are not part of any port.

## Consequences

- **Replacement is first-class, not a fork.** "Run CRM on HubSpot" is
  `overrideCapabilities` + a port impl in `providers` — the same injection seam
  the framework already uses for storage, FX, and notifications. The default
  provider displaces automatically; the deployment never names it.
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
- **Excluding a module does not auto-drop its augmenting extensions.** An
  extension's mount prefix (`HonoExtension.extension.module`) is a *path*, not a
  foreign key to a mounted module's `name` — the standard set legitimately
  contains, e.g., a `proposal` extension that mounts under `quote-versions` with
  no module of that name. So a name-match "orphan" check is unsound (it would
  reject the full set at boot). `exclude` filters both the module and extension
  manifest lists, so a deployment dropping a module with augmenting extensions
  (e.g. `bookings` + `finance/bookings-create-extension`, which mounts under
  `/v1/admin/bookings`) must list those extension specifiers too, else the
  excluded module's surface partially leaks. Auto-cascade needs explicit
  module→extension *ownership* metadata in the graph — a follow-up. (The CRM
  replacement headline case is unaffected: no standard extension targets
  `relationships`.)

## Phasing

1. **Dependency graph + validated subsetting** — `provides`/`requires`/`isRequired`
   in `FRAMEWORK_CAPABILITY_GRAPH`; `createVoyantApp({ exclude, overrideCapabilities })`
   with auto-displacement, filtering the runtime manifest (schema generation
   next); `db doctor` parity over the result. Ships the mechanism with safety, no
   ports extracted yet. *(This PR ships the runtime half.)*
1b. **Module→extension ownership + cascade** — declare which standard extensions
   belong to each module so excluding/displacing a module auto-drops (or validates)
   its augmenting extensions, closing the partial-surface-leak gap above. Plus the
   schema-generation alignment so the subset drops tables, not just routes.
2. **Extract `PeopleDirectory`** — narrow legal + storefront from direct
   `relationships` imports to the port; relationships becomes the default impl.
   After this, relationships is genuinely excludable backend-side.
3. **Reference substitute** — a HubSpot `PeopleDirectory` + intake persistence as
   the proof the port fits an external CRM (mirrors ADR-0006's "validate the
   generic contract against a real third party").
4. **Admin UI subsetting** — drop excluded modules' admin nav; stabilize the
   `/v1/admin/people` picker contract so embedded pickers work against a substitute.

## Alternatives considered

- **`include` allowlist instead of default-on + subtract.** Rejected: it inverts
  the framework manifest's deliberate design ("a new standard module auto-joins
  the default set; the deployment doesn't re-list it"), so every new standard
  module would force every deployment to opt in. Voyant is batteries-included —
  the common deployment runs *most* of the set — so a denylist (remove) plus
  override is little boilerplate for the rare case, where an allowlist is much for
  the common one. Medusa reaches the same conclusion: commerce modules are loaded
  out of the box, never enumerated.
- **`exclude` + a separate `provideCapabilities` flag for replacement.** Rejected
  (this was the first cut of Phase 1): two knobs the caller must keep in agreement
  — `exclude` the module *and* declare the capability it provided — which silently
  breaks if they drift. Keying replacement on the capability (`overrideCapabilities`)
  auto-displaces the provider, so there is one source of truth. This is Medusa's
  override-by-key, keyed on the capability rather than the module.
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
