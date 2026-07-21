# Voyant Execution Architecture

Voyant has three product execution shapes: commands, subscribers, and jobs.
The resolved deployment graph selects all three with their owning package.
Voyant does not provide a general-purpose workflow runtime.

## Commands

Commands are explicit, authenticated user or API actions. They validate input,
call a domain service, and return a domain result. Public commands are
versioned and should be idempotent whenever callers may retry them.

Scripts are development, migration, or operational tools run by a developer or
operator. They are not selected product behavior.

## Subscribers

Subscribers react to domain events. They may perform bounded inline work or
record durable intent for a job. A subscriber must not hide an unbounded HTTP
operation, retry loop, or process-resident queue inside event delivery.

When delivery must survive process failure, the durable authority belongs to
the owning domain: an outbox row, delivery intent, reminder record, checkpoint,
or equivalent state. Waking a job improves latency; a recovery sweep prevents a
lost wakeup from losing work.

## Jobs

Jobs are package-owned background work required by a selected product
capability. They may be scheduled, wakeable, or both. Selecting a module or
plugin selects its jobs; applications do not contribute arbitrary handlers or
schedules through `voyant.config.ts` or a `src/jobs` convention.

The job host provides authenticated invocation, scheduling, bounded retry,
concurrency control, health, and missed-tick recovery. It does not persist
generic step graphs, arbitrary payloads, sleeps, child executions, replay
controls, or customer-authored bundles.

Job implementations must be idempotent and claim domain-owned durable work.
Host memory is coordination state, never the source of truth.

## External automation

Customer-specific orchestration runs outside Voyant. External systems consume
versioned events or signed webhooks and call authenticated domain commands.
They own their schedules, waits, retries, dead-letter policy, secrets, run
history, and user interface.

See [Retire Voyant Workflows As A Product Capability](./workflow-product-removal-rfc.md)
for the removal decision, job-host limits, and migration inventory.
