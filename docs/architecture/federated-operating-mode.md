# Federated operating mode

Status: proposed rule

Audience: anyone designing integrations where Voyant is the operating layer
while HubSpot, Nezasa, marketplace sources, direct supplier APIs, GDS systems,
or customer-owned systems remain authoritative for selected capabilities.

This guide defines **federated operating mode**. It is paired with
[ADR-0009](../adr/0009-federated-operating-mode.md).

Federated per-domain apps are also the **edge-native** deployment posture: their
per-domain graphs are small enough to stay resident on Cloudflare Workers, unlike
a composed operator API (which is Node-first — see
[deployment-targets.md](./deployment-targets.md)).

Federated operating mode is not a new runtime abstraction. It is a deployment
posture that uses the existing Voyant vocabulary: modules, providers, adapters,
extensions, plugins, workflows, schedules, daemons, source adapters, action
ledger, and custom modules.

## Maturity

This document separates decided posture from candidate implementation shape.

Decided:

- federated operating mode is the name for this posture
- source-of-truth mode is declared per capability or integration
- existing taxonomy still decides whether something is a provider, adapter,
  extension, module, or plugin bundle
- long-running sync ownership belongs to daemon-style execution, not workflows
- agents and tools use Voyant control surfaces for external-system actions

Candidate shape, to be validated in follow-up implementation slices:

- exact source-connection schema
- exact provenance column names
- enum values for write authority, freshness, health, and conflict state
- reusable admin UI components
- first capability-port DTOs

The candidate fields below are meant to keep early integrations aligned. They
are not a frozen database schema.

## 1. Core idea

In federated operating mode, Voyant acts as the operating layer:

- API runtime
- admin and storefront surfaces
- workflow and automation runtime
- agent/tool control surface
- search and projection layer
- local snapshots and audit
- finance, support, and reconciliation workspace
- cross-system orchestration

External systems may still own selected domain truth.

```txt
External system
  -> adapter / sync daemon / live provider
  -> Voyant projection + links + provenance
  -> Voyant APIs, UI, search, workflows, agents
  -> live upstream calls for authoritative operations
  -> local snapshots, action ledger, finance/support records, audit
```

Rule:

Do not frame federation as "replace the framework." Frame it as "declare where
truth and write authority live for each capability."

## 2. Source-of-truth modes

Each federated capability should declare one source-of-truth mode.

| Mode | Meaning | Typical use |
| --- | --- | --- |
| `native` | Voyant owns authoritative state and behavior. | Standard module behavior: native bookings, finance, inventory, relationships. |
| `mirrored` | An external system owns truth; Voyant stores a local projection. | HubSpot contacts mirrored into `relationships`; upstream product feeds projected for search. |
| `external-live` | Voyant stores handles and calls upstream live for authoritative reads/writes. | Live price/availability, upstream booking status, cancellation quote. |
| `hybrid` | Authority is split by field or operation. | Upstream owns inventory status; Voyant owns merchandising overlays, support notes, local finance, and audit. |

Rules:

- Declare the mode per capability or integration, not through a global
  `orchestratorMode` flag.
- A mode declaration must state read authority, write authority, freshness
  expectations, and disconnect behavior.
- `hybrid` requires field- or operation-level ownership. Do not use it as a
  vague escape hatch.
- Historical bookings, snapshots, audit records, and action ledger entries stay
  local even when a source disconnects.

## 3. Classification rules

Federated mode uses the existing package taxonomy.

### Provider

Use a provider when one narrow implementation can be swapped behind a contract.

Examples:

- payment starter
- notification delivery
- storage backend
- embedding provider
- reference-data provider

Rule:

If the problem is "which implementation handles this one execution seam?", use
a provider.

### Adapter

Use an adapter when a package primarily talks to an external system.

Examples:

- HubSpot adapter
- Nezasa adapter
- Viator source adapter
- SmartBill adapter
- GDS connector

An adapter may expose providers, source adapters, route handlers, webhook
handlers, daemon definitions, or workflow helpers.

Rule:

If the package exists because an external system exists, classify it as an
adapter even if it ships as a plugin bundle.

### Extension

Use an extension when an integration customizes or augments an existing module.

Examples:

- add upstream sync routes under an existing product surface
- add booking reconciliation actions under bookings
- add admin widgets for source health

Rule:

If the integration changes an existing capability without creating a new bounded
capability, use an extension.

### Module

Use a module when the integration introduces a real bounded capability with its
own lifecycle, data model, routes, and service surface.

Examples:

- loyalty
- concierge operations
- customer-specific case management
- a deployment-specific external-program spine

Rule:

Do not use a module just because a vendor integration has many files. Use a
module when there is new domain ownership.

### Plugin

Use a plugin only as a distribution bundle.

Rule:

A plugin may bundle modules, extensions, providers, adapters, subscribers,
workflows, and admin contributions. It does not make "plugin" the runtime
semantic.

## 4. Source connections

Federated integrations should share one source-connection concept instead of
inventing source tables per adapter.

A source connection is the durable record that says:

- which external system is connected
- which capability scope it serves
- which credentials and scopes are granted
- which source capabilities are available
- which sync cursors and health state apply
- what happens when the source is paused or disconnected

The exact schema will be designed separately. The fields below are illustrative
contract candidates for that slice, not a committed table definition.

### Candidate identity fields

- connection id
- source kind, for example `crm:hubspot`, `package:nezasa`,
  `marketplace:viator`, `gds:amadeus`
- display name
- capability scope, for example `people`, `catalog`, `booking-status`,
  `finance-documents`
- source-of-truth mode
- lifecycle status, for example `draft`, `active`, `paused`, `degraded`,
  `disconnecting`, or
  `disconnected`

### Candidate credentials and grants

- encrypted credential reference
- secret version or key reference
- granted OAuth/API scopes
- source account/portal/tenant id when the vendor exposes one
- expiration and refresh metadata

Rules:

- Do not store raw vendor secrets in source-connection JSON payloads.
- Credential references are deployment/runtime concerns; package code should
  receive resolved clients or narrow credential readers through providers.

### Candidate capabilities

Record declared source capabilities, such as:

- browse projection
- live pricing
- live availability
- upstream hold/book
- cancellation quote
- cancellation execute
- status retrieval
- Service Voucher retrieval
- webhook delivery
- delta sync
- backfill
- upstream writeback

Use positive, negative, and unknown declarations where the source contract
needs that distinction. Do not infer exact behavior from a missing key.

### Candidate health, cursors, and limits

Source connections should expose:

- last healthy time
- last checked time
- last error code
- last error message
- rate-limit state
- retry-after hint
- sync stream cursors
- high-water marks
- current backfill id/status
- next scheduled reconciliation time

Rule:

Health and cursor state belong to the source connection or its child sync-state
records, not to arbitrary module rows.

### Disconnect behavior

Every connection must declare what disconnect means:

- stop future sync only
- hide unpublished projections
- preserve published projections as stale
- disable live operations
- keep historical bookings and snapshots
- queue cleanup/revocation work
- hard-delete only source-owned projections with no historical dependency

Rule:

Disconnecting a source must not erase historical booking truth, action ledger
entries, or support/audit context.

## 5. Cross-module provenance

Catalog already has strong sourced-inventory vocabulary. Federated mode extends
the same discipline beyond catalog.

Modules do not have to use identical column names, but they should preserve the
same facts.

Recommended provenance facts:

| Fact | Purpose |
| --- | --- |
| Source mode | `native`, `mirrored`, `external-live`, or `hybrid`. |
| Source kind | Vendor/source family such as `crm:hubspot` or `package:nezasa`. |
| Source connection | The source connection that produced or controls the row. |
| Source reference | Stable upstream object id. |
| Source sub-reference | Optional upstream child id, option id, line id, or variant id. |
| Source updated time | Upstream last-modified time when known. |
| Last sourced time | Time Voyant last read or projected the source. |
| Payload hash | Hash for drift/conflict detection when useful. |
| Freshness state | Live, synced, stale, unknown, or module-specific equivalent. |
| Write authority | Local, upstream, overlay-only, forwarded upstream, or read-only. |
| Sync state | Pending, synced, stale, conflict, failed, or module-specific equivalent. |
| Conflict state | Whether local and upstream facts disagree. |
| Evidence reference | Optional pointer to raw payload or audit artifact. |

These names are intentionally descriptive rather than schema-prescriptive. The
first source-connection implementation should choose concrete column and enum
names that fit the owning package while preserving the facts above.

Rules:

- Use local projections for browse, search, joins, and admin ergonomics.
- Use live upstream calls for volatile or authoritative operations.
- Keep raw payloads as evidence and recovery material, not as public contracts.
- Do not create cross-package hard foreign keys for provenance associations.
  Use link definitions or source refs according to the schema-discipline rules.
- In `hybrid` mode, field-level authority must be documented. A single row-level
  source label is not enough.

## 6. Capability ports

Capability replacement is not the same as module removal.

ADR-0007 supports removing optional standard modules. It does not support
replacing a required module with an external implementation. Replacement needs a
named port and a neutral DTO contract.

Rules:

- Add ports only for real replacement needs.
- Keep ports narrower than the module's internal implementation.
- Prefer mirroring into current modules before introducing a replacement port.
- Do not add a universal `DomainProvider` or generic CRUD proxy.

### Initial port inventory

#### `PeopleDirectory`

Purpose:

True external CRM replacement.

Near-term posture:

HubSpot-style integrations should run as `mirrored` CRM and sync people,
organizations, contact points, activities, and external refs into
`relationships`.

Replacement posture:

Only add `PeopleDirectory` when a deployment needs HubSpot or another CRM to
displace `relationships` as the authoritative read/upsert service.

Likely surface:

- get person by id/ref
- get organization by id/ref
- search people/organizations
- upsert person from contact
- upsert organization from account
- resolve billing/traveler snapshots
- expose contact-point and consent facts needed by bookings, legal, storefront,
  and notifications

#### Catalog and booking source adapters

Purpose:

Sourced sellable inventory and upstream booking operations.

Current posture:

Use the catalog `SourceAdapter` and booking-engine contracts. Extend them where
real sources need status retrieval, Service Voucher retrieval, amendments, or richer
reconciliation.

#### External booking status provider

Purpose:

Normalize upstream status, Service Voucher, cancellation, amendment, and refund facts
for bookings whose fulfillment is source-owned.

Preferred direction:

Keep this as a source-adapter capability unless multiple non-catalog booking
owners force a separate port.

#### Finance document provider

Purpose:

External invoice/document systems that remain authoritative for document
issuance, settlement state, or legal-number allocation.

Preferred direction:

Do not introduce this until a concrete external finance owner requires it.
Existing provider seams for payment, notifications, storage, and document
delivery should be used first.

## 7. Execution guidance

Federated mode depends on honest execution placement.

### Daemons

Use daemons for:

- polling loops
- webhook bridge ownership
- bulk ingestion
- initial backfills
- cursor advancement
- long-running source sync
- reconciliation against upstream truth
- rate-limit-aware batch work

Daemons own connector state and technical execution. They may emit events,
write projections, or start workflows.

### Schedules

Use schedules to decide when work starts.

Examples:

- kick off a nightly reconciliation daemon pass
- start a stale-projection refresh workflow
- poke a paused backfill

Schedules must stay thin.

### Workflows

Use workflows for business orchestration.

Examples:

- after upstream booking confirmation, create local finance state and notify the
  operator
- after a Nezasa booking status changes, reconcile customer-facing itinerary
  documents and support tasks
- after HubSpot ownership changes, assign Voyant follow-up work
- coordinate approval and execution for an agent-proposed external write

Workflows should not be permanent sync loops.

### Events

Emit events after durable state changes.

Events are appropriate for signaling projections, cache refresh, or follow-up
automation. If a reaction needs retries, delays, explicit identity, or durable
failure handling, move that reaction into a job, workflow, or daemon path.

## 8. Admin and UI requirements

Any admin surface that shows federated records must make authority visible.

Show:

- source label, for example "Sourced from HubSpot" or "Sourced from Nezasa"
- source mode
- last sourced time
- freshness/staleness state
- sync health and last error where relevant
- connection status
- conflict state
- edit authority
- queued upstream write status when writes are forwarded
- local overlay markers where Voyant owns only merchandising or annotations
- links to sync runs, workflow runs, action ledger entries, and source
  connection detail

Edit controls should be based on authority:

| Authority | UI behavior |
| --- | --- |
| `voyant` | Normal local edit. |
| `overlay` | Save local overlay without claiming upstream mutation. |
| `upstream` | Either disable local edit or execute an upstream write through a controlled command. |
| `forwarded` | Show pending/succeeded/failed upstream write state. |
| `none` | Read-only. |

Rules:

- Do not let a local form imply Voyant owns a field when upstream owns it.
- Do not hide stale/conflict state behind a generic error banner.
- Customer-facing UI may downplay provenance when appropriate, but API payloads
  and admin tooling must preserve it.

## 9. Agent and tool control

Agents should operate through Voyant tools and commands, not direct vendor SDK
access.

Every externally sourced mutation or sensitive read should pass through:

- actor and delegated-principal context
- capability check
- source-connection scope check
- idempotency key
- action-ledger write
- approval policy where required
- workflow/run correlation where applicable
- reversal or compensation metadata

Rules:

- An agent never inherits a staff user's full session implicitly.
- A tool call that writes upstream must have the same or stronger control
  posture as a human-triggered upstream write.
- High-risk external writes should create requested actions and approvals before
  execution.
- Compensation must be domain-aware. Generic database rollback is not an undo
  strategy for upstream side effects.
- Sensitive retrieval contexts should be ledgered before the agent receives the
  value.

## 10. Adoption strategy

Federated adoption should be incremental.

### Step 1: Map systems and authority

For each candidate system, list:

- capability
- source-of-truth mode
- read authority
- write authority
- freshness expectation
- disconnect behavior
- historical-retention requirement
- required agent/tool permissions

### Step 2: Start with read-only projections

Prefer `mirrored` read-only projection before upstream writes.

Deliver:

- source connection
- credential resolution
- projection schema or mapping
- provenance metadata
- sync daemon or import job
- admin provenance/freshness display

### Step 3: Add live reads

Add `external-live` calls for volatile data:

- final price
- availability
- booking requirements
- upstream status
- vouchers/artifacts
- cancellation quote

### Step 4: Add controlled writes

Only add upstream writes after:

- idempotency policy exists
- action ledger entries exist
- retry and reconciliation behavior is defined
- approval policy is defined for high-risk actions
- admin UI shows pending/upstream state

### Step 5: Promote or migrate selectively

Once a domain is stable, decide whether to keep it federated or migrate it
native.

Migration from federated to native should preserve:

- source refs
- booking snapshots
- action ledger history
- finance/support records
- external audit evidence

## 11. Examples

### HubSpot

Recommended first implementation:

- mode: `mirrored`
- adapter: HubSpot adapter
- target: `relationships`
- source connection: `crm:hubspot`
- daemon: contact/company/activity delta sync
- local state: people, organizations, contact points, external refs, selected
  activity signals
- write authority: initially upstream or local overlay only
- replacement port: defer `PeopleDirectory` until a real deployment needs
  HubSpot to displace `relationships`

### Nezasa

Recommended first implementation:

- mode: `hybrid`
- adapter: Nezasa adapter
- target: catalog/product/package projection plus booking upstream handles
- source connection: `package:nezasa`
- daemon: catalog sync and booking reconciliation
- live operations: price, availability, booking requirements, booking status
- local state: catalog projection, overlays, booking snapshots, support,
  finance, action ledger
- write authority: source-owned for booking operations, Voyant-owned for local
  support/audit/finance records

### Customer-specific system

Classification depends on what the system owns:

- narrow implementation seam: provider
- external API bridge: adapter
- existing module customization: extension
- new bounded capability: custom module
- reusable distribution: plugin bundle

## 12. Design checklist

Before adding a federated integration, answer:

1. Which capability is being federated?
2. Which source-of-truth mode applies?
3. Is this a provider, adapter, extension, module, or plugin bundle?
4. What source connection records and credential refs are required?
5. What provenance metadata lands on local rows and snapshots?
6. Which fields are locally editable, overlay-only, upstream-owned, or
   read-only?
7. What is the freshness contract?
8. What happens when sync fails?
9. What happens when the source disconnects?
10. Which work is daemon, schedule, workflow, event, or synchronous request?
11. Which actions need capability checks, ledger entries, approval, or
    compensation?
12. What can be adopted read-only before writes are enabled?
