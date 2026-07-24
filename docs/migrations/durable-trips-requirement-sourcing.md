# Durable Trips requirement sourcing

`source_trip_requirement_candidates` is now action version `v2` and uses
asynchronous accepted/poll semantics.

## Caller migration

Supply a stable `_voyant.idempotencyKey` for one exact sourcing request. An
accepted call returns:

```ts
{
  status: "accepted",
  operationId: "opaque-action-claim-id",
  requirementId: "trrq_...",
  statusTool: "get_trip_requirement_sourcing_operation"
}
```

Exact retries return that same immutable result, including after sourcing has
completed. Reusing the key with a changed requirement, scope, deadline, or
limit is rejected.

The result no longer embeds mutable requirement or candidate rows. Poll
`get_trip_requirement_sourcing_operation` with both returned ids, or GET
`/requirements/{requirementId}/sourcing-operations/{operationId}` on the admin
Trips API. The tenant- and target-bound response distinguishes `pending`,
`processing`, `retry`, `completed`, and `dead_letter`, preserves the exact
accepted result, and exposes a terminal outcome or error. Do not infer
operation success from the requirement alone: old ranked candidates and the
prior requirement status intentionally remain visible after a dead letter.

The synchronous `sourceRequirementCandidates`, `reshopRequirement`, and
`reshopTrip` service exports and the matching HTTP/re-shop Tool entry points
have been removed. They performed provider fan-out inline and discarded ranked
candidates before success. Callers must use
`source_trip_requirement_candidates`; selected requirements must first move
through a separately durable revision flow before they can be sourced again.

## Deployment migration

Apply the package migration that creates
`trip_requirement_sourcing_operations` and its status enum before selecting the
v2 action. The resolved deployment graph includes the required, wakeable
`trips.source-requirement-candidates` job. Hosts must run fixed product jobs;
the default cadence is once per minute.

The standard Trips runtime resolves both the Catalog source-adapter registry
and its declared owned availability-search handler registry only for the fixed
background worker. Owned-only and mixed deployments therefore settle one
deterministically price-ranked candidate set. Missing declared runtime methods
fail graph port validation. HTTP routes never receive provider adapters and
cannot fall back to inline sourcing. A fan-out with no eligible successful
source is treated as a retryable operational failure, not as authoritative
no-availability.

## Durability behavior

Command admission, the immutable request/result snapshots, requirement
`sourcing` transition, and requested outbox event commit atomically. Provider
search is read-only and happens outside a database transaction. A successful
worker settlement atomically:

1. fences the exact lease version;
2. marks prior ranked candidates discarded;
3. inserts the new canonical ranked set;
4. settles the requirement and operation; and
5. appends the deterministic completed outbox event.

Existing ranked candidates remain queryable during replacement sourcing.
Retries and dead letters never discard them. Terminal failure restores the
requirement's prior status and emits a deterministic dead-letter event.
