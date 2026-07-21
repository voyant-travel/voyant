# Action Ledger, Roles, And Reversibility

Status: draft / planning reference
Audience: anyone designing operator audit trails, permission checks, approval
flows, reversible commands, workflow operations, or AI-agent execution in
Voyant.

The workflow product has since been retired. Workflow principal/run fields in
this planning document describe retained historical ledger compatibility; new
product execution uses commands, subscribers, jobs, and external automation.

This document captures a platform-level bottleneck before broad AI automation:
operators need to quickly answer **who did what, why, under which authority,
and can we undo or compensate it?**

This is not specific to travel composition. AI makes the requirement urgent,
but the same layer benefits staff actions, API keys, workflows, channel sync,
payment operations, catalog overlays, and support tooling. If an agent becomes
opaque, it is usually exposing a control problem that already existed for
humans and integrations.

The core conclusion is:

**AI should not get special trust.** AI agents should be ordinary actors with
explicit delegated authority, durable action logs, approval gates, and the same
domain-level reversal paths that humans and integrations use.

## 1. Current foundation

Voyant already has several partial primitives:

- **Request actor context** in `@voyant-travel/core` with `actor`, `callerType`,
  `userId`, `sessionId`, `organizationId`, `scopes`, API key identifiers, and
  internal-request markers.
- **Auth and identity architecture** that separates identity, actor context,
  and permission checks.
- **Better Auth roles and API token permissions** in the auth surface, but no
  Voyant-wide capability registry that every domain module consumes
  consistently.
- **Event envelope** in `@voyant-travel/core/events` with `category`, `source`,
  `correlationId`, and `causationId`; the event policy correctly treats the
  current EventBus as signaling, not durable audit.
- **Booking activity logs** for booking-local state changes and notes.
- **Booking PII audit** through `booking_pii_access_log`, including actor,
  caller type, action, outcome, reason, and metadata.
- **Catalog overlay history/revert intent** in the catalog architecture for
  auditing and reverting editorial overrides.
- **Workflows** for durable orchestration, retries, and compensation, with run
  records available to operational dashboards.

These are useful but fragmented. They do not yet provide one cross-module
answer to "show me everything this user/API token/agent/workflow did."

## 2. Problem statement

Before AI can safely perform meaningful mutations, Voyant needs:

1. **Attribution** - every important action identifies the principal, caller
   type, actor type, delegated authority, and source of execution.
2. **Authorization** - roles/scopes must be granular enough to express what a
   human, API token, workflow, or AI agent may do.
3. **Action history** - high-risk writes and sensitive reads must create
   durable, queryable ledger entries.
4. **Approval gates** - high-risk or irreversible actions need deterministic
   policy checks and human approval paths.
5. **Reversibility** - when an action can be undone, the system must know the
   domain command to run. When it cannot be undone, the system must expose the
   compensating action or mark it irreversible.
6. **Operator UI** - staff need a fast timeline: actor, action, target,
   timestamp, result, workflow/tool context, and available reversal options.

The absence of this layer causes two failure modes:

- AI agents become opaque because their tool calls vanish into ordinary service
  writes.
- Staff actions remain hard to inspect or unwind, so AI is blamed for a control
  problem rather than the missing control surface.

## 3. Non-goals

This layer does not introduce:

- generic database rollback as an undo mechanism
- a replacement for domain events
- a replacement for workflow run history
- a replacement for module-local business records like booking activity logs
- a claim that every read must be logged
- a global super-admin role model that ignores actor type and route boundary
- an append-only copy of every row mutation in the database

The goal is an action-control surface for important reads/writes, not a second
database history.

## 4. Core distinction

Voyant should keep four histories separate:

### Domain state

The real business tables: bookings, invoices, catalog overlays, payment
sessions, products, workflows, etc. These remain the source of truth.

### Domain events

Business/process facts emitted after durable state changes. Events are for
integration and reaction, not complete audit.

### Workflow journal

Execution history for a durable orchestration. This explains how a workflow ran
and which steps retried or compensated.

### Action ledger

A cross-module, actor-centered record of important actions:

- who initiated the action
- which authority allowed it
- which domain target changed or was read
- which command/tool/workflow step executed
- what the result was
- whether reversal is possible

The action ledger links to domain state, events, and workflow runs. It does not
replace them.

## 5. Write path and consistency model

Voyant should support three write profiles, not one path with a strictness
flag.

### Ledger-required mutations

Ledger-required mutations must write the durable action spine in the same
transaction as the domain mutation:

1. The route/tool/workflow calls a domain command through a ledger-aware
   service boundary.
2. The domain mutation and `action_ledger_entries` row are written in the same
   database transaction.
3. If the ledger entry cannot be written for a ledger-required action, the
   domain command fails.
4. External audit exporters and search projections tail the append-only ledger
   with a durable `(occurred_at, id)` checkpoint owned by each consumer.
5. Payload hydration or redaction work is emitted as a durable event through
   the generic transactional event outbox in `@voyant-travel/db/outbox` and the
   always-on `outbox-drain` managed job.

This does not remove all write-path coupling. The domain mutation is still
coupled to writing the small ledger entry in the primary transaction. That is
the intended tradeoff for high-risk actions: if Voyant cannot durably record
the action, it should not commit the action.

The append-only ledger is its own export stream. Cursor consumers get
at-least-once delivery by committing their checkpoint only after downstream
delivery succeeds. Every consumer owns an independent checkpoint, so adding a
SIEM exporter does not couple its progress to a search projection. Search
projections remain rebuildable by resetting their checkpoint and replaying the
ledger.

The durable audit truth is `action_ledger_entries` plus its committed profile
details and payload references. Cursor checkpoints and the generic event
delivery tables are operational state, not audit truth. Operators observe
export and projection health through per-consumer checkpoint lag, and observe
hydration/redaction delivery through the generic event-outbox metrics. A lagging
consumer must not rewrite a successfully committed domain action as failed.

### Best-effort optional logging

Optional low-risk logging should use a separate fire-and-forget path outside
the primary transaction. It should not be implemented as "outbox with
`required = false`," because a same-transaction outbox row can still roll back
the mutation.

Best-effort logging is acceptable only when the capability's `ledger_policy`
explicitly allows loss.

### Ledger-required sensitive reads

Sensitive reads usually have no domain mutation transaction to piggyback on.
For PII reveals, credential access, private document access, and agent
retrieval contexts, the ledger row is the only durable state change.

Those reads should use a standalone synchronous ledger write with retry and
alerting. The read response should not return the sensitive value until the
ledger entry is durable.

Ordering rules:

- `correlation_id` is the end-to-end request/session/workflow trace id.
- `causation_action_id` points to the parent ledger entry when one action
  caused another, such as approval -> execution or agent plan -> tool call.
- There is no global ordering guarantee beyond committed timestamps and ids.
  Consumers that need strict sequencing should order within a target or
  workflow/correlation scope.

## 6. Ledger profiles and shared spine

The ledger should not be one wide table where every writer fills out dozens of
nullable columns. Use a required spine plus profile-specific detail tables or
payload records.

### Shared action spine

Every ledgered action should carry the smallest stable facts:

```txt
action_ledger_entries
  id
  occurred_at
  action_name
  action_version
  action_kind
  status
  evaluated_risk
  actor_type
  principal_type
  principal_id
  principal_subtype
  session_id
  api_token_id
  internal_request
  delegated_by_principal_type
  delegated_by_principal_id
  delegation_id
  caller_type
  organization_id
  route_or_tool_name
  workflow_run_id
  workflow_step_id
  correlation_id
  causation_action_id
  idempotency_scope
  idempotency_key
  idempotency_fingerprint
  target_type
  target_id
  capability_id
  capability_version
  authorization_source
  approval_id
  amends_action_id
  created_at
```

Spine fields should not include rotten display denormalizations or ambiguous
booleans such as `permission_checked`. The checked capability id/version,
evaluated risk, and authorization source are the durable authorization facts.
Display labels can be resolved at read time, or stored in a short-lived
projection.

Current request context maps into the spine as follows:

- `userId` -> `principal_id` when `principal_type = "user"`
- `apiTokenId` -> `api_token_id` and often `principal_id` when
  `principal_type = "api_key"`
- `sessionId` -> `session_id`
- `callerType` -> `caller_type`
- `organizationId` -> `organization_id` metadata when present
- `isInternalRequest` / internal markers -> `internal_request`
- delegated user, workflow, parent agent, or API token ->
  `delegated_by_principal_type`, `delegated_by_principal_id`, and optionally
  `delegation_id`

Longer chains such as user -> agent -> workflow -> tool should use
`delegation_id` to link to a delegation-edge record or payload. The spine keeps
the immediate parent for fast filtering; the delegation record preserves the
full chain.

Actor/principal semantics:

- `actor_type` is the business audience or actor class: staff, customer,
  partner, supplier, etc.
- `principal_type` and `principal_id` identify the effective principal that
  executed this action: user, API key, agent, workflow, or system.
- `delegated_by_principal_type/id` identify the immediate authority that
  delegated to the effective principal.
- `delegation_id` points to the full delegation chain when the immediate parent
  is not enough for audit or debugging.
- `authorization_source` records which grant source allowed the action, not
  just which principal executed it.

### Mutation profile

Mutations add command and result detail:

```txt
action_mutation_details
  action_id
  command_input_ref
  command_result_ref
  summary
  reversal_kind
  reversal_command_id
  reversal_command_version
  reversal_args_ref
  reversal_state_projection
  reversal_outcome_projection
  reverses_action_id
  reversed_by_action_id_projection
```

Snapshot or diff data belongs in payload records, not the spine. A mutation may
store a diff, a before snapshot, an after snapshot, or only a summary depending
on the domain's risk and storage policy; it should not be forced to provide all
three. Reversal projection fields are convenience fields derived from
append-only reversal/compensation entries.

### Sensitive-read profile

Sensitive reads are narrower and should usually avoid copying the revealed
value:

```txt
action_sensitive_read_details
  action_id
  reason_code
  disclosed_field_set
  disclosure_summary
  decision_policy
```

Examples include PII reveals, private document access, credentials, and AI
retrieval contexts where "what did the agent see?" matters.

### Approval profile

Approvals and denials are a state machine around a requested action:

```txt
action_approvals
  id
  requested_action_id
  status
  requested_by_principal_id
  assigned_to_principal_id
  decided_by_principal_id
  delegated_from_principal_id
  policy_name
  policy_version
  target_snapshot_ref
  risk_snapshot
  reason_code
  expires_at
  decided_at
  created_at
```

The approval decision itself is also ledgered as an action. The approval record
is the source of state; notifications are delivery mechanisms.

## 7. Idempotency policy

`idempotency_key` is part of the behavior contract, not just a column.

Generation:

- External API callers should provide a stable key for retried mutation
  requests.
- Route handlers may generate a key when the caller lacks one, but that only
  protects retries inside that request boundary.
- Agent runtimes must generate a stable key per intended tool action, not per
  network attempt.
- Workflow steps should derive the key from workflow id, step id, action name,
  and target id.

Scope:

```txt
deployment boundary + optional organization_id + idempotency_scope
  + action_name + target_type + target_id + idempotency_key
```

`idempotency_scope` decides whether the key is scoped to a user, API token,
agent run, workflow step, external request id, or broader integration context.
Do not hard-code `principal_id` into the universal uniqueness rule: workflow
reassignment, agent service-principal rotation, or API-token rotation can
otherwise break intended dedupe.

`organization_id` participates only when the current deployment uses it as
business metadata. It is not a substitute for the deployment boundary and must
not become package-level tenant enforcement.

Each idempotent action must store `idempotency_fingerprint`, a stable hash of
the command input, target, action version, and material policy inputs. Same
scope/key plus a different fingerprint is an idempotency conflict and must not
silently replay the prior result.

Replay semantics:

- If the original action succeeded, return the prior result or a stable
  reference to it.
- If the original action is in flight, return or wait according to the route's
  existing retry policy.
- If the original action failed before a domain mutation, the command may retry
  under the same key.
- If the original action partially executed, the domain command must decide
  whether retry continues, compensates, or fails closed.
- Exact duplicates should not create a second primary action row. If duplicate
  attempts matter operationally, record an attempt count or a child
  `action_kind = "duplicate"` entry.

## 8. Authorization model

Voyant needs a capability registry layered over the existing grant model, not a
second permission system.

Better Auth roles, Better Auth API token permissions, route guards, internal
request markers, and session checks remain the grant sources. The capability
registry adds policy metadata: risk, approval requirements, ledger policy,
reversibility, and evaluation hooks. It answers "what controls apply to this
allowed action?" after the existing auth surface answers "is this principal
allowed at all?" API-token grants continue to use the permissions model in
[`service-api-keys.md`](./service-api-keys.md); capabilities must map onto
those grants rather than bypass them.

Recommended package ownership:

- A shared `@voyant-travel/action-ledger` or control-plane package defines registry
  types, guard helpers, and ledger service contracts.
- Domain modules declare capabilities at module load, consistent with the
  existing module/provider pattern.
- Templates assign module capabilities to roles, API tokens, and service
  principals.

Recommended shape:

```txt
capability
  id: "booking.cancel"
  version: "v1"
  resource: "booking" | "catalog.overlay" | "payment" | "workflow" | ...
  action: "read" | "create" | "update" | "cancel" | "refund" | ...
  risk: "low" | "medium" | "high" | "critical"
  risk_evaluator
  allowed_actor_types
  approval_policy
  ledger_policy
  reversible
```

Risk definitions:

- `low`: reversible local metadata or non-sensitive internal configuration.
- `medium`: meaningful internal state changes with limited customer/external
  impact.
- `high`: customer-visible changes, booking/payment state transitions, PII
  reveals, or external side effects below critical thresholds.
- `critical`: irreversible actions, money movement above threshold, legal
  commitments, bulk data export, permission grants, credential access, or
  destructive external side effects.

Static risk is a floor, not always the final answer. Capability evaluators may
escalate risk based on target state, amount, actor type, customer visibility,
or external side effects. For example, `booking.cancel` may be low-risk on an
unsent draft, high on a customer-visible confirmed booking, and critical on a
paid booking with supplier or refund obligations.

The evaluated risk drives the write profile:

- `high` and `critical`: same-transaction ledger entry for mutations, or
  standalone synchronous write for sensitive reads.
- `low` and `medium`: best-effort only when `ledger_policy` explicitly permits
  loss; otherwise they can still require durable ledger writes.

Ledger entries store `capability_id`, `capability_version`, `evaluated_risk`,
and `authorization_source` such as `better_auth_role`, `api_token_permission`,
`internal_request`, `delegated_agent_capability`, or `workflow_capability`.

Capability evolution:

- New medium/high/critical capabilities are not auto-granted to existing roles.
- New low-risk capabilities may be auto-granted only when the template role
  policy explicitly opts into that behavior.
- Capability changes should be versioned or migration-noted so role drift is
  reviewable.

AI agents should run as service principals with:

- explicit `principal_type = "agent"`
- a stable agent id and optional `principal_subtype` such as `drafting_agent`,
  `retrieval_agent`, or `tool_runner`
- delegated authority from a user, API token, workflow, or parent agent
- bounded scopes/capabilities
- budget, rate, time-window, and target constraints
- mandatory action ledger records for every tool call that reads sensitive
  data or mutates anything

An AI agent should never inherit a staff user's full session implicitly. It
should receive delegated, inspectable authority.

## 9. Approval policy and delivery

Some actions can run immediately. Others require approval.

Policy inputs should be deterministic:

- actor type and principal type
- capability risk
- target module and target status
- amount/currency
- customer-visible impact
- inventory/booking/payment/legal side effects
- whether the action was AI-initiated
- whether the action is reversible

Examples:

- AI updating a catalog marketing title: allowed if scoped, ledgered, and
  reversible through overlay history.
- AI cancelling a paid booking: requires human approval.
- AI starting checkout for a customer-confirmed draft: allowed only if the
  customer confirmation action is ledgered and current.
- API token issuing a refund above a configured threshold: requires approval or
  a stronger capability.

Lifecycle requirements:

- A high-risk action that needs approval creates a requested action ledger
  entry with `status = "awaiting_approval"` before execution.
- The approval record has its own status: `pending`, `approved`, `denied`,
  `expired`, `cancelled`, or `superseded`.
- The requested action stores snapshots of the evaluated target state, risk,
  policy name/version, and material approval inputs.
- Execution must re-evaluate target state and policy. If the booking, amount,
  customer-visible impact, or policy has changed materially, the old approval
  cannot be consumed without a new approval.
- Approval-required mutation requests must include an idempotency key. The
  requested ledger entry stores a deterministic fingerprint over the action
  identity, target, command input, capability, risk, approval policy, and reason
  code. Reusing the same key with a different fingerprint is a conflict.
- Approved execution consumes the approval by referencing the approval id and
  the original requested action. For HTTP route integrations, the proving
  contract is the `ACTION_LEDGER_APPROVAL_ID_HEADER` export from
  `@voyant-travel/action-ledger`. Execution must validate that the approval is
  approved, unexpired, linked to a requested action with the expected action
  kind/status, owned by the current principal, and still fingerprint-equivalent
  to the approved command.
- Approved execution entries must set `causation_action_id` to the requested
  action id and `approval_id` to the approval id. Integrations should stamp
  these fields through `buildActionLedgerApprovedExecutionFields(...)`. A retry
  or duplicate execution must be rejected once a succeeded execution exists for
  that causation and approval pair.

Delivery requirements:

- Approval requests land in a reusable approval inbox, not ad hoc module UI.
- Notification adapters may fan out to email, Slack, or in-app notifications,
  but the approval record is authoritative.
- Expired approvals become `expired` or `denied` by policy; they do not hang
  forever.
- Delegation chains must be explicit when an assigned approver is unavailable.
- Approvals, denials, expirations, and delegated approvals are ledgered.

## 10. Reversibility model

Reversal is domain-level, not database-level.

### Revert

Use when the old state can safely be restored.

Examples:

- catalog overlay value restored from overlay history
- draft itinerary revision rolled back to a prior saved version
- role assignment changed back

### Compensate

Use when the original action produced external or downstream side effects.

Examples:

- cancel a hold placed upstream
- void an unpaid invoice
- issue a credit note for a paid invoice
- cancel or refund a booking through the domain cancellation flow

### Irreversible

Use when the action must remain as historical truth.

Examples:

- delivered email
- issued legal signature
- external payment capture after settlement window
- exported data to an external integration

Reversal is not binary. Track:

- `reversal_state`: `not_reversible`, `available`, `requested`, `running`,
  `completed`, `failed`, `expired`
- `reversal_outcome`: `full`, `partial`, `failed`
- `reverses_action_id`: the original action this reversal targets
- `reversed_by_action_id`: the reversal action that completed or attempted it

The immutable ledger entries are the audit truth. Reversal and approval state
changes should be represented as new ledger entries. Fields such as
`reversal_state`, `reversal_outcome`, and `reversed_by_action_id` may exist on
profile tables or read models as rebuildable projections, but they must not be
the only record of a state transition.

Partial compensation is normal. A paid booking cancellation may refund 50% per
policy and leave the remainder as a defined retained amount. Later chargebacks
or corrections should create new ledger entries chained to the prior action,
not mutate history into a simpler story.

Reversal commands must be versioned:

```txt
reversal_command_id = "booking.cancel"
reversal_command_version = "v1"
reversal_args_ref = payload with schema_tag
```

The command args should be snapped at write time when possible. If an old
command is no longer executable, the operator UI should say "no longer
reversible by this command" and show available follow-up actions.

Ledger corrections happen through a new action with `amends_action_id`; the
prior entry remains append-only.

The UI should say "cannot reverse" and offer available follow-up actions, not
pretend everything has an undo button.

## 11. Payload, snapshot, and retention policy

Large payloads should be stored behind payload references, not embedded in the
ledger spine:

```txt
action_ledger_payloads
  id
  action_id
  payload_kind
  schema_tag
  redaction_status
  retention_policy
  storage_ref
  hash
  created_at
  expires_at
```

Rules:

- Store summaries and field names by default, not raw PII or secrets.
- Sensitive-read ledger entries should not copy the value revealed unless a
  domain policy explicitly requires it.
- Payloads that contain personal data must support redaction, tombstoning, or
  crypto-shredding while preserving the append-only action row.
- Snapshot blobs need `schema_tag` so old entries remain interpretable after
  domain schemas evolve.
- If an old payload can no longer be hydrated, readers should still show the
  stable ledger spine and any safe summary.
- The ledger row may outlive payloads. That is acceptable when retention policy
  says the detailed payload has expired.

The exact erasure policy should be finalized with privacy/legal requirements,
but the schema must assume payload lifecycle differs from ledger-row lifecycle.

## 12. Ledger visibility

The ledger is itself a privacy surface.

`organization_id` in this document is metadata and a query convenience inside a
single Voyant deployment. It does not change ADR-0001: tenant isolation is
enforced at the deployment boundary, not by package-level organization filters.

Default read rules:

- Ledger reads may default-filter by `organization_id` when a deployment uses
  the field to label business units, brands, or sub-organizations inside that
  customer's installation.
- Ledger reads must not rely on `organization_id` as cross-customer isolation
  in reusable packages.
- Cross-deployment/customer support from a hosted operator requires an explicit
  staff capability and the support access should itself be ledgered.
- Customer/partner self-service ledger views are out of scope for v1.
- If self-service views are added later, expose a separate narrow projection
  rather than the internal operator ledger.
- If Voyant introduces a shared control-plane ledger that stores multiple
  customer deployments in one database, ADR-0001 must be amended before
  implementation.

## 13. Query and index expectations

The operator UI and incident tooling need predictable query shapes before the
ledger grows large:

- by principal: `principal_type`, `principal_id`, time range
- by API token/session: `api_token_id` or `session_id`, time range
- by target: `target_type`, `target_id`, time range
- by workflow: `workflow_run_id`, `workflow_step_id`
- by trace: `correlation_id`, `causation_action_id`
- by control state: `evaluated_risk`, `status`, approval id, reversal state
- by capability: `capability_id`, `capability_version`
- by consumer progress: checkpoint lag and last successful export/projection
  time, reported by the owning consumer

Routes should paginate by stable cursor, usually `(occurred_at, id)`, and avoid
unbounded cross-ledger scans. Large deployments may need time partitioning or
archival projections, but that should not leak into package-level domain APIs.

## 14. Logging policy

Default logging policy:

- **Always ledger** high-risk mutations, approvals, denials, reversals,
  compensation, AI tool calls, API-token writes, payment actions, booking state
  changes, PII reveals, permission changes, and budget/rate-limit decisions for
  agent/tool execution.
- **Optionally ledger** low-risk admin CRUD writes when a module opts in.
- **Do not globally ledger** ordinary list/detail reads, except for sensitive
  reads such as PII, credentials, private documents, or AI retrieval contexts
  where "what did the agent see?" matters.

This policy keeps the ledger useful. A noisy audit stream that records every
table read is difficult to operate and expensive to retain.

## 15. Migration posture

Existing local audit primitives should not be ripped out first.

Recommended path:

- Keep booking activity logs, `booking_pii_access_log`, and catalog overlay
  history as module-local business records.
- Shadow-write central action ledger entries for selected forward actions.
- Do not attempt a broad retroactive migration unless a specific operator UI or
  compliance use case requires it.
- Backfill only stable summaries when needed, and mark backfilled entries with
  source metadata.
- New module-local audit tables should explain why the shared ledger profile is
  insufficient.

This avoids blocking the ledger on perfect historical migration while stopping
new fragmentation.

## 16. AI readiness gates

Before shipping AI agents that mutate production state, Voyant should have:

1. A shared action-ledger package or service.
2. Same-transaction ledger entries for ledger-required actions, with durable
   cursor checkpoints for exports/projections and generic durable events for
   hydration/redaction work.
3. A capability registry consumed by route/tool guards.
4. Agent service-principal identity with delegated authority.
5. Mandatory tool-call ledger records.
6. Approval policy evaluation and delivery for high-risk actions.
7. Domain reversal metadata for each agent-callable mutation.
8. Operator UI to filter by actor, agent, workflow run, target, and evaluated
   risk.
9. Correlation ids propagated from chat/session -> tool call -> service ->
   workflow -> domain events.
10. Budget/rate gates for agent and tool execution.
11. Tests proving denied, approved, executed, failed, duplicate, and reversed
    paths create coherent ledger entries.

If any of those are missing, AI should stay read-only or draft-only.

## 17. Data model sketch

Subject to refinement:

```txt
action_ledger_entries
  id
  occurred_at
  action_name
  action_version
  action_kind
  status
  evaluated_risk
  actor_type
  principal_type
  principal_id
  principal_subtype
  session_id
  api_token_id
  internal_request
  delegated_by_principal_type
  delegated_by_principal_id
  delegation_id
  caller_type
  organization_id
  route_or_tool_name
  workflow_run_id
  workflow_step_id
  correlation_id
  causation_action_id
  idempotency_scope
  idempotency_key
  idempotency_fingerprint
  target_type
  target_id
  capability_id
  capability_version
  authorization_source
  approval_id
  amends_action_id
  created_at

action_delegations
  id
  root_principal_type
  root_principal_id
  parent_principal_type
  parent_principal_id
  child_principal_type
  child_principal_id
  grant_source
  capability_scope_ref
  budget_scope_ref
  expires_at
  created_at

action_mutation_details
  action_id
  command_input_ref
  command_result_ref
  summary
  reversal_kind
  reversal_command_id
  reversal_command_version
  reversal_args_ref
  reversal_state_projection
  reversal_outcome_projection
  reverses_action_id
  reversed_by_action_id_projection

action_sensitive_read_details
  action_id
  reason_code
  disclosed_field_set
  disclosure_summary
  decision_policy

action_approvals
  id
  requested_action_id
  status
  requested_by_principal_id
  assigned_to_principal_id
  decided_by_principal_id
  delegated_from_principal_id
  policy_name
  policy_version
  target_snapshot_ref
  risk_snapshot
  reason_code
  expires_at
  decided_at
  created_at

action_ledger_payloads
  id
  action_id
  payload_kind
  schema_tag
  redaction_status
  retention_policy
  storage_ref
  hash
  created_at
  expires_at
```

Use append-only semantics for ledger entries. Corrections, reversals,
compensations, approval decisions, and duplicate attempts create related
entries. Projection columns may be updated for operator ergonomics, but must be
rebuildable from append-only entries.

Exporters and projections store one durable `(occurred_at, id)` checkpoint per
consumer in infrastructure owned by that consumer. The action-ledger schema
does not own per-delivery state. Work-queue-shaped hydration and redaction jobs
use durable events on the framework's generic transactional event outbox.

## 18. MVP slices

### Slice 1a: schema and write path

- Add a framework-owned `@voyant-travel/action-ledger` or equivalent package.
- Define the shared spine, profile schemas, and payload refs.
- Add append-only write APIs.
- Define `correlation_id`, `causation_action_id`, and idempotency semantics.
- Define the durable ledger entry as the audit source of truth.
- Document cursor checkpoint ownership for exporters/projections and generic
  durable-event delivery for hydration/redaction jobs.

### Slice 1b: read API and helpers

- Add basic list/filter routes and service APIs.
- Add route/tool helper functions that attach actor, target, correlation, and
  workflow context.
- Add the primary query indexes and cursor pagination.
- Treat `organization_id` as metadata/query convenience, not tenant
  enforcement.

### Slice 2: capability registry and guards

- Define capability metadata for a narrow first set: booking state changes,
  catalog overlays, payment/refund actions, workflow manual actions.
- Add route/tool guard helpers that return both allow/deny and the checked
  capability id/version.
- Map capabilities onto Better Auth roles/API token permissions instead of
  replacing them.
- Ledger denials for high-risk capabilities.

### Slice 3: first profiles

- Implement the mutation profile for catalog overlays and booking state
  changes.
- Implement the sensitive-read profile for booking PII access.
- Shadow-write central ledger entries while preserving local audit tables.

### Slice 4: operator audit UI and ledger observability

- Add a reusable timeline/table with filters by actor, target, action,
  evaluated risk, status, workflow run, and time range.
- Link from booking detail, catalog entity detail, payment/session detail, and
  workflow run detail.
- Add drift checks for state changes without required ledger rows.
- Add synthetic-action canaries for the ledger write path.

### Slice 5: approval inbox and reversal metadata

- Add the reusable approval inbox, stale-state re-evaluation, and
  expiry/delegation behavior.
- Start reversal metadata with catalog overlays and booking
  holds/cancellations.
- Implement "revert overlay" and "release hold/cancel booking" as explicit
  domain commands, not generic DB rollback.

### Slice 6: AI/service-principal readiness

- Add `principal_type = "agent"`, `principal_subtype`, delegated authority,
  and budget/rate constraints.
- Ledger every agent tool call.
- Enforce approval policies for agent-initiated high-risk actions.
- Add tests that show a complete chain from agent request to domain mutation to
  reversal/compensation.

## 19. Related documents

- [`auth-identity-architecture.md`](./auth-identity-architecture.md) - identity,
  actor context, and permission-check boundaries.
- [`event-delivery-and-durable-execution-policy.md`](./event-delivery-and-durable-execution-policy.md)
  - event envelope and why EventBus is not audit storage.
- [`execution-architecture.md`](./execution-architecture.md) - commands,
  subscribers, jobs, and durable execution placement.
- [`booking-pii.md`](./booking-pii.md) - sensitive-read audit and PII
  redaction.
- [`service-api-keys.md`](./service-api-keys.md) - Better Auth API token
  permissions and API-key actor context.
- [`../adr/0001-tenant-scoping.md`](../adr/0001-tenant-scoping.md) -
  deployment-boundary tenancy and the limits of `organization_id`.
- [`catalog-architecture.md`](./catalog-architecture.md) - overlay history,
  snapshot graph, and catalog audit/revert requirements.
- [`ai-travel-experience-composition.md`](./ai-travel-experience-composition.md)
  - one future consumer of this control layer, not its owner.
