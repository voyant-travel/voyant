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
- [ADR-0011 agent tool library and MCP](../adr/0011-agent-tool-library-and-mcp.md)

## Purpose

The deployment/profile RFC has accumulated many good design notes: modules,
plugins, migrations, admin routes, API routes, scopes, tools, workflows,
webhooks, action-ledger metadata, package admission, lifecycle operations, and
more.

Those notes are directionally coherent, but together they describe a framework
rewrite if treated as one feature. This document is the controlling
architecture plan. It preserves the core direction, normalizes vocabulary, and
orders the work so it can ship incrementally.

The rule is:

**Voyant deployments are built from an explicit, versioned, declarative graph.
The graph is validated by doctor/build tooling, then lowered into
hosting-specific Node artifacts.**

For this document, the application runtime is **Node only**. "Target-neutral"
means neutral across Node hosting substrates, not neutral across JavaScript
runtimes. Voyant Cloud, Docker, Fly.io, Railway, Cloud Run, and custom adapters
all lower the same graph to a Node application artifact. Cloudflare Workers do
not host this composed application graph and must not add static-composition or
runtime-loading constraints to its module/plugin model. Separate edge-native
storefront or federated applications are outside this deployment graph.

The current `voyant.resolved-graph.v1` implementation is the foundational
substrate for this rule. It proves stable identity, deterministic artifacts,
package admission, diagnostics, migration-source accounting, schedule lowering,
and generated runtime entries. It does **not** by itself complete `voyant#3080`.
The issue is complete only when selected packages own their manifests and all
supported product surfaces are resolved from those package manifests without an
operator-starter catalog or hand-maintained composition layer.

## Non-Goals

The foundational v1 graph does not need every facet discussed in the RFC
comments. The following remain out of the foundational substrate:

- a broad plugin lifecycle hook API
- a full supply-chain security platform
- live destructive uninstall/purge
- per-facet trust tiers
- graph-derived admin slots and copy
- graph-derived action-ledger metadata
- graph-derived tools and MCP manifests
- a full replacement-port story for every required standard module

These are not optional for the architecture indefinitely. The facet matrix below
classifies which are required to complete `voyant#3080`, which are later
hardening, and what each depends on. They must not block use of the foundational
graph, but generated operator synthesis must not be declared the final state
while package-owned facets remain absent.

## Core Decisions

### 1. Keep the resolved graph explicit without exposing it as application config

The resolved deployment graph is explicit and deterministic. The authored
application configuration records only differences from the standard Operator,
as decided by [ADR-0012](../adr/0012-application-authoring-and-product-defaults.md).
Standard product closure belongs to a framework-owned distribution rather than
being copied into every project.

```sh
voyant new --preset pms-standard
```

The scaffold writes a minimal project declaration. The resolver expands the
standard distribution, explicit custom modules and external plugins, and
conventional local contributions into the complete graph.

The resolved graph must not admit packages or choose runtime behavior based on
profile names. Existing managed snapshots still carry `profile: "operator"` in
[managed-profile-contract.md](./managed-profile-contract.md); the graph resolver
should treat that as a compatibility bridge and translate it into selected
modules, capabilities, product surfaces, and substrate requirements.

Package compatibility should target framework version, the Node runtime
contract, deployment mode, and required capabilities/surfaces. It should not
target `profiles: ["operator"]`, expose `presetLineage` as authored runtime
behavior, or treat a hosting provider as a runtime.

### 2. Default to Voyant Cloud, but keep Node substrate lowering separate

The authoring model should be Node-substrate-neutral. `voyant deploy` can
default to Voyant Cloud when no target is specified, but the same Node graph
should lower to self-hosted Docker, Fly.io, Railway, GCP, AWS, or another Node
host. Target adapters never select a different application runtime.

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

### 6. Packages own manifests; starters only lower resolved graphs

The end-state source of truth for a module or plugin is an import-cheap manifest
exported by the package that owns the behavior. This rule applies equally to
first-party, third-party, workspace, and deployment-local units.

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./voyant": "./dist/voyant.js",
    "./admin": "./dist/admin/index.js",
    "./tools": "./dist/tools.js"
  },
  "voyant": {
    "schemaVersion": "voyant.package.v1",
    "manifest": "./voyant"
  }
}
```

`./voyant` exports one or more `defineModule` / `definePlugin` declarations and
static package metadata. It owns the package's capabilities, ports, schema and
migrations, API bundles, admin contributions, workflows, schedules, events,
subscribers, runtime contract, access resources, tools, and action metadata as
those facets become supported. Executable bodies remain behind lazy imports.

A plain package specifier selects the package's sole or explicitly declared
default graph unit. Packages with multiple units require a package-scoped
fragment such as `@acme/voyant-suite#loyalty`; resolution must never select
multiple units by accident.

The resolver may generate JSON artifacts and bundler entry modules from selected
package manifests. Generation is an output of resolution, not a second catalog.
`starters/operator` may temporarily adapt legacy declarations and may host target
bootstrap code, but it must not remain the authoritative list of package routes,
migrations, admin pages, workflows, subscribers, permissions, copy, tools, or
providers.

Specifically:

- no new package facet may require adding a parallel entry to an operator
  manifest or composition file
- first-party packages use the same public manifest interface as external
  packages; provenance may affect admission, never shape
- a compatibility generator may derive missing package facets during migration,
  but doctor must identify the owning package and the bridge used
- the bridge is removable only when direct package resolution produces the same
  graph; parity, not continued central generation, is its exit criterion
- Node host bootstraps consume a resolved graph and provider bindings; they do
  not decide product composition

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

## Project And Deployment Declaration

The source-backed operator has one authored declaration: `voyant.config.ts`.
`defineProject` owns package/local selections and the deployment's mode,
provider, and target bindings. Target adapters may override substrate policy at
deploy time, but no second checked-in file may repeat the product graph.

```ts
// voyant.config.ts
import { defineProject } from "@voyant-travel/framework/project"

export default defineProject({
  schemaVersion: "voyant.project.v1",
  modules: [{
    resolve: "./src/modules/loyalty",
    config: { tiers: ["silver", "gold", "platinum"] },
  }],
  plugins: ["@acme/voyant-smartbill"],
  deployment: {
    target: "node",
    mode: "self-hosted",
    providers: {
      database: "postgres",
      cache: "redis",
    },
  },
})
```

Package specifiers and `{ resolve, config }` selections remain the normal
authoring forms for reusable custom modules and external plugins. The resolver
reads package metadata and performs admission before it imports `./voyant`.
The framework-owned standard Operator distribution and conventional local
contributions are expanded during resolution and are explicit in generated
artifacts, not repeated in authored config.

### Clean project ergonomics

The project must feel like an application built on Voyant, not a fork of the
operator starter. The useful lesson from conventional application frameworks is
that common extension locations and one CLI remove assembly work from the app,
while explicit activation keeps the deployment auditable.

A normal source-backed project should need no framework-internal composition
files:

```txt
acme-voyant/
  package.json
  voyant.config.ts
  src/
    modules/loyalty/
      index.ts                 # discovered runtime factory
      schema.ts
      migrations/
      api/
      admin/
      workflows/
      subscribers/
    plugins/
    links/
    scripts/
  .voyant/                     # generated, disposable, gitignored
```

Package conventions apply inside package-owned units. Application conventions
also discover local routes, workflows, jobs, subscribers, links, admin
contributions, and module manifests from the directories defined by ADR-0012.
Adding such a file is authored intent and changes the graph at build time; it
never triggers runtime scanning. Direct `src/modules/<name>/index.ts` entries
are admitted as project-owned modules and lowered to static generated imports.

The ordinary workflow is:

```sh
voyant new --preset operator-standard
voyant generate module loyalty --schema --admin --workflow
voyant add ./src/modules/loyalty
voyant add @acme/voyant-smartbill
voyant dev
voyant doctor
voyant db generate loyalty
voyant migrate
voyant exec ./src/scripts/seed.ts
voyant build
voyant deploy
```

These commands all resolve the same project graph. `add` / `install`, `upgrade`,
and `uninstall` edit dependencies and explicit selections, then report config,
secret, migration, access, and resource consequences. They do not ask the user
to edit `createVoyantApp`, route registries, admin registries, migration
collectors, scheduler lists, or provider containers.

`voyant deploy` needs no deployment file for the default Voyant Cloud path. A
deployment file exists only when target bindings, resource sources, schedule
overrides, copy overrides, webhook subscriptions, or other deployment policy is
actually configured. It must not repeat product modules or package facets.

Generated JSON, route entry modules, admin entry modules, migration plans, and
target manifests live under `.voyant/` (or an equivalent build directory). They
are reproducible outputs and are never application-authored source-of-truth
files. A contributor adding a package-owned facet should be able to test it from
the package and select it from a project without changing `starters/operator`.

## Foundational V1 Substrate

The first implementation intentionally includes only facets that map to current
runtime concepts. This is the current foundational substrate, not the completion
boundary for `voyant#3080`.

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

Not yet complete in the foundational substrate:

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

These items ship as dependency-ordered slices. The issue-level end state is not
reached until every facet marked `#3080` in the matrix below is package-owned and
starter-independent.

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

Package API factories that need deployment behavior use
`defineGraphRuntimeFactory(...)` and request typed ports through `getPort(...)`.
The host binds implementations by port id, never by package id. The framework
rejects requests for ports absent from the owning unit's `runtimePorts` and
reports a missing deployment binding with the owning graph id. Runtime-factory
ports are deliberately separate from `requires.ports`: the latter describes
provider selection and must be satisfied by graph provider declarations. Before
exposing a bound implementation, composition runs the port's public conformance
kit. Factories use `hasPort(...)` before requesting an optional runtime port;
required and optional declarations remain distinct in lowered graph metadata.
Legacy
package-keyed runtime bindings remain a migration bridge only for units whose
public factories have not adopted this contract.

This matters for replacement promises. If a future external CRM can replace
`relationships`, it must pass the people-directory port tests. Otherwise doctor
would give false confidence.

## Static Metadata And Runtime Introspection

Use a two-pass introspection model.

### Pass 1: pre-admission metadata

Before any package code is imported, tooling can inspect:

- `package.json`
- `voyant.package.v1` metadata
- package manager lockfile version/integrity
- project/deployment declarations
- configured package admission policy

This pass can reject incompatible or unadmitted packages before arbitrary code
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

### Pass 2: admitted build-time introspection

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
- module/plugin-owned `config` and `secrets` declarations, which identify
  logical keys and lazily reference admitted validator exports

The manifest stores serializable metadata and symbolic validator references;
the admitted build/doctor pass may load constrained Zod validators:

```ts
config: [{
  id: "@acme/voyant-fiscal#config.company-vat-id",
  key: "companyVatId",
  validator: { entry: "@acme/voyant-fiscal/config", export: "companyVatIdSchema" },
}],
secrets: [{
  id: "@acme/voyant-fiscal#secret.api-token",
  key: "apiToken",
  validator: { entry: "@acme/voyant-fiscal/config", export: "apiTokenSchema" },
  rotation: "supported",
}],
```

If a custom DSL is introduced later, it must remain tiny and frozen. It should
not become a second general validation language.

Secret values must not cross workflow boundaries as captured handles. Workflow
steps should rehydrate secrets by logical binding name inside each step context.

The v1 graph contract now supports these logical declarations, resources,
providers, access, admin, tools, webhooks, actions, setup migrations, and
retain-data lifecycle metadata. Package migration and target lowering remain
separate work; a detailed custom schema DSL remains explicitly deferred.

Generated Node runtime artifacts retain each selected unit's deterministic
project config and its config, secret, resource, and provider declarations.
`resolveVoyantGraphRuntimeValues(...)` resolves config in this order:

1. the selected unit's project config
2. Node deployment values (including aliases declared by deployment resource
   requirements)
3. the declaration default

Secrets resolve only from Node deployment values. Required values and admitted
validator exports are checked before managed Node composition starts. Errors
identify the unit, declaration, logical key, and failure code, but do not retain
or format secret values or validator exceptions. Resolved secrets are available
through `getSecret(declarationId)` and are not included in enumerable runtime
metadata.

Provider declarations expose admitted, memoized lazy loaders alongside their
port and static config metadata. The generic framework does not invoke provider
factories or choose among multiple declarations for the same port: that requires
a separate provider-selection and port-binding contract. Resource declarations
remain available as package metadata; existing deployment resource environment
validation remains the authority for provider infrastructure requirements.

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

Admin composition is beyond the foundational v1 substrate but required for the
package-owned end state:

- packages contribute admin nav/routes/pages through package-owned admin facets
- generated route files or equivalent generated entry modules bind lazy page
  imports into the host router
- packages expose stable slots and contribute widgets to slots owned by other
  selected packages
- packages own namespaced copy; deployments may override known keys without
  forking package code
- custom admin pages use the same package/local-module contract, not a
  deployment-only extension path

The first admin slice is nav/routes because slots and copy depend on stable page
ids and package UI exports. Generated operator route modules are an acceptable
bridge, but the generator must read selected package manifests and may not keep a
separate first-party admin catalog.

### Selected-graph admin bundle cutline

The first Phase 4 admin slice is active for `@voyant-travel/action-ledger`:

- the package manifest opts its import-cheap admin extension factory into
  `admin.runtime` and retains the stable Logs route declaration
- project resolution emits `.voyant/admin/selected-graph-admin.generated.ts`
  from only selected units with `admin.runtime`; package page modules remain
  behind the lazy imports owned by the UI export
- the Operator consumes that generated factory while retaining its existing
  localized label and icon inputs, and the compatibility admin generator removes
  the migrated factory from `admin.extensions.generated.ts`
- deployment-local `src/admin/*/index.ts[x]` pages remain independently
  discovered and composed; package migration must not remove that local surface
- `verify:admin-composition-drift` rejects a migrated factory that is missing
  from the selected-graph bundle, duplicated in the compatibility registry, or
  present without a selected `admin.runtime` declaration

This cut does not activate admin slots or contributions, namespaced copy,
message-provider lowering, or deployment copy overrides. Those remain separate
admin authorities. The Operator factory wrappers and generated registry entries
for all other first-party packages also remain compatibility authorities until
each package proves equivalent nav, route, page, host-option, and destination
behavior through the selected graph.

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
later dependency-ordered phase. It is high leverage and should be designed once,
not piecemeal per facet.

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

Implementation note: workflows are facets of their package graph units rather
than an aggregate operator module. Bookings owns hold expiry, notifications owns
reminder delivery and due-reminder scheduling, and inventory owns product PDF
generation. Their schedules are provisioned from the owning package ids while
the generated runtime imports the owning package exports. The operator keeps
only graph-id-keyed bindings for deployment capabilities and local units.

Workflow runtime references lower into a facet-specific loader collection.
They never participate in a graph unit's primary `runtime` loader or legacy API
runtime fallback, so adding `workflows[].runtime` cannot change the exports
passed to module or extension bindings. A package manifest that activates an
executable workflow must declare `workflows[].runtime.entry` and
`workflows[].runtime.export`; that pair must resolve through a published package
export to the `WorkflowDescriptor` whose id matches `workflows[].id`. The
top-level unit `runtime` remains reserved for the package's Hono module or
extension factory. Generated importers may deduplicate a shared entry, but each
facet selects and memoizes its own named export.

`resolveProject()` also emits `runtime/project-package-workflows.generated.ts`.
This workflow-only artifact contains selected workflow and event-filter imports,
but no API, admin, module, provider, or tool runtime imports. Node workflow
bundles consume this narrow artifact so build-time bundling cannot pull the
application server graph into the workflow executor.

Implementation note: application convention compilation validates
`src/workflows` and `src/jobs` without evaluating source. Workflow files
directly default-export the pure `defineWorkflow(...)` result; job files export
`schedule` plus a default handler. The compiler emits deterministic static
registries under `.voyant/runtime` and rejects import escapes, stable-ID
collisions, missing contract exports, registering/indirect workflow defaults,
unsupported runtime exports, and schedules that cannot be represented as
durable graph data. `resolveProject()` emits those registries, contributes
individual workflow runtime references, and derives provisioning jobs from the
same static schedules. Jobs are wrapped as pure workflow definitions so they do
not require a second starter-owned dispatch registry. Node runner consumption
of these explicit definitions replaces the remaining side-effect workflow
registry in the following host-integration slice.

## Action-Ledger Runtime Lowering

Generated `VoyantGraphRuntime` units carry deterministic action declarations and
the selected route, tool, workflow, event, and webhook ids those actions may
bind. `lowerVoyantGraphActionsToActionLedgerRegistry(...)` revalidates every
required scope and binding against that selected runtime before producing the
shared action-ledger capability registry. Required scopes lower to required
grants; action risk, ledger, approval, and reversibility policy remain
package-owned metadata.

Risk evaluation may depend on request or package runtime state and therefore
cannot be serialized in the graph. The lowering API exposes only a keyed
`riskEvaluators` override (`<capability-id>@<version>`); it does not allow a
runtime to replace graph-owned identity, grants, policy, or bindings.

The managed and operator runtimes instantiate this generic selected-graph
registry. Bookings now owns one import-cheap action declaration source from
which both its graph manifest and canonical request-path capability registry are
derived. Its parity test preserves persisted capability ids, explicit
resource/action metadata, grants, actor restrictions, risk, approval, ledger,
and reversibility behavior. Graph action ids remain the established action
names; the explicit `capabilityId` carries the separately persisted
action-ledger identity. The route/request path continues to use the package's
canonical registry.

The relationships person-document capability remains a parallel catalog and a
compatibility authority until the same package-owned declaration and parity
test exist. Equivalent-looking graph metadata alone is not sufficient reason to
remove it.

## Events And Webhooks

V1 should include subscribers and workflow event filters that already map to
existing descriptors.

Application-local `src/subscribers` and `src/links` contributions are compiled
with the TypeScript AST. Subscriber files default-export durable
`EventFilterDescriptor` data, while link files default-export `defineLink`
definitions. The compiler emits deterministic static TypeScript imports under
`.voyant/runtime`; it does not import application source or defer discovery to
application startup. `resolveProject()` promotes complete subscriber manifests
to graph subscriber facets with named runtime references and promotes links to
path-owned graph facets while retaining the generated link collection for
migration/query consumers.

Ordinary package subscribers with executable runtime references lower separately
from workflow event filters. Their runtime export carries the stable graph
subscriber id, event type, and a bootstrap registration hook. The Node Hono
adapter validates the runtime id against the selected graph entity and registers
it only when its owning unit is selected. Workflow hosts continue to load only
subscriber runtimes that carry an `EventFilterDescriptor` manifest.

The first direct package cutover is
`@voyant-travel/distribution#channel-push-extension`: its `booking.confirmed`,
`availability.slot.changed`, and `product.content.changed` subscribers are
declared and executed from `@voyant-travel/distribution`. Operator supplies the
selected unit's database/adapter service through its explicit container binding;
it no longer lists or implements those three subscriber handlers.

The remaining Operator subscriber authorities are intentionally explicit:

- `bookingScheduleBundle`: `booking.confirmed`
- `catalogBridgeBundle`: `product.created`, `product.updated`,
  `product.deleted`, `product.content.changed`, `availability.slot.changed`,
  `pricing.rule.changed`, `product.publication.changed`, `promotion.changed`,
  and two distinct `booking.confirmed` handlers
- `createCatalogCheckoutBundle`: `contract.document.generated` and
  `payment.completed`
- `tripsPaymentBundle`: `payment.completed`
- `smartbillOperatorBundle`: `invoice.issued`, `invoice.proforma.issued`, and
  `invoice.payment.recorded`

These entries remain until each owning package manifest has executable runtime
references and direct selected-graph parity. Deployment-local ordering,
configuration, or orchestration is not sufficient reason to relabel a standard
package subscriber as migrated.

Finance now owns the inert `booking.confirmed` declaration for booking-schedule
generation and exports a subscriber descriptor factory from
`@voyant-travel/finance/booking-schedule-subscriber`. The factory preserves the
existing generation-then-covered-settlement behavior through deployment-injected
booking-schedule options and database lifecycle resolution. Its manifest entry
intentionally omits a runtime reference while the central Operator bundle
remains active; direct selected-graph activation must remove that central
registration in the same change to avoid duplicate event handling.

The broader event catalog is beyond the foundational substrate:

- declared `events.emits` catalogs
- payload schemas for every emitted event
- visibility policy for event fields
- outbound webhook subscription and delivery policy
- event-to-OpenAPI or event-to-SDK generation

Inbound webhook routes remain API route declarations. Outbound webhook delivery
ships after the package-owned event catalog, not inside the foundational slice.

## Testing Story

Custom module/plugin authors need a first-class test harness. The foundational
v1 graph establishes its diagnostics and skeleton; each later facet must add its
own assertions before that facet is public.

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

The complete harness is part of the `voyant#3080` credibility story. A framework
that sells extensibility must give authors a way to prove their extensions are
valid without booting the reference operator.

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
  "location": "voyant.config.ts:12",
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

There are three distinct states; documentation and diagnostics must not blur
them:

1. **Derived bridge:** tooling infers a graph unit or facet from a central
   first-party registry, starter list, generated schema bundle, or runtime
   declaration. This is foundational migration substrate.
2. **Package-owned manifest:** the owning package exports the facet through its
   public `./voyant` manifest. Resolution no longer needs a package-specific
   operator entry.
3. **Bridge removed:** parity tests prove direct package resolution produces the
   expected graph, and the central inference path is deleted.

Moving central synthesis into a generator completes state 1, not state 2. A
facet cannot be reported as migrated while the operator starter remains the only
place that knows the package contributes it.

Step zero should be a generator that derives v1 manifests from existing
runtime shapes:

- `HonoModule` / `HonoExtension` route bundles
- package `migrations/` metadata
- existing workflow descriptors
- existing event subscribers
- `FRAMEWORK_RUNTIME_MANIFEST`
- `FRAMEWORK_EXTENSION_OWNERSHIP`
- `FRAMEWORK_CAPABILITY_GRAPH`

The standard Operator distribution is now the sole first-party selection-policy
catalog. It records stable order, required modules, and extension removal
cascades; it does not redeclare package facets. Resolution admits each selected
package and loads the selected graph unit from that package's public `./voyant`
manifest. `FRAMEWORK_RUNTIME_MANIFEST`, `FRAMEWORK_EXTENSION_OWNERSHIP`,
`FRAMEWORK_CAPABILITY_GRAPH`, and `VOYANT_PROFILE_MODULES` remain compatibility
projections only. A repository checker rejects first-party product literals in
those compatibility views and rejects a standard selection without a matching
package-owned manifest unit.

This validates the manifest against reality before third-party authors depend
on it, and avoids hand-retrofitting every package up front.

Some first-party schema owners are not active runtime modules in a given
deployment. Examples include foundational schema packages, additional schema
packages, and route-deferred verticals whose migrations still apply. The
resolved graph must still represent those packages as schema-only units with
stable `schema` and `migrations` entity ids, and its package records must cover
every package-backed migration source selected into the graph.

The deployment artifact manifest records package-backed migration sources
directly from selected package manifests. Runtime migration execution derives
the dependency-ordered plan from those same selected graph units, resolves each
package's migration folder through the D.2 collector, and applies explicit
deployment-local migrations last. Deselecting a package therefore removes its
schema migration from both the artifact and executable plan. The committed
`drizzle.schemas.generated.ts` remains a Drizzle generation and replay-parity
input; it is not migration selection authority. Graph artifact validation
rejects sources that are not represented in graph package records.

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

The reference operator owns one checked-in `voyant.config.ts`. It is a reference
consumer and compatibility host, not the canonical package catalog. Its
managed-profile compatibility snapshot and all deployment graph/runtime
artifacts are regenerated beneath the gitignored `.voyant/` directory. They do
not select graph units, providers, or the deployment target. The architecture
checker forbids `voyant.project.ts`, `voyant.deployment.ts`,
`deployment-graph.local.ts`, and root/`src` graph artifacts from returning.
Deployment requirements derive from the graph's declared provider bindings
using the existing v1 provider contract, and generated Node runtime entries pass
both the resolved requirements and deployment mode/provider bindings into boot
validation. The foundational substrate also models compatible
environment aliases and value formats on canonical resource requirements:
for example, either `DATABASE_URL` or the Node-pool `DATABASE_URL_DIRECT`
satisfies the graph's Postgres requirement, and the resolved value must be a
valid Postgres URL. Phase 2 continues the remaining runtime compatibility and
provisioning migration.

Provider runtime selection is an explicit equality match between a provider
declaration's `selection: { role, value }` and
`deployment.providers[role]`. Runtime code must not derive that match from
environment presence or provider ids. Before importing a provider body, the
Node resolver proves that every non-optional required port has exactly one
selected declaration. It then memoizes factory invocation and supplies only
the owning unit's resolved config, secrets, resources, and static provider
config. Composition receives typed provider values through `getProvider<T>()`
and enumerable selection metadata contains no config, secret, resource, or
provider instance values. The first migrated family is
`database.client`/`database: postgres`; replacing the operator's remaining
legacy database composition with this resolved value is a follow-up.

The operator graph also runs an explicit source-admission policy for generated
artifacts: selected packages must resolve to admitted lockfile/workspace
provenance, deployment-local operator units get one explicit project source
record, and virtual graph units point package provenance at the real package
that ships them. Generated managed runtime entries validate graph artifacts and
graph diagnostics before importing the managed runtime package.

The framework resolver admits each app-local `src/modules/<name>/index.ts`
through the root package without requiring nested package metadata or exports.
The graph keeps the project-relative runtime entry while generated code receives
a resolver-private relative import. The operator resolver adapter requires
`resolveProject({ project, projectRoot, configPath })` and then adds target
admission, lockfile provenance, and runtime-maintenance schedules.

The same resolver compiles `src/api/{admin,store}/**/route.ts` into individual
graph API facets backed by one generated static Hono adapter, and compiles
`src/admin/<name>/index.tsx` entries into a deterministic client module. Both
artifacts use paths relative to `.voyant/`; no runtime filesystem scan or
starter-owned project convention registry participates in resolution.

Schema-owning first-party package manifests publish `voyant.package.v1`
compatibility metadata alongside the existing migration-facing `schema` and
`requiresSchemas` declarations. Graph checks require every package-backed
operator migration source to expose that normalized module metadata before the
package can remain in generated operator graph artifacts.

Substrate package records use the same metadata contract without becoming graph
units: `@voyant-travel/framework` publishes `kind: "framework"`, while
supporting packages such as `@voyant-travel/framework-migrations` and
`@voyant-travel/hono` publish `kind: "library"`. Released first-party registry
plugins that predate package-owned v1 metadata may be admitted through an
explicit operator metadata bridge, but generated operator graph checks still
require the final package record to carry normalized `voyant.package.v1`
compatibility metadata before runtime imports are emitted.

## Relationship To Existing ADRs

This plan extends existing decisions; it does not silently rewrite them.

- ADR-0007 remains the compatibility rule for the current standard graph:
  default-on subsetting, required foundational modules including
  `relationships`, extension-ownership cascade, and the monolithic inert schema
  bundle remain valid until a separately reviewed package-owned migration
  replaces them. The unified graph normalizes that result today. It does not
  claim an alternate CRM is valid until consumers use a typed port, the provider
  passes its conformance kit, and the replacement decision is explicitly made.
- ADR-0008 remains the route-authoring direction: anonymous and transactional
  intent is package-owned metadata, standard lists trend to empty, and discovery
  happens at build time. Convention discovery may locate package exports, but
  the project still explicitly selects graph units. Explicit provider injection
  remains; the resolver lowers package-owned factories into it rather than
  introducing opaque named-DI auto-wiring.
- ADR-0011 remains the tool/MCP runtime: packages author transport-neutral tools,
  the selected graph aggregates one registry, scopes are enforced at the tool
  layer, and the stateless MCP route remains in the operator deployment. The
  graph does not introduce a separate MCP worker or agent runtime.

Any phase that changes one of those decisions must update or supersede the ADR
in the same change.

## Facet And Migration Matrix

`Package` below includes a deployment-local module/plugin, which follows the
same manifest interface. `Project/deployment` means policy that legitimately
spans packages; it does not authorize starter-owned catalogs. `#3080` rows are
part of the issue's package-owned end state. `Hardening` rows may remain later.

| Facet | Current substrate or bridge | End-state owner and declaration | Depends on | Migration exit test | Scope |
| --- | --- | --- | --- | --- | --- |
| Identity, selection, package metadata, admission | Deterministic v1 graph, package records, generated operator units, managed-profile compatibility | Package exports `voyant.package.v1` plus import-cheap `./voyant`; project explicitly selects normalized module/plugin package or path references | Phase 0 | Direct package resolution matches the bridge graph; no operator package catalog is consulted | #3080 |
| Capabilities | `FRAMEWORK_CAPABILITY_GRAPH` and generated `provides`/`requires` | Package manifest owns coarse capability tokens; project graph closes them | Identity | Removing the central capability entry does not change resolution or diagnostics | #3080 |
| Typed ports, providers, adapters | First public-port slice plus broad `FrameworkProviders` container and starter factories | Port-owning package exports contract and conformance kit; module declares requirements; plugin-distributed providers declare provisions; deployment selects routing/defaults only where needed | Capabilities, runtime contract, test harness | Selected providers satisfy facets and kits; no package-specific starter provider entry is required | #3080, demand-driven replacement |
| Schema and migrations | D.2 collector, generated schema manifest, operator migration-source artifact, ADR-0007 monolithic bundle | Schema-owning package declares schema and ships namespaced migrations; project owns only cross-package link/deployment-local migrations | Identity, admission | `dev`, `doctor`, `migrate`, Cloud, and Docker derive the same dependency-ordered plan directly from selected packages | #3080 |
| Setup/data migrations | Ad hoc seed/setup behavior and ordinary migrations | Package owns versioned, idempotent setup/data migrations with applied-work ids; project owns optional explicit seed scripts | Schema/migrations, lifecycle ledger | Install/upgrade replay is idempotent and no lifecycle hook is needed | #3080 |
| Linkables and links | Existing `defineLink`, generated schema inputs, deployment-local link migrations | Package exposes linkables; package/project explicitly declares neutral pair links; rich associations remain module-owned records | Identity, schema/migrations | Both link ends and generated DDL resolve without starter link lists | #3080 |
| Runtime config | Managed profile settings and deployment config bridges | Package declares typed config contract; project supplies portable non-secret values | Package manifests | Defaults/values validate before build and package code no longer reads profile settings directly | #3080 |
| Secrets and resource/service bindings | Managed requirements, env aliases, provider bindings, boot validation | Package declares logical secret/binding needs; deployment binds provider-specific sources; runtime receives typed redacted handles | Runtime config, Node host adapter contract | Cloud/self-host plans and runtime boot agree; package public API contains no provider env names | #3080 |
| API routes and route posture | Existing Hono modules/extensions, generated entries, starter `publicPaths` and transactional fallbacks | Package `api.admin`, `api.public`, `api.webhooks`, and `api.internal` own lazy factories, stable ids, anonymous posture, transaction need, mounts, and operation metadata | Package manifests, runtime bindings | Standard `publicPaths`, transactional paths, and route-family lists are derived and starter fallbacks are empty | #3080 |
| OpenAPI | Route-owned schemas plus shipped graph coverage report and allowlists | Package API bundle opts into documents and owns operation metadata; selected graph emits deployment-specific documents | API routes | Coverage has no unexplained allowlist and no operator OpenAPI catalog | #3080 |
| Access resources and grants | Pass-through route scopes and existing Better Auth `Record<string, string[]>` permissions | Package owns `access.resources`; routes, tools, admin, workflows, and actions reference one `resource:action` catalog; project owns role presets | Identity, API operation ids | All references validate against one selected catalog; no central first-party permission catalog remains | #3080 |
| Admin nav, routes, and pages | Shipped generated operator extension factories and code-assembled route module | Package `admin.nav` / `admin.routes` plus exported lazy UI; selected graph generates one admin bundle | Package UI exports, identity, access | Adding/removing a package changes admin output without editing operator admin registries | #3080 |
| Admin slots and contributions | Deployment-owned extensions and package-specific host knowledge | Page-owning package declares stable slots and prop contracts; selected packages declare ordered contributions | Admin routes, access | Doctor resolves every required slot/prop contract and no operator widget registry remains | #3080 |
| Admin copy/i18n | Package message providers plus manual operator route-message composition | Package owns namespaced `admin.copy`; admin references message keys; deployment may override known keys | Admin routes/slots | Selected namespaces compose lazily without operator copy lists; locale/key parity passes | #3080 |
| Workflows and schedules | Existing descriptors, graph workflow/event-filter slice, stable schedule lowering, operator local workflow bridge | Package owns workflow descriptors and schedules; project owns cross-package workflows/overrides; target provisions stable schedule ids | Identity, runtime bindings | No product schedule or workflow bundle requires operator registration; cron-string dispatch is compatibility-only | #3080 |
| Emitted events, subscribers, event filters | Existing subscribers, event descriptors, outbox, and first graph event-filter slice | Package owns emitted-event catalog, payload/visibility metadata, subscribers, workflows, and event filters | Identity, workflows, runtime bindings | Unknown event/target checks pass and subscriber/event lists are absent from starter composition | #3080 |
| Inbound and outbound webhooks | Inbound Hono routes; outbound behavior configured outside a complete event catalog | Package owns inbound route verification metadata and declares externally deliverable events; deployment owns endpoint subscriptions and secrets | API routes, event catalog, access/visibility | Target plans validate delivery eligibility and no webhook is hidden in starter route/scheduler lists | #3080 |
| Tools and MCP | `@voyant-travel/tools`, package `./tools` exports aggregated manually, in-deployment MCP from ADR-0011 | Package manifest references transport-neutral tool definitions/context; selected graph builds one registry and manifest; MCP remains a transport adapter | Access catalog, runtime bindings, stable ids | Tool registry follows package selection with no operator tool list; scopes/risk/context validate | #3080 |
| Action-ledger metadata | Existing ledger capabilities and explicit write helpers outside the deployment graph | Package owns action definitions bound by stable route/tool/workflow/event ids and admin copy; runtime writes remain explicit | Access, API, tools, workflows, events, admin copy | Every declared binding resolves and package actions appear without central capability registration | #3080 |
| Install, upgrade, uninstall | Manual dependency/project edits; migrations and admission exist independently | CLI edits dependency plus selected graph; facets drive plan; uninstall detaches all surfaces and retains durable data/history by default | All detachable facets, setup ledger, diagnostics | Lifecycle diff names every affected facet and leaves no active references to removed units | #3080 |
| Destructive purge and broad lifecycle hooks | Not supported | No broad hooks; any future purge is separately declared, backup/approval gated, and package-specific | Complete lifecycle | Explicit future ADR and end-to-end safety proof | Hardening |
| Target lowering and CLI | Generated Node entries, managed Cloud bridge, partial requirements lowering | `dev`, `doctor`, `build`, `migrate`, `deploy`, logs, smoke tests, and emitted manifests consume one graph; adapters vary substrate only | Runtime bindings, API/workflow manifests, migration plan | Voyant Cloud and at least Docker/custom manifest deploy identical product graphs; starter bootstrap has no product decisions | #3080 |
| Diagnostics and author test harness | Stable diagnostics/code registry, graph scripts, architecture checks, partial conformance kits | Public `voyant doctor[ --json]` plus package test deployment harness cover every supported facet | Each facet as introduced | Human/JSON reports agree and package authors can validate without running the operator starter | #3080 |
| Supply-chain security beyond admission | Lockfile provenance and source admission | Optional SBOM/signature/revocation/policy layers without changing package manifest ownership | Stable package records | Separate threat model and ADR | Hardening |

## Dependency-Ordered Implementation Phases

Each phase is independently useful, but a later phase may not move ownership
back into `starters/operator`. Within a phase, land package contract, resolver,
diagnostics, lowering, author test support, and first-party migration together.

### Phase 0: foundational graph substrate

This is the current v1 foundation:

- versioned project/deployment/unit/package schemas, stable ids, closed facets,
  deterministic graph hashing, package provenance/admission, and stable
  diagnostics
- generated first-party/operator bridges for routes, migrations, workflows,
  schedules, events, requirements, admin routes, and runtime entries
- one Node runtime path, managed-profile compatibility, stable schedule-id
  dispatch, OpenAPI coverage reporting, and the first typed-port/conformance
  slice

Exit: the foundation is usable and every bridged entity identifies its intended
owning package. Reaching this exit does not close `voyant#3080`.

### Phase 1: package authority and project ergonomics

- finalize `./voyant` package export and the optional-facet
  `defineModule` / `definePlugin` contract
- normalize string/path specifiers and configured selections to the same unit records
- make presets write explicit selections and make `.voyant/` the only generated
  project output
- implement the clean `new`, `generate`, `add/install`, `dev`, `doctor`, and
  `exec` application workflow
- add bridge-origin diagnostics and direct-vs-derived parity tests
- migrate identity, package metadata, and coarse capabilities into first-party
  package manifests

Exit: a new local or packaged module can be selected, inspected, and diagnosed
without editing the operator starter; central synthesis remains only for facets
not yet migrated in the matrix.

### Phase 2: data ownership and runtime contracts

- migrate package-owned schema, migrations, setup/data migrations, linkables,
  and links into direct resolution
- add package config, secret, and resource/service binding contracts; keep env
  aliases only in target adapters and compatibility shims
- migrate real replacement seams from `FrameworkProviders` to typed ports only
  with conformance kits; keep explicit injection and ADR-0007's current required
  module behavior until each replacement is separately justified
- make migration and binding plans identical for local, Docker, and Cloud

Exit: selected package manifests are sufficient to plan data changes and runtime
requirements before importing runtime bodies. The operator schema/provider lists
are no longer authoritative.

### Phase 3: package-owned runtime composition and first non-Cloud target

API bundle posture is inspectable before package runtime imports. `anonymous:
true` opens the resolved public mount, while an `anonymous` path array records
route-relative anonymous exceptions. `transactional: true` selects the resolved
bundle mount and a `transactional` path array selects route-relative path
prefixes. Resolution validates and normalizes either leading-slash or plain
relative authoring, and graph runtime composition resolves each path against its
selected bundle mount exactly once. It exposes the absolute selected union as
`routePosture.publicPaths` and `routePosture.transactionalPaths`. Composition
also applies representable public-mount and transactional metadata to the Hono
module or extension output. Deployment-local escape hatches remain separate and
must not be folded back into package manifests.

The Operator mounts both graph unions directly as `publicPaths` and
`dbTransactionalPaths`. Its standard package bindings must not restate
`anonymous`, `requiresTransactionalDb`, or transactional path/module metadata.
The external Netopia plugin and root-mounted payment-link family are graph-owned.
The deployment-local invitations unit continues to own its anonymous posture
locally. `check-operator-route-posture` prevents graph-derived posture from
being replaced by starter hand-lists.

- migrate API bundles, anonymous/transactional posture, subscribers, workflow
  descriptors, schedules, and event filters to package manifests
- lower package factories into the existing Hono composition and explicit
  provider container; do not add named-DI auto-wiring
- make `dev`, `doctor`, `build`, `migrate`, and `deploy` consume one resolver and
  graph hash
- complete Docker or `custom --emit-manifest`, including migrate, smoke-test,
  logs, and scheduler plans; preserve Voyant Cloud as the default adapter
- empty standard operator route, plugin, subscriber, public-path,
  transactional-path, workflow, schedule, and migration-source hand-lists as
  their package facets migrate

Exit: two targets lower the same product graph, and the starter contains target
bootstrap only. This completes the core deployment loop, but not the remaining
package surfaces in `voyant#3080`.

### Phase 4: access, API description, and admin composition

- land one package-owned access-resource catalog and migrate route scopes, API
  token grants, staff RBAC, UI visibility, workflow triggers, and role presets
- finish selected-graph OpenAPI emission from route-owned schemas and operation
  metadata
- migrate admin nav/routes/pages, then stable slots/contributions, then
  namespaced copy and deployment overrides
- generate the admin bundle only from selected package exports and graph data

Progress: the action-ledger nav/route/page factory is the first package lowered
into the selected-graph admin bundle. Slots/contributions, copy, and the
remaining first-party Operator compatibility registry are not part of this
slice.

Exit: a custom package contributes a secured, documented API and complete admin
surface without operator edits; all grants and message references validate.

### Phase 5: event delivery, tools, and audit metadata

- complete emitted-event catalogs, payload visibility, subscriber ownership,
  and outbound webhook subscription validation
- aggregate package-owned tools and contexts into the ADR-0011 registry and
  in-deployment MCP surface
- migrate action-ledger declarations after route, tool, workflow, event, access,
  and copy ids are stable; keep ledger writes explicit

Exit: package selection controls events, external delivery eligibility, agent
tools, and audited action metadata without parallel operator catalogs.

### Phase 6: lifecycle completion and bridge removal

- make install/upgrade/uninstall graph edits produce full facet, migration,
  config, secret, grant, admin, schedule, tool, webhook, and retained-data plans
- complete the public author test harness and stable `voyant doctor --json`
  coverage for every matrix row
- harden managed admission as needed without requiring the broader supply-chain
  platform
- delete each central generator input after direct package parity passes; keep
  only hosting-neutral generated outputs and Node host bootstraps
- run an issue-completion audit against every `#3080` matrix exit test

Exit: `starters/operator` can be replaced by another Node host bootstrap without
reconstructing product composition. No selected package surface is known only
to the starter, and every `#3080` matrix row is package/project-owned.

## Completion Criteria

### Foundational v1 readiness

The current substrate is ready when stable ids, fail-closed schemas,
deterministic artifacts, package provenance/admission, migration-source
accounting, graph closure, unified diagnostics, generated runtime entries, and
one deployable Node path work together. Generated first-party manifests are
valid evidence for this milestone.

### `voyant#3080` completion

The issue is complete only when:

- presets scaffold an explicit graph and named profiles have no runtime meaning
- first-party, external, and local units use the same package-owned manifest
  interface
- every `#3080` matrix row passes its migration exit test
- `dev`, `doctor`, `build`, `migrate`, and `deploy` consume the same graph and
  content hash
- Voyant Cloud and at least one self-host target lower the same selected product
  graph and differ only in substrate binding/provisioning
- install/upgrade/uninstall operate on the graph without opaque lifecycle hooks
- package authors can validate all supported facets with public diagnostics and
  test harnesses
- no operator-starter registry, generated input catalog, managed profile, or
  hand-maintained list is required to discover a package-owned product surface

Generated runtime/admin entry modules, migration plans, and target manifests are
expected end-state build artifacts. Generated first-party **source catalogs** and
operator-owned synthesis are not.
