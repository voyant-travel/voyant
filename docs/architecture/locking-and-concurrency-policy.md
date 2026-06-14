# Voyant Locking And Concurrency Policy

This guide defines how Voyant should treat locking, transactions, and
concurrency-sensitive write paths.

It extends:

- [`execution-architecture.md`](./execution-architecture.md)
- [`caching-architecture.md`](./caching-architecture.md)

The goal is narrow:

- keep ordinary write coordination database-first
- make contested write paths reviewable and explicit
- avoid inventing a first-class distributed locking subsystem before real
  runtime pressure exists

Voyant stays transaction-first. This guide is about disciplined concurrency
control, not a portable lock framework.

## Core Rules

### 1. Start with ordinary database transactions

Most multi-step writes in Voyant should begin with a database transaction, not a
lock service.

A transaction is the right default for:

- inserting a parent record plus child records
- applying several updates that must commit together
- recalculating derived row state from the same write path
- state transitions that stay inside one database ownership boundary

Rule:

If one database transaction can express the correctness boundary cleanly, use
that first.

### 2. Use row locks only for truly contested records

A `SELECT ... FOR UPDATE` row lock is appropriate when two concurrent callers
could otherwise allocate or transition the same record incorrectly.

Good candidates:

- decrementing finite availability capacity
- allocating sequential contract or invoice numbers
- confirming or cancelling the same booking from competing requests
- promoting one current version while retiring another in the same scope

Bad candidates:

- every ordinary create/update path
- read paths with no contested write behavior
- speculative locking around records that are not actually shared hot spots

Rule:

Use row locks for contested records, not as a blanket write pattern.

### 3. Keep the lock scope inside the transaction that needs it

If a lock is required, it should normally:

- be acquired in the same database transaction that performs the write
- guard the smallest contested record set possible
- be held only for the duration of the correctness-critical write path

Rule:

Do not acquire a lock in one layer and perform the real write in another later
step.

### 4. Prefer stable invariants over coordination when possible

Some concurrency risks are better solved by database invariants than by locking.

Examples:

- unique constraints for scoped numbering or identifiers
- status guards in `UPDATE ... WHERE ...` clauses
- constrained transitions that reject invalid states

Rule:

If the database can reject the invalid state directly, prefer that over adding a
new lock.

### 5. Keep side effects outside the contested section unless atomicity requires otherwise

The longer a transaction and row lock remain open, the more they increase
contention.

Avoid doing slow work while a contested record is locked, such as:

- remote API calls
- queue or workflow dispatch with network round trips
- rendering or expensive transformations unrelated to the contested row state

Rule:

Keep the contested transaction section small. Hold the lock only around the
state that must be serialized.

### 6. Do not use cache as a lock surface

Voyant cache backends are not a correctness primitive.

That means cache must not become the source of truth for:

- lock ownership
- lease freshness
- daemon leadership
- sequence or counter allocation

Rule:

If stale or lost cache state would create duplicate side effects or corrupted
state, cache is the wrong tool.

### 7. Do not add a distributed lock layer before one concrete use case proves it

A first-class lock subsystem is still deferred until Voyant has a real shared
runtime coordination problem that database transactions cannot express cleanly.

Potential future cases include:

- daemon ownership across processes
- integration pollers that must run singleton-style
- long-running workflow coordination across runtimes

Those are different from ordinary transactional writes in a single database.

Rule:

Do not introduce Postgres/Redis/in-memory lock adapters until one concrete
cross-process use case requires them.

## Review Heuristics

When reviewing a concurrency-sensitive change:

1. Is this just an ordinary multi-step write that belongs in one transaction?
2. What exact record is contested by concurrent callers?
3. Can a database invariant reject the invalid state without a lock?
4. If a lock is needed, is the locked section as small as possible?
5. Is this actually a future daemon/workflow ownership problem rather than a row
   contention problem?

## Query And Write Audit Examples

The purpose of this section is to anchor policy in real Voyant code rather than
in generic concurrency folklore.

### 8. Booking slot capacity: row lock the contested availability slot

Query and write path:

- [`lockAvailabilitySlot(...)`](../../packages/bookings/src/service.ts) uses
  `SELECT ... FOR UPDATE` on one availability slot
- [`adjustSlotCapacity(...)`](../../packages/bookings/src/service.ts) updates
  `remainingPax` and status based on that locked row
- booking reservation and confirmation paths call this logic inside a
  transaction

Policy outcome:

- this is the right use of row locking
- the contested resource is the availability slot itself
- serializing capacity changes on that row is clearer and safer than trying to
  coordinate through cache or a broader lock subsystem

### 9. Booking status transitions: lock the booking row for contested lifecycle changes

Query and write path:

- [`confirmBooking(...)`](../../packages/bookings/src/service.ts) loads the
  booking `FOR UPDATE` before confirming allocations and status changes
- related expiration/cancellation paths use the same pattern for contested
  lifecycle transitions

Policy outcome:

- this is a good example of a row lock protecting a small state machine
- the lock is justified because concurrent callers could otherwise confirm,
  expire, or cancel the same booking inconsistently
- this does **not** justify a framework-wide locking primitive by itself

### 10. Contract and invoice numbering: serialize sequence allocation at the row level

Query and write path:

- [`allocateContractNumber(...)`](../../packages/legal/src/contracts/service-shared.ts)
  locks one `contract_number_series` row `FOR UPDATE` before incrementing the
  sequence
- invoice numbering follows the same pattern in
  [`financeService.allocateInvoiceNumber(...)`](../../packages/finance/src/service.ts)

Policy outcome:

- sequence allocation is a classic row-lock case
- the contested resource is the series row, not the whole module
- this should remain database-first unless numbering ever has to cross
  databases or runtimes

### 11. Quote, booking, and payment bundles: transaction first, no extra lock by default

Query and write path:

- legacy Transactions Offer bundle creation is retired before v1; current
  quote, booking, and trip-composer handoffs should use one database
  transaction for each coherent bundle of related rows
- [`completePaymentSession(...)`](../../packages/finance/src/service.ts) uses a
  transaction to create authorization/capture/payment rows and update invoice
  state together

Policy outcome:

- these are the correct baseline transaction-first cases
- they involve several related writes, but not every step needs an explicit row
  lock
- only add record-level locking if a real contested record proves it is needed

## Practical Checklist

When adding or reviewing concurrency control in Voyant:

1. Start by defining the exact correctness boundary.
2. Use one transaction if the boundary stays inside one database ownership path.
3. Add a row lock only when two callers can contend for the same mutable record.
4. Prefer invariants and guarded updates over coordination when they solve the
   problem honestly.
5. Keep remote side effects and slow work outside the contested section.
6. Escalate to a first-class distributed lock proposal only for proven
   cross-process ownership problems.

## Non-Goals

This guide does not introduce:

- a portable lock adapter across Postgres, Redis, and memory
- cache-backed lock semantics
- universal locking around every workflow, daemon, or service write path

The point is a clean and honest concurrency model, not an early coordination
subsystem.
