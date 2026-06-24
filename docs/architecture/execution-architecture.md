# Voyant Execution Architecture

This guide defines how Voyant should classify executable backend work.

The goal is simple:

- separate short durable orchestration from long-running background processes
- keep schedules as triggers, not as execution engines
- make runtime portability explicit
- avoid flattening every execution shape into one generic workflow system

Voyant should own the execution model. It does not need to own every runtime
implementation.

For concurrency-sensitive write paths and row-lock usage, see
[`locking-and-concurrency-policy.md`](./locking-and-concurrency-policy.md).

For the boundary between fire-and-forget events and durable background
execution, see
[`event-delivery-and-durable-execution-policy.md`](./event-delivery-and-durable-execution-policy.md).

For deployments where external systems remain sources of truth and Voyant acts
as the operating layer, see
[`federated-operating-mode.md`](./federated-operating-mode.md). That guide
applies the workflow/schedule/daemon distinction to sync, backfill, live
upstream calls, reconciliation, and agent-driven external writes.

## Execution Classes

### 1. Workflows

Workflows are durable orchestrations.

They are a good fit for:

- booking follow-up sequences
- reminder flows
- approval flows
- AI automations
- multi-step business processes with waits, retries, or resumability

Workflows should be:

- step-based
- durable
- retryable
- resumable
- short-to-medium-lived

Rule:

If the job is an orchestrated business flow with explicit steps and lifecycle,
it belongs in a workflow.

### 2. Schedules

Schedules are triggers.

They are a good fit for:

- cron-based reminders
- periodic reconciliation starts
- nightly refresh triggers
- regular workflow or daemon kickoffs

Schedules should not become a parallel business-logic layer.

Rule:

A schedule decides when something starts. It should not own the real execution
logic itself.

### 3. Daemons

Daemons are long-running or continuously running background processes.

They are a good fit for:

- legacy system sync loops
- external connector bridges
- polling integrations
- batch ingestion and long-lived processing
- source-connection backfills, cursor advancement, and reconciliation

Daemons are different from workflows:

- they may run for a long time
- they may maintain connector state
- they are not primarily step orchestration

Rule:

If the job behaves like a long-running process or integration loop, it belongs
in a daemon, not a workflow.

## Runtime Adapters

### 4. Runtime adapters should exist per execution class

Voyant should not force one runtime to host every execution shape.

Instead, each execution class should have runtime adapters.

Examples:

- workflow runtime adapters
- schedule runtime adapters
- daemon runtime adapters

That lets Voyant Cloud and self-hosted deployments make different runtime
choices without changing the execution model.

Rule:

Abstract by execution class, not by vendor.

### 5. Voyant Cloud can split runtimes by workload shape

Voyant Cloud does not need one runtime for everything.

A sensible split is:

- workflows on an edge-friendly durable runtime
- schedules on the control plane that targets workflows or daemons
- daemons on a container or VM-oriented runtime

That matches the workload shape:

- short durable orchestration can be cheaper on edge infrastructure
- long-running daemons fit better on container or VM runtimes

Rule:

Use the runtime that matches the workload shape instead of forcing everything
through one engine.

### 6. Self-hosted deployments should be able to swap runtimes per class

Self-hosted Voyant should not force one orchestration backend if the deployment
environment prefers another.

Examples:

- one deployment may prefer a Trigger-style workflow runtime
- another may prefer Hatchet
- another may prefer a platform-native workflow engine
- daemon execution may still live on plain containers or jobs

Rule:

Runtime portability should exist at the execution-class level, not only at the
full-platform level.

## Portable vs Runtime-Specific

### 7. Portable executables should target the shared contract

An executable is portable when it only depends on the shared Voyant execution
contract for its class.

Portable workflows should avoid depending on one engine’s special features if
those features are not part of the shared contract.

Portable daemons should avoid runtime-specific assumptions unless they are
declared as such.

Rule:

If a task needs to run across multiple runtimes, keep it inside the shared
execution contract for its class.

### 8. Runtime-specific executables are acceptable when declared clearly

Not every executable needs to be portable.

Some tasks will use runtime-specific features because they are valuable enough
to justify the lock-in.

That is acceptable as long as it is explicit.

Examples:

- an edge-specific workflow
- a daemon that depends on container-only libraries or process behavior
- a runtime-specific scheduling capability

Rule:

Runtime-specific execution is fine when it is intentional and declared, not
hidden behind a fake portability layer.

## Placement Rules

### 9. Use workflows for orchestration, not for permanent background loops

A workflow should coordinate a business process.

It should not become:

- a forever-running sync loop
- a long-lived connector process
- a generic worker daemon

Rule:

If the task is a long-running loop, move it to a daemon.

### 10. Use schedules to start work, not to duplicate workflow logic

A schedule should typically:

- start a workflow
- start or poke a daemon
- trigger a reconciliation or refresh pass

It should not reimplement the whole business process inline.

Rule:

Keep schedules thin and orchestration-free.

### 11. Use daemons for integration ownership and long-lived processing

Daemons should own long-lived technical responsibilities:

- polling
- ingestion
- external sync ownership
- connector-specific runtime behavior

They should not become the default place for ordinary business flows that would
be easier to reason about as workflows.

Rule:

Use daemons for long-lived technical execution, not for every background task.

## Practical Checklist

When classifying a new executable:

1. Is it a multi-step business flow with retries and resumability?
   Then it is probably a workflow.
2. Is it only deciding when another executable should start?
   Then it is a schedule.
3. Is it long-running, stateful, or integration-loop oriented?
   Then it is a daemon.
4. Does it depend only on the shared execution contract?
   Then it is portable.
5. Does it depend on one runtime’s special features?
   Then declare it runtime-specific.

## Non-Goals

This guide does not introduce:

- a single universal workflow abstraction for every backend workload
- a requirement that Voyant own the underlying runtime engine
- a rule that every executable must be portable across all runtimes

The point is a clean execution model, not a fake lowest-common-denominator
platform.
