# Unified Deployment Graph

Status: draft architecture rule / RFC consolidation
Related:

- `voyant#3080` - unified deployment profiles and target adapters
- `platform#1023` - companion platform issue
- [deployment-targets.md](./deployment-targets.md)
- [managed-profile-contract.md](./managed-profile-contract.md)
- [managed-profile-runtime.md](./managed-profile-runtime.md)
- [migration-collector-d2.md](./migration-collector-d2.md)
- [module-provider-plugin-taxonomy.md](./module-provider-plugin-taxonomy.md)
- [packaged-admin-rfc.md](./packaged-admin-rfc.md)
- [ADR-0007 module subsetting](../adr/0007-module-subsetting-and-capability-ports.md)
- [ADR-0008 convention-driven deployment surface](../adr/0008-convention-driven-deployment-surface.md)

## Purpose

The deployment/profile RFC has accumulated many good design notes: modules,
plugins, migrations, admin routes, API routes, scopes, tools, workflows,
webhooks, action-ledger metadata, package admission, lifecycle operations, and
more.

Those notes are directionally coherent, but together they describe a framework
rewrite if treated as one feature. This document is the controlling
architecture plan. It preserves the core direction, normalizes vocabulary, and
sets a v1 cut so the work can ship incrementally.

The rule is:

**Voyant deployments are built from an explicit, versioned, declarative graph.
The graph is validated by doctor/build tooling, then lowered into target-specific
runtime artifacts.**

## Non-Goals

This document does not require v1 to ship every facet discussed in the RFC
comments.

Out of v1:

- a broad plugin lifecycle hook API
- a full supply-chain security platform
- live destructive uninstall/purge
- per-facet trust tiers
- graph-derived admin slots and copy
- graph-derived action-ledger metadata
- graph-derived tools and MCP manifests
- a full replacement-port story for every required standard module

Those may become follow-up work. They must not block the first explicit graph
cut.

## Core Decisions

### 1. Use an explicit graph, not runtime profile modes

Profiles such as `operator-standard` or `pms-standard` should be scaffolding
presets, not runtime modes.

```sh
voyant new --preset pms-standard
```

The scaffold writes a project declaration with concrete selected modules and
plugins. After that point, the deployment is just a graph.

The resolved graph must not admit packages or choose runtime behavior based on
profile names. Existing managed snapshots still carry `profile: "operator"` in
[managed-profile-contract.md](./managed-profile-contract.md); the graph resolver
should treat that as a compatibility bridge and translate it into selected
modules, capabilities, product surfaces, and substrate requirements.

If a project records a scaffold source, that field is diagnostic only:

```ts
presetLineage: "operator-standard" // optional; never used for graph closure
```

Package compatibility should target framework version, runtime target,
deployment mode, and required capabilities/surfaces. It should not target
`profiles: ["operator"]`.

### 2. Default to Voyant Cloud, but keep target lowering separate

The authoring model should be target-neutral. `voyant deploy` can default to
Voyant Cloud when no target is specified, but the same graph should lower to
self-hosted Node, Fly.io, Railway, GCP, AWS, or another Node target.

Voyant Cloud may provision database, Redis, auth, secrets, and platform API keys
automatically. Self-hosted targets must provide equivalent config and secrets.
The graph contract should be the same.

### 3. No opaque `install(app)` hook

Modules and plugins declare contributions. They do not mutate an app through an
opaque install callback.

This is load-bearing. Doctor, Cloud image planning, migration planning, admin
composition, OpenAPI emission, package admission, and target adapters all depend
on being able to inspect declarations.

### 4. `defineModule` is a manifest, not a required god-object

The module manifest is a versioned interface made of optional facets. A module
only declares the facets it actually owns.

```ts
export const bookings = defineModule({
  schemaVersion: "voyant.module.v1",
  id: "@voyant-travel/bookings",
  localId: "bookings",
  provides: {
    capabilities: ["booking.records"],
  },
  requires: {
    capabilities: ["identity.people"],
  },
  api: bookingsApi,
  schema: bookingsSchema,
  migrations: bookingsMigrations,
  workflows: bookingsWorkflows,
  events: bookingsEvents,
})
```

Every facet must be independently adoptable. Adding an `admin` facet later
must not force a schema-only module to adopt admin conventions.

### 5. Plugins are distribution bundles

Keep the runtime taxonomy from
[module-provider-plugin-taxonomy.md](./module-provider-plugin-taxonomy.md):

- modules own durable product or infrastructure capabilities
- providers are concrete implementations of narrow seams
- adapters connect Voyant to external systems
- extensions customize existing module behavior
- plugins are distribution bundles

Do not create separate `defineAdapterPackage` and `definePlugin` authoring
interfaces with the same shape. Use one distribution shape:

```ts
export const smartbill = definePlugin({
  schemaVersion: "voyant.plugin.v1",
  id: "@voyant-travel/plugin-smartbill",
  provides: {
    ports: [providePort(FiscalizationPort, smartbillFiscalization)],
  },
  api: smartbillWebhookRoutes,
  workflows: smartbillWorkflows,
})
```

It may still be described as an adapter package in taxonomy and docs.

## Identity

Every resolved graph unit has two identities:

- `packageName` - distribution identity, for example `@voyant-travel/bookings`
  or `@acme/voyant-loyalty`
- `id` - graph identity, globally unique and stable

For a package that exports one module/plugin, `id` should default to the package
name. If one package exports multiple graph units, use a package-scoped suffix:

```ts
id: "@acme/voyant-suite#loyalty"
```

Graph ids must be fully qualified package ids with an optional package-scoped
fragment. Bare ids are only legacy authoring aliases for first-party standard
modules, never canonical resolved ids.

`localId` is optional human-facing shorthand inside the package. It is not a
global graph key.

First-party standard aliases such as `bookings`, `catalog`, and `finance` may
remain accepted authoring inputs for compatibility, but the resolver must
normalize them to their package graph ids.

## Graph Invariants

These rules apply to every v1 facet and to every deferred facet when it ships.

### Stable entity ids

Every graph entity must carry a stable string id in the resolved graph:

- module/plugin units
- route bundles
- subscribers
- workflows
- schedules
- links and linkable entity declarations
- migrations
- generated entry modules

Deferred facets must bind to these ids. For example, action-ledger metadata
will reference routes, tools, workflows, and subscribers by id; admin copy will
reference route/page ids; slots will reference page and slot ids; the permission
catalog will reference route bundles and tools.

No v1 graph entity should be anonymous or identified only by array order. A
factory may derive conventional ids for existing first-party declarations during
migration, but the resolved graph must expose the final id explicitly. Doctor
must reject duplicate ids and missing ids with stable diagnostics.

Child entity ids should generally be namespaced under the owning graph unit:

```ts
"@voyant-travel/bookings#api.admin"
"@voyant-travel/bookings#schedule.release-expired-holds"
"@voyant-travel/bookings#migration.20260709120000_add_hold_state"
```

This is the stable attachment surface for later facets. It is also how doctor
can point a diagnostic at one route bundle, subscriber, workflow, schedule, link,
or migration without relying on path or array position.

### Single instance in v1

V1 allows one selected instance per graph id.

Selecting the same module/plugin id twice with different config is out of v1.
Multi-instance support needs a separate `instanceId` model because it affects
migration ownership, secret binding names, schedule ids, admin route ids, API
route ids, webhook endpoints, and diagnostics.

Until that model exists, doctor must fail duplicate graph ids. If a package
needs to connect to multiple external accounts in v1, it should model that as
data/config owned behind one selected graph unit, not as repeated graph
instances.

### Fail-closed facet schema

`voyant.module.v1` and `voyant.plugin.v1` must be closed top-level schemas.
Older tooling must not silently ignore unknown manifest keys.

Validation rules:

- known v1 facets are accepted
- reserved deferred facet names produce `unsupported facet` diagnostics until
  the running toolchain supports them
- unknown non-reserved top-level keys are errors
- package-owned opaque metadata must live under a clearly non-semantic metadata
  field such as `meta`, not as a future-looking facet name

Reserved deferred facet names include:

- `admin`
- `slots`
- `copy`
- `openapi`
- `tools`
- `mcp`
- `permissions`
- `rbac`
- `scopes`
- `actions`
- `audit`
- `i18n`
- `config`
- `secrets`
- `emits`
- `outboundWebhooks`
- `lifecycle`
- `runtime`

This avoids the worst compatibility failure mode: an older resolver accepting a
manifest and silently dropping a facet that a newer package depends on.

These reserved names are top-level manifest facets. Route-owned metadata inside
the `api` facet, such as route OpenAPI metadata or pass-through authorization
metadata, is still allowed when the `api` facet supports it. A top-level
`openapi`, `scopes`, or `permissions` facet remains deferred.

### Deterministic resolved graph

The resolver must emit a deterministic JSON artifact with its own schema
version, for example `voyant.resolved-graph.v1`.

Rules:

- stable ordering for modules, plugins, facets, routes, migrations, workflows,
  subscribers, links, diagnostics, and package records
- no timestamps, random ids, host-specific absolute paths, or environment-only
  values in the canonical artifact
- a content hash over canonical JSON, excluding the hash field itself
- generated entry modules reference the same resolved graph hash

This buys reproducible deploys, graph diff reviews, doctor drift detection, and
Cloud fast paths such as "this graph hash matches the standard operator graph."

## Project And Deployment Declarations

Use two declarations:

- `defineProject` describes the target-neutral desired graph.
- `defineDeployment` binds that graph to a runtime target and substrate.

```ts
// voyant.project.ts
export default defineProject({
  schemaVersion: "voyant.project.v1",
  presetLineage: "operator-standard",
  modules: [bookings(), inventory(), finance()],
  plugins: [smartbill()],
})
```

```ts
// voyant.deployment.ts
export default defineDeployment({
  schemaVersion: "voyant.deployment.v1",
  project,
  target: "voyant-cloud",
  providers: {
    database: "postgres",
    cache: "redis",
    storage: "s3",
    workflows: "voyant-cloud",
  },
})
```

For v1, prefer factory imports over string-only declarations. A preset writes
the imports, so the verbosity is paid by scaffolding, not by the user. String
forms can be added later if there is real demand.

## V1 Facet Cut

The first implementation should only include facets that already map to current
runtime concepts.

Required for v1:

- graph identity: `schemaVersion`, `id`, package identity
- stable ids for every resolved graph entity
- selected modules/plugins
- coarse `provides` / `requires` capability tokens
- API route bundles using existing Hono module/extension concepts
- schema and package-owned migrations
- link/linkable declarations that already use the existing link machinery
- subscribers/events using existing event descriptors
- workflows and workflow schedules using existing descriptors
- target/provider requirements already represented by the current managed
  requirements contract
- package compatibility/admission metadata
- package provenance records from the lockfile
- deterministic resolved graph artifact with a content hash
- closed manifest schemas with fail-closed unknown/unsupported facet handling
- diagnostics with stable codes and source locations

Explicitly defer:

- admin slots
- graph-derived admin copy
- graph-derived OpenAPI beyond route-owned OpenAPI metadata already present
- action-ledger action catalogs
- tools/MCP/agent manifests
- full API scope/RBAC unification
- detailed config/secret DSL
- rich event-emits catalogs, payload visibility policy, and outbound webhook
  deliverability
- destructive uninstall/purge

Some deferred items are high-value and independently shippable. They should be
tracked as follow-up slices, not bundled into the first resolver.

## Requires And Provides

Use two layers.

### Coarse capability tokens

Coarse tokens answer graph-completeness questions:

```ts
provides: {
  capabilities: ["booking.records", "booking.read-model"],
}

requires: {
  capabilities: ["identity.people"],
}
```

Doctor can prove that the selected graph closes: every required token has at
least one selected provider.

Capability tokens are shared vocabulary, so v1 needs namespace rules:

- tokens use dot-case segments, for example `booking.records`
- `voyant.*` is reserved for framework/core capabilities
- unprefixed standard product domains such as `booking.*` and `identity.*` are
  reserved for Voyant-owned standard modules
- third-party packages must use a prefix they control, for example
  `acme.loyalty.points`

Doctor should reject reserved-namespace violations and invalid token syntax.

### Typed ports

Typed ports answer runtime-satisfaction questions:

```ts
provides: {
  ports: [providePort(BookingReadModelPort, bookingReadModelProvider)],
}

requires: {
  ports: [requirePort(BookingReadModelPort)],
}
```

No port should be declared public without a conformance test kit. Private or
experimental ports can exist inside a package, but they cannot be advertised as
replacement-compatible until a provider can run the public kit.

A provider saying it implements a port is only a declaration until the provider
passes that kit.

This matters for replacement promises. If a future external CRM can replace
`relationships`, it must pass the people-directory port tests. Otherwise doctor
would give false confidence.

## Static Metadata And Runtime Introspection

Use a two-phase model.

### Phase 1: pre-admission metadata

Before any package code is imported, tooling can inspect:

- `package.json`
- `voyant.package.v1` metadata
- package manager lockfile version/integrity
- project/deployment declarations
- configured package admission policy

This phase can reject incompatible or unadmitted packages before arbitrary code
executes.

Resolved package records must also capture provenance from the lockfile:

- source kind: registry, workspace, file, or git
- package name and version
- resolved location or lockfile reference
- integrity hash when the package manager provides one

V1 records this data even though admission policy stays minimal. Later trust
tiers can tighten policy without changing the resolved manifest shape.

Minimal package metadata:

```json
{
  "voyant": {
    "schemaVersion": "voyant.package.v1",
    "kind": "plugin",
    "compatibleWith": {
      "framework": "^1.0.0",
      "targets": ["node"],
      "modes": ["managed-cloud", "self-hosted"]
    },
    "requires": {
      "capabilities": ["voyant.admin"]
    }
  }
}
```

V1 package admission checks compatibility and source admission only. It does not
require SBOMs, Sigstore, revocation feeds, advisory policy engines, or
certificate-style admission receipts.

### Phase 2: admitted build-time introspection

After admission, build/doctor may import admitted package code to inspect route
bundles, OpenAPI metadata, tools, admin entries, workflow descriptors, and
other code-owned declarations.

This must be explicit. A graph containing `() => import(...)` thunks is not
itself a serializable artifact. The resolver should emit:

- deterministic JSON manifest data for tooling, reports, and Cloud planning
- generated entry modules for the bundler to statically analyze

This is especially important for admin route assembly. Packaged admin pages need
generated route files or an equivalent code-based route assembly step; a JSON
manifest alone cannot carry lazy page imports.

## Cold-Start Invariant

Manifest modules must be import-cheap.

Rules:

- top-level manifest imports must not pull heavy route, schema, UI, workflow, or
  provider graphs
- executable bodies stay behind lazy imports
- route/page/tool/workflow factories stay lazy
- OpenAPI schemas and event payload schemas must not accidentally pin large
  graphs into the manifest entry
- generated entry modules must preserve lazy boundaries

This is a hard architecture invariant, not an optimization preference. The
operator already depends on lazy graph loading for Node boot and previously
paid a large cost for Worker cold starts.

A checker should enforce manifest import size or dependency shape before this
surface is made public.

## Config And Secrets

Do not commit to a custom schema DSL yet.

Separate two concerns:

- resource requirements and environment validation, which v1 inherits from the
  current managed requirements contract
- module/plugin-owned `config` and `secrets` manifest facets, which are reserved
  until the toolchain explicitly promotes them

When module/plugin-owned config and secret facets are introduced after the first
resolver slice, the current preferred direction is constrained Zod plus metadata
wrappers:

```ts
config: defineConfigSchema({
  schema: z.object({
    companyVatId: z.string().min(1),
  }),
  visibility: {
    companyVatId: "operator-visible",
  },
})

secrets: defineSecretSchema({
  schema: z.object({
    apiToken: z.string().min(1),
  }),
  rotation: {
    apiToken: "supported",
  },
})
```

If a custom DSL is introduced later, it must remain tiny and frozen. It should
not become a second general validation language.

Secret values must not cross workflow boundaries as captured handles. Workflow
steps should rehydrate secrets by logical binding name inside each step context.

Phase 2 may promote `config` and `secrets` from reserved names into supported
facets, but only through the constrained Zod-plus-metadata contract above. A
detailed custom DSL remains explicitly deferred.

## Links And Linkable Entities

Links are part of v1 only where they already map to existing link definitions
and migration ownership. If a module owns link tables or link metadata, the
graph must know that so package-owned migrations and doctor checks do not drift.

Richer cross-module link behavior is deferred:

- graph-derived relationship UI
- automatic admin affordances for linked entities
- cross-module hydration policy
- link-aware permission policy

Until those ship, link tables and deployment-local link migrations should keep
using the existing link machinery.

## Lifecycle

Install, upgrade, and uninstall are graph operations, not module/plugin hooks.

```sh
voyant install @voyant-travel/plugin-smartbill
voyant upgrade @voyant-travel/plugin-smartbill
voyant uninstall @voyant-travel/plugin-smartbill
voyant deploy
```

Do not add public `onInstall`, `onUpgrade`, or `onUninstall` hooks.

Rules:

- install edits the project graph and dependency set
- upgrade changes versions and reruns graph validation/migrations
- uninstall detaches runtime surfaces and retains data by default
- purge is out of v1 and must be explicit, gated, and separately declared if it
  ever ships
- setup/seed work is modeled as idempotent data migrations with an applied-work
  ledger

## Admin Surface

Admin composition is not v1 for the graph resolver, but the direction is:

- packages contribute admin nav/routes/pages through package-owned admin facets
- generated route files or equivalent generated entry modules bind lazy page
  imports into the host router
- slots and copy are follow-up facets
- custom admin pages remain possible through deployment-owned extensions

The first admin slice should be nav/routes only. Slots and graph-derived copy
should follow after the basic generated admin route assembly is stable.

## API, OpenAPI, Scopes, And RBAC

API route declarations should distinguish:

- admin routes
- public routes
- webhook routes
- internal/system routes

V1 route bundles may carry optional pass-through authorization metadata:

```ts
{
  id: "@voyant-travel/bookings#api.admin",
  resource: "booking.records",
  requiredScopes: ["booking.records:read"]
}
```

The v1 resolver does not need to enforce the unified permission catalog, but it
should preserve this metadata and validate its shape and namespace syntax. That
lets first-party packages start carrying permission inputs incrementally before
RBAC/API-key/tool/action-ledger unification ships.

OpenAPI metadata belongs with route declarations. The graph resolver should
collect it after package admission, not require a separate OpenAPI facet first.

API scopes, staff RBAC, user scopes, tool permissions, and action-ledger
capabilities should converge toward one permission catalog, but that is a
follow-up workstream. It is high leverage and should be designed once, not
piecemeal per facet.

## Workflows And Schedules

Public scheduled work should be modeled as workflow schedules, not arbitrary
cron callbacks.

The runtime dispatch key should be a stable schedule id, not a cron expression.
Existing `?cron=<expr>` dispatch should be migrated toward
`?schedule=<stable-id>`.

Low-level runtime maintenance can keep an internal scheduler escape hatch, but
it should not become the module/plugin authoring surface.

Implementation note: v1 graph units lower workflow descriptor
`config.schedule` declarations into nested `workflows[].schedules` entries with
stable graph entity ids. Existing Cloud Scheduler cron callbacks are not modeled
as workflow schedules; they remain runtime maintenance/provisioning metadata
until the scheduler dispatch migration has a stable schedule-id contract.

Implementation note: Node scheduler dispatch now accepts `?schedule=<stable-id>`
and the operator Cloud Scheduler emitter uses that stable id as the runtime
dispatch key. Legacy `?cron=<expr>` URLs remain accepted as a compatibility
fallback for already-provisioned scheduler jobs.

Implementation note: graph-derived workflow schedules carry their `workflowId`
and optional schedule `input` through `provisioning.scheduledJobs`, so the
operator scheduled entrypoint can route them through the workflow runtime by
stable schedule id. Runtime maintenance jobs remain explicit scheduled-job
metadata.

## Events And Webhooks

V1 should include subscribers and workflow event filters that already map to
existing descriptors.

The broader event catalog is deferred:

- declared `events.emits` catalogs
- payload schemas for every emitted event
- visibility policy for event fields
- outbound webhook subscription and delivery policy
- event-to-OpenAPI or event-to-SDK generation

Inbound webhook routes remain API route declarations. Outbound webhook delivery
should be designed with the event catalog follow-up, not squeezed into v1.

## Testing Story

Custom module/plugin authors need a first-class test harness in v1.

Target shape:

```ts
const deployment = await createTestDeployment({
  modules: [loyalty()],
  plugins: [customFiscalPlugin()],
  target: "node",
})

await deployment.doctor.expectClean()
await deployment.migrations.expectReplayParity()
await deployment.routes.expectMounted("/v1/admin/loyalty")
```

The harness should support:

- manifest validation
- graph closure validation
- package compatibility/admission tests
- migration replay/parity tests
- route mounting tests
- event/subscriber tests
- workflow descriptor tests
- port conformance kits
- admin contribution tests when admin facets ship

This is part of the v1 credibility story. A framework that sells extensibility
must give authors a way to prove their extensions are valid.

## Diagnostics

Doctor checks must use a unified diagnostic model from the start.

Each diagnostic should include:

- stable code
- severity: `info`, `warning`, `error`
- source package/module/plugin id
- facet
- source location when available
- human-readable message
- remediation hint when available

Example:

```json
{
  "code": "VOYANT_GRAPH_MISSING_CAPABILITY",
  "severity": "error",
  "source": "@acme/voyant-plugin-loyalty",
  "facet": "requires.capabilities",
  "location": "voyant.project.ts:12",
  "message": "Required capability identity.people is not provided by the selected graph.",
  "hint": "Select the relationships module or another module that provides identity.people."
}
```

Avoid adding ad hoc doctor strings per facet. The many checks in the RFC notes
should collapse into this one diagnostics framework.

`voyant doctor --json` must emit this model as a public machine-readable
contract. CI, Voyant Cloud preflight, and self-hosted deployment automation
should consume the same diagnostics that humans see in the terminal.

Diagnostic codes need a checked-in registry. Tests should prevent codes from
being renamed or reused; new behavior gets a new code. Stable codes are only
stable if the repository enforces that rule.

## First-Party Migration Plan

First-party modules must use the same interface as external modules, but the
first migration should be generated mechanically where possible.

Step zero should be a generator that derives v1 manifests from existing
runtime shapes:

- `HonoModule` / `HonoExtension` route bundles
- package `migrations/` metadata
- existing workflow descriptors
- existing event subscribers
- `FRAMEWORK_RUNTIME_MANIFEST`
- `FRAMEWORK_EXTENSION_OWNERSHIP`
- `FRAMEWORK_CAPABILITY_GRAPH`

This validates the manifest against reality before third-party authors depend
on it, and avoids hand-retrofitting every package up front.

Some first-party schema owners are not active runtime modules in a given
deployment. Examples include foundational schema packages, additional schema
packages, and route-deferred verticals whose migrations still apply. The
resolved graph must still represent those packages as schema-only units with
stable `schema` and `migrations` entity ids, and its package records must cover
every package-backed migration source discovered from the generated schema
manifest. This is the bridge that keeps D.2 package-owned migration discovery
and deployment-graph lowering from drifting while richer per-migration entity
generation lands.

The operator graph now also lowers the first declarative workflow/event-filter
pair from first-party metadata: commerce contributes
`promotions.reindex-all-products`, the `promotion.changed` event, and the
event-filter subscriber that targets that workflow. This is intentionally a
small facet slice: it proves the graph shape for declarative workflow/event
routing without pulling runtime workflow bodies into graph discovery.

Product-side tooling exposes the same graph diagnostics in human and JSON form
through `scripts/emit-deployment-graph.ts --json`, using the checked-in
diagnostic-code registry. The public `voyant doctor --json` command remains the
CLI follow-up; it should consume this report contract rather than inventing a
separate diagnostic model.

## Implementation Phases

Phases 0-2 are the complete v1 deployment-graph program. Phase 1 is the first
deployable vertical slice, not the whole v1. Phases 3-5 are follow-up facets
that build on the same graph contract.

### Phase 0: vocabulary, schema, and generated first-party manifests

- land this document
- define `voyant.project.v1`, `voyant.deployment.v1`, `voyant.module.v1`,
  `voyant.plugin.v1`, and `voyant.package.v1`
- normalize `requires` / `provides` to capabilities plus typed ports
- define stable id rules for every v1 graph entity
- define capability token namespace rules
- define closed manifest schemas and reserved deferred facet names
- generate first-party manifests from existing runtime declarations
- add unified diagnostics types
- add a checked-in diagnostic-code registry
- add import-cheap manifest checker
- add module/plugin test harness skeleton

### Phase 1: resolver, doctor, and one deployable Node target

- resolve explicit project graph
- validate selected graph closure
- validate duplicate graph ids fail under the v1 single-instance rule
- validate package compatibility/admission
- emit deterministic JSON graph manifest with content hash and package
  provenance
- emit generated runtime entry modules
- keep the reference Node target in `starters/operator`; graph artifacts for the
  managed-profile bridge live there, not in a separate managed-operator starter
- make `voyant dev` consume the same resolved graph as doctor/build/deploy
- wire `voyant doctor`
- wire `voyant doctor --json`
- wire one Docker/Node deploy target
- preserve current managed Cloud/default target behavior

### Phase 2: runtime contracts and substrate requirements

- make provider requirements graph-derived
- keep env alias compatibility for existing deployments
- validate resource config, secrets, and provider requirements before boot
- make self-hosted and Voyant Cloud use the same requirements contract

### Phase 3: packaged admin routes

- add graph-derived admin nav/routes
- generate admin route files or equivalent entry modules
- keep route/page imports lazy
- add admin contribution tests
- defer slots and copy until route assembly is proven

### Phase 4: typed ports and adapter conformance

- migrate `FrameworkProviders` toward typed ports where there are real
  replacements
- provide conformance test kits for public ports
- keep adapters as plugin-distributed provider/extension packages

### Phase 5: higher-level graph facets

Candidate follow-ups:

- unified permission catalog for API keys, staff RBAC, tools, and action-ledger
  capabilities
- graph-derived tools/MCP/agent manifests
- action-ledger action metadata
- graph-derived OpenAPI reports
- graph-derived admin copy
- admin slots and UI extension points
- package admission policy hardening for managed Cloud

Each should ship as an independently useful slice, not as part of the first
explicit graph cut.

## Acceptance Criteria For V1

V1 is complete when:

- a preset can scaffold an explicit project graph
- first-party manifests are generated or declared for the standard operator
  graph
- every resolved graph entity has a stable id
- duplicate graph ids fail under the v1 single-instance rule
- `voyant doctor` validates the graph with stable diagnostic codes
- `voyant doctor --json` emits the same diagnostics as the human-readable
  output
- `voyant dev`, `voyant doctor`, build, migrate, and deploy consume the same
  resolved graph contract
- unknown manifest facets fail closed, and reserved deferred facets are not
  silently ignored
- the resolved graph artifact is deterministic and content-hashed
- resolved package records include lockfile-derived provenance
- package compatibility/admission runs before managed plugin import
- package-owned migrations are collected from the selected graph
- API route bundles, subscribers, and workflows are resolved from declarations
- a Node/Docker target can deploy the graph
- self-hosted and Voyant Cloud use the same requirements contract, even if Cloud
  provisions more automatically
- custom module/plugin authors can run the test harness locally

Anything beyond that is a follow-up facet.
