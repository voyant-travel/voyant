# ADR-0009: Federated operating mode for external systems of record

- **Status:** Proposed (2026-06-24)
- **Relates to:** [#2210](https://github.com/voyant-travel/voyant/issues/2210),
  [ADR-0007](./0007-module-subsetting-and-capability-ports.md),
  [module/provider/plugin taxonomy](../architecture/module-provider-plugin-taxonomy.md),
  [catalog architecture](../architecture/catalog-architecture.md),
  [marketplace experiences sourcing](../architecture/marketplace-experiences-sourcing.md),
  [execution architecture](../architecture/execution-architecture.md),
  [action ledger, roles, and reversibility](../architecture/action-ledger-roles-and-reversibility.md)
- **Implemented by:** This PR is the design record. Implementation follows in
  narrow slices after the operating posture is accepted.

## Context

Voyant is modular enough to act as an operating layer around existing systems,
but that posture is not named. Today a deployment author has to choose among
modules, providers, adapters, extensions, plugins, source adapters, custom
modules, workflows, subscribers, and deployment-local glue without one shared
answer to the question:

> Can Voyant be the runtime, orchestrator, and agent control surface while
> HubSpot, Nezasa, marketplace sources, or custom customer systems remain the
> source of truth for selected capabilities?

The answer should be yes, but not by adding a broad global flag or pretending
every standard module is already replaceable.

The current architecture already contains most of the required pieces:

- `@voyant-travel/framework` composes a standard runtime set and supports
  removal of optional standard modules via `exclude`.
- ADR-0007 explicitly says capability replacement such as "HubSpot instead of
  CRM" is not wired yet and would need a named capability port.
- The catalog plane already models sourced inventory, local projections,
  overlays, live source-adapter calls, booking snapshots, and upstream handles.
- The execution architecture already separates workflows, schedules, and
  daemons.
- The action-ledger design already defines the control surface agents and
  workflows need before mutating important state.

What is missing is the posture that ties those pieces together.

## Decision

Voyant will define **federated operating mode** as a first-class deployment
posture.

In federated operating mode, Voyant remains the operating layer: API surface,
admin/storefront runtime, workflow orchestration, agent/tool control, search,
local projections, snapshots, audit, finance/support records, and cross-system
coordination. One or more external systems may remain authoritative for selected
capabilities.

Federation is declared per capability or integration, not as a global
`orchestratorMode: true` switch.

The name is deliberate. "Orchestrator mode" overloads the workflow/orchestration
vocabulary and can imply that workflows are the center of every integration.
"Federated" better captures the actual decision: authority may be distributed
across Voyant and external systems while Voyant provides the operating layer.

## Source-of-truth modes

Every federated capability should declare one of four source-of-truth modes:

- `native`: Voyant owns authoritative state and behavior.
- `mirrored`: an external system owns truth; Voyant stores a local projection
  for runtime, UI, search, automation, and cross-module workflows.
- `external-live`: Voyant stores minimal handles/provenance and calls upstream
  live for authoritative reads or writes.
- `hybrid`: authority is split by field or operation. For example, an upstream
  source owns availability and booking status while Voyant owns merchandising
  overlays, support notes, finance records, and audit state.

The detailed operating rules live in
[`federated-operating-mode.md`](../architecture/federated-operating-mode.md).

## Integration classification

Federated mode reuses the existing module/provider/adapter/extension/plugin
taxonomy. It does not introduce a generic integration layer or make plugins the
main runtime abstraction. The detailed classification rules live in
[`federated-operating-mode.md`](../architecture/federated-operating-mode.md).

## Shared source connections and provenance

Federated integrations should converge on a shared source-connection and
cross-module provenance vocabulary. This ADR decides that such a platform
surface is needed; it does not freeze the table shape, enum set, or exact field
names. Those belong in the follow-up source-connection schema slice and should
be validated against at least one concrete integration.

## Initial capability-port inventory

Capability ports should be added only where a real replacement need appears.
The first known candidate is `PeopleDirectory` for true external CRM
replacement. Until that port exists, HubSpot-style integrations should mirror
into `relationships` rather than displace it. Catalog/booking source adapters
remain the right seam for sourced sellable inventory.

## Execution model

Federated integrations must use the existing execution classes honestly:

- **Daemons** own polling loops, bulk ingestion, backfills, cursor advancement,
  webhook bridge ownership, and reconciliation.
- **Schedules** trigger daemon passes or start workflows. They do not own
  business logic.
- **Workflows** coordinate business processes with steps, waits, retries,
  resumability, and compensation. They do not become permanent sync loops.
- **Events** signal facts after durable state changes. They are not a hidden
  durable queue.

## Agent and tool control

Agents and automation should call Voyant commands or tools, not vendor SDKs
directly. External writes still need the Voyant control surface:

- capability checks
- explicit delegated authority
- stable idempotency keys
- action-ledger entries
- approval policy for high-risk actions
- reversal or compensation metadata
- correlation to workflow runs, source connections, and upstream references

AI does not get special trust in federated mode. It receives bounded authority
over the same capability surfaces as humans, API tokens, workflows, and other
integrations.

## Consequences

### Positive

- Operators can adopt Voyant as the operating layer without moving every domain
  into native Voyant modules on day one.
- External-system integrations get one vocabulary for source authority,
  projections, live calls, sync health, and disconnect behavior.
- The model keeps the existing taxonomy small. Federation is a deployment
  posture, not a new meta-plugin system.
- Capability replacement stays explicit and reviewable instead of emerging from
  ad hoc adapter code.
- Agent safety requirements become part of the integration contract rather than
  an afterthought.

### Negative

- The shared source-connection/provenance model becomes a new platform surface
  that must be kept small and stable.
- True capability replacement still requires port work. `relationships` cannot
  be displaced by HubSpot cleanly until a `PeopleDirectory`-style port exists.
- Admin UI has to expose provenance, freshness, and edit authority everywhere
  federation appears, not just in catalog.
- Daemon execution needs a clearer product surface before long-running sync
  integrations are production-friendly.

## Alternatives considered

### Global `orchestratorMode: true`

Rejected. The source-of-truth relationship differs by capability and operation.
A global flag would hide important behavior and make module authors guess which
semantics apply.

### Make every standard module replaceable now

Rejected. ADR-0007 already explains why broad replacement is not v1 scope. Ports
should be introduced where a real external-system requirement exists.

### Treat every external integration as a plugin

Rejected. Plugins are distribution bundles. Runtime semantics should still be
provider, adapter, extension, module, workflow, daemon, or source adapter.

### Use workflows for sync loops

Rejected. Workflows are durable business orchestrations. Long-running connector
ownership belongs to daemon-style execution.

## Phasing

1. Document federated operating mode and source-of-truth modes. This ADR and the
   architecture guide are that slice.
2. Design the shared source-connection/provenance contract.
3. Spike HubSpot as `mirrored` CRM using current `relationships` surfaces.
4. Design `PeopleDirectory` only if true CRM replacement becomes a real
   requirement.
5. Formalize daemon execution for source sync, backfill, and reconciliation.
6. Add admin provenance/freshness/edit-authority primitives.
7. Integrate action-ledger capability policy into externally sourced mutations.
