---
"@voyant-travel/trips": major
"@voyant-travel/catalog": minor
"@voyant-travel/accommodations": patch
"@voyant-travel/framework": patch
---

Restore `source_trip_requirement_candidates` as an available handler-owned
existing-target command backed by a Trips-owned durable sourcing operation and
fixed wakeable worker.

The Tool now returns an immutable `{ status: "accepted", operationId,
requirementId, statusTool }` result instead of waiting for provider fan-out and
returning mutable requirement/candidate rows. The read-only
`get_trip_requirement_sourcing_operation` Tool and matching tenant-bound HTTP
route expose pending, retry, completion, and dead-letter outcomes. See
`docs/migrations/durable-trips-requirement-sourcing.md` for rollout and caller
guidance.

The old synchronous `sourceRequirementCandidates`, `reshopRequirement`, and
`reshopTrip` services, Tools, and HTTP routes are removed. They discarded live
candidates before an unfenced provider call and cannot safely coexist with the
durable worker.

Owned availability-search handlers now participate in the same deterministic
fan-out as sourced adapters, including owned-only deployments.
