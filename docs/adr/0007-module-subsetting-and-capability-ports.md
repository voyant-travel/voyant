# ADR-0007: Module subsetting and capability ports

- **Status:** Proposed (2026-06-22)
- **Relates to:** [consolidated-deployments-rfc](../architecture/consolidated-deployments-rfc.md) (Workstream B / D.1), [ADR-0006](./0006-live-availability-search-contract.md) (capability-gated adapters as precedent), [custom-modules](../architecture/custom-modules.md)
- **Implemented by:** Phase 1 runtime removal (this PR) — `createVoyantApp({ exclude })`, `FRAMEWORK_CAPABILITY_GRAPH` (with `isRequired`), and the pure `findCapabilityGaps` / `subsetStandardManifest` validators. Capability *replacement* (override + `PeopleDirectory` port) is deferred to v2 — see "Deferred to v2" — and tracked as separate follow-up issues (schema-side subsetting; port extraction; HubSpot reference; admin-UI subsetting).

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

The model is **default-on with subtract**: built-in modules always mount (the
framework manifest was already designed this way — "a new standard module
auto-joins the default set; the deployment doesn't re-list it"), and a deployment
*removes* what it doesn't run rather than enumerating what it wants. A foundational
core is marked `isRequired` and cannot be removed. The eventual *replacement* path
(v2) keys on the **capability** rather than the module — name the capability a
substitute provides and the default provider is displaced — so the deployment
never holds two knobs that must agree. This mirrors the prevailing pattern in
mature modular commerce frameworks (default-on built-ins, override-by-key, a
required core), adapted to Voyant's typed dependency-injection seam.

## Decision

Phase 1 (this ADR's shipped scope) is **removal**: a deployment subtracts modules
it doesn't run. **Replacement** — swapping a module's implementation for a
substitute — is the documented v2 design below, deliberately not yet wired,
because the ports it needs don't exist and shipping the knob early would
*relocate* the runtime-500 failure mode rather than eliminate it.

**1. `exclude` removes a module from the default set.** The standard set is the
default; `createVoyantApp` gains one knob:

```ts
createVoyantApp({
  providers,
  exclude: ["@voyant-travel/flights"],   // a module this deployment doesn't run
  modules: deploymentLocalModules,
})
```

`exclude` filters the runtime manifest (and, once the schema side lands, drizzle
generation, so routes **and** tables drop together — `db doctor` validates the
post-subset parity). The registry stays whole; composition mounts strictly from
the manifest, so a dropped specifier simply never builds.

**2. A capability dependency graph, validated at build, makes removal safe.**
Each standard module declares, in `FRAMEWORK_CAPABILITY_GRAPH`, the capability
tokens it `provides`/`requires`, plus an `isRequired` flag for foundational
modules:

```ts
// FRAMEWORK_CAPABILITY_GRAPH
"@voyant-travel/identity":      { isRequired: true }   // cannot be excluded
"@voyant-travel/relationships": { provides: ["people-directory"] }
"@voyant-travel/bookings":      { requires: ["people-directory"] }
```

`exclude` fails loudly — a **boot error with a named message**, never a runtime
500 — when: a still-mounted module's `requires` is left unmet (`"people-directory"
required by bookings, legal, storefront — exclude the consumers too`); `exclude`
names an `isRequired` module; or `exclude` names a specifier not in the standard
set (a typo). This is what makes removal safe rather than a sharper fork. The
`provides`/`requires` edges are also the seam the v2 replacement model plugs into.

**3. Portable vs. removable is explicit.** The graph encodes *which* surface other
modules actually need from a module. For CRM that is `people-directory` —
person/org read + upsert + travel-snapshot. Deep CRM features (activities,
communications, segments, merges, custom fields, notes, payment methods) have
**no cross-module consumers** (only the CRM admin UI), carry no token, and leave
wholesale with the module. This boundary is what a v2 substitute would have to
satisfy — and, just as importantly, what it would *not*.

## Deferred to v2 — capability replacement (override + ports)

The forcing use case (run CRM on HubSpot) is *replacement*, and the intended model
is **override-by-capability**: name a capability token and the standard module that
provides it is auto-displaced, with the substitute injected through the typed
`providers` container — keyed on the capability, not the module, so a deployment
never holds two knobs that must agree. The injection point is Voyant's existing
typed DI seam, not a string-resolved module path, so the substitute is checked
against the port type at compile time.

```ts
// v2 — NOT in this release
createVoyantApp({
  providers,                                   // hubspotPeopleDirectory lives here
  overrideCapabilities: ["people-directory"],  // auto-displaces relationships
})
```

This is **not wired in Phase 1**, by choice. A capability token must be backed by
a typed **port** on `FrameworkProviders` that consumers read through instead of
importing the module — for CRM:

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

That port does **not exist yet**: the provider slot is typed to the concrete
`relationshipsService`, and `legal` (`contract-variables.ts:34`) + storefront
customer-portal still `import { relationshipsService }` directly rather than
reading through a port. So an `overrideCapabilities` knob today would pass
validation, drop the relationships routes, and then **silently mis-resolve** —
legal rendering contracts against the now-absent CRM. That is the exact failure
this ADR exists to prevent, so the knob is withheld until the port lands (Phase 2
below). Phase 1 ships only what is true: removal works; replacement is designed,
not yet available.

## Consequences

- **Removal is safe and config-driven today.** A deployment drops a module it
  doesn't run with one `exclude` line, and a depended-on or required module can't
  be dropped by accident — the graph turns silent runtime breakage into a named
  composition failure listing the unsatisfied consumers.
- **Replacement is designed but not yet usable (v2).** "Run CRM on HubSpot" needs
  the `PeopleDirectory` port + `overrideCapabilities`, neither of which ships here.
  The injection seam exists (storage, FX, notifications already use it), but the
  CRM provider slot is still the concrete service, so the swap isn't possible
  without follow-up (b). The ADR commits to the shape so the v2 work has a target.
- **Decoupling debt is the gate to replacement.** `legal` (contract variables +
  party search over `personDirectoryView`) and `storefront` customer-portal import
  `relationships` services/schema directly; until they read through
  `PeopleDirectory`, relationships can be *removed* (with its consumers) but not
  *replaced*. This is the bulk of follow-up (b), and it is mechanical, not
  speculative.
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

**Phase 1 — removal (this PR, shipped).** `provides`/`requires`/`isRequired` in
`FRAMEWORK_CAPABILITY_GRAPH`; `createVoyantApp({ exclude })` filtering the runtime
manifest, validated by `findCapabilityGaps` + `subsetStandardManifest`. Removal
works end to end; replacement is designed but not wired.

The rest are **follow-ups, filed as separate issues** — sequenced, but
demand-driven past Phase 2 (build the HubSpot/admin work when a deployment
actually needs an alternate CRM, not speculatively):

- **(a) Schema-side subsetting + extension cascade.** Feed `exclude` into drizzle
  generation so tables drop with routes; declare module→extension *ownership* so
  excluding a module also drops its augmenting extensions (closing the
  partial-surface-leak above). Near-term cleanup.
- **(b) Extract the `PeopleDirectory` port (enables v2 replacement).** Retype the
  provider slot from concrete `relationshipsService` to the port; narrow legal +
  storefront off direct imports. Only after this can `overrideCapabilities` be
  wired truthfully. The one follow-up with near-term design merit.
- **(c) HubSpot reference substitute.** A HubSpot `PeopleDirectory` + intake
  persistence proving the port fits an external CRM (mirrors ADR-0006's "validate
  against a real third party"). Demand-driven.
- **(d) Admin-UI subsetting.** Drop excluded modules' admin nav; stabilize the
  `/v1/admin/people` picker contract so embedded pickers work against a substitute.
  Demand-driven.

## Alternatives considered

- **`include` allowlist instead of default-on + subtract.** Rejected: it inverts
  the framework manifest's deliberate design ("a new standard module auto-joins
  the default set; the deployment doesn't re-list it"), so every new standard
  module would force every deployment to opt in. Voyant is batteries-included —
  the common deployment runs *most* of the set — so a denylist (remove) plus
  override is little boilerplate for the rare case, where an allowlist is much for
  the common one — the conventional choice for batteries-included modular
  frameworks, where built-ins load out of the box and are never enumerated.
- **Shipping `overrideCapabilities` (replacement) now, alongside `exclude`.**
  Rejected for Phase 1: the port it needs doesn't exist (the provider slot is the
  concrete `relationshipsService`; legal + storefront import it directly), so the
  knob would validate, drop the routes, then silently mis-resolve — relocating the
  runtime-500 it's meant to prevent. Replacement is the documented v2 design; it
  ships once the `PeopleDirectory` port lands (follow-up (b)). When it does, the
  chosen shape is override-*by-capability* (name the token, auto-displace the
  provider) rather than `exclude` + a separate "I provide X" flag — two knobs that
  can drift — i.e. override-by-key, keyed on the capability.
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
