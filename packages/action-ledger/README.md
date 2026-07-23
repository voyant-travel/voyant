# `@voyant-travel/action-ledger`

Append-only action audit records, approval state, delegation provenance, and
idempotency primitives for Voyant control surfaces.

## Agent Tools

The package owns staff-only Tools for filtered audit inspection, exact-target
timelines, entry details, approval inspection, and delegation inspection.
Detail Tools return metadata and storage references; they never dereference
retained payload contents.

Approval requests and decisions use `action-ledger:approve`. A request can name
only an executable Tool action admitted by the selected deployment graph with
`approval: "required"`; action identity, target type, risk, policy, and
capability metadata are derived server-side. Conditional policy evaluation is
not guessed by the Tool and therefore fails closed at request time. Existing
conditional approvals may be decided only while their capability and approval
policy remain selected. Approval also fails for expired requests and requests
assigned to a different principal.

Approval decisions are terminal ledger mutations. They require explicit
confirmation but do not themselves require another approval, which would
create a recursive approval loop. The decision service appends the auditable
approve or reject action in the same transaction.

The package also contributes the transport-neutral `ToolActionPolicyGate` used by graph MCP
dispatch. It resolves the Tool capability back to the exact selected action, rejects missing or
wrong confirmation/target/idempotency/approval metadata, validates approval fingerprints and
principal identity with `validateApprovedAction`, and writes required-ledger preflight and
terminal records around domain dispatch. Conditional policies remain fail-closed because a
generic transport cannot safely invent their domain evaluator.

The generic gate also fails closed for actions declaring `targetLifecycle: "created"`. Their
canonical target does not exist before dispatch, so the caller cannot supply it and the generic
preflight cannot share the domain transaction. A created-target handler must implement the
`handler-command-claim-v1` contract: claim a stable pre-create command identity and fingerprint
before mutation, reject same-key/different-command reuse, replay a typed immutable result
reference, and atomically append the canonical generated-target result. Approval requests for
such actions bind to the declared command target type; the successful generated-target entry is
then linked causally by the handler.

Package handlers implement that contract with `claimCreatedTargetCommand` and
`completeCreatedTargetCommand` from `@voyant-travel/action-ledger/created-command`. Both helpers
must receive the same open transaction handle used for the domain insert:

```ts
const fingerprintInput = {
  commandInput: input,
  policyInputs: {
    approval: "never",
    capabilityId: "relationships:person:create",
    capabilityVersion: "v1",
    evaluatedRisk: "high",
  },
}
const fingerprint = await buildCreatedTargetCommandFingerprint({
  actionName: "relationship.person.create",
  actionVersion: "v1",
  commandTarget: {
    type: "relationship-person-create-command",
    id: commandId,
  },
  canonicalTargetType: "relationship-person",
  resultReferenceType: "relationship-person-ref",
  ...fingerprintInput,
})

await db.transaction(async (tx) => {
  const claimed = await claimCreatedTargetCommand(tx, {
    context,
    actionName: "relationship.person.create",
    commandTarget: {
      type: "relationship-person-create-command",
      id: commandId,
    },
    canonicalTargetType: "relationship-person",
    resultReferenceType: "relationship-person-ref",
    idempotency: {
      scope: `relationships.create_person:${principalId}`,
      key: idempotencyKey,
      fingerprint,
    },
    fingerprintInput,
  })

  if (claimed.replayed) {
    return resolvePerson(claimed.result.reference.id)
  }

  const person = await insertPerson(tx, input)
  await completeCreatedTargetCommand(tx, {
    claim: claimed.claim,
    targetId: person.id,
  })
  return person
})
```

The claim helper holds a Postgres transaction-scoped advisory lock for the idempotency scope and
key, appends the requested command identity before the domain write, and rejects key reuse when
the fingerprint or command identity differs. Exact replay reads the succeeded entry linked to the
claim, validates its canonical target metadata and typed `<reference-type>:<target-id>` result,
then returns only metadata for the owning package to resolve. A committed claim without a result
throws `ActionLedgerCreatedCommandReplayIncompleteError`; malformed or inconsistent result
metadata throws `ActionLedgerCreatedCommandReplayCorruptError`. Neither condition is dispatched
again. Approval-required handlers pass the approved request as the claim's `causationActionId`
and `approvalId`; completion always links the generated-target result to the claim.

`buildCreatedTargetCommandFingerprint` covers the command identity and input,
`canonicalTargetType`, `resultReferenceType`, and the selected risk/capability/approval policy
metadata. `claimCreatedTargetCommand` recomputes that value from `fingerprintInput` and fails
before taking the advisory lock if a caller supplies a partial or mismatched digest. A claim also
requires a concrete user, agent, workflow, API-token, or explicit fallback principal; the helper
never writes created-command records as `unknown_request`.

Booking cancellation and invoice refund keep their existing package-owned two-phase guards: both
fingerprint domain target state and pass approved causation into atomic domain services. Their
Tool definitions explicitly advertise handler-owned enforcement so MCP does not double-gate them.

Reversal execution is intentionally not exposed as a Tool. The package service
can record an outcome after a caller has already executed a reversal, but no
provider-neutral port currently dispatches or verifies the referenced domain
reversal command. Exposing that recorder as “reverse” would report a domain
effect that may never have happened. Add a reversal Tool only after a selected
provider can execute and attest the command before the ledger projection is
updated.

## Downstream delivery

External audit exporters and search projections tail ledger entries with their
own durable `(occurred_at, id)` checkpoints. Work-queue-shaped payload hydration
and redaction use durable events on the framework's generic transactional event
outbox and managed drain job.
