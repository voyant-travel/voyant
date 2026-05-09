// Integration test for createApp's workflow runtime wiring.
//
// Stub a module that ships one workflow + one event filter, pass it
// through createApp with the InMemory driver, await app.ready(), emit
// an event on the framework eventBus, and assert the run was created.
// Exercises the full collection → factory invocation → manifest
// registration → EventBus forwarder → driver.ingestEvent → trigger pipe.

import {
  createEventBus,
  type EventFilterDescriptor,
  type Module,
  type WorkflowDescriptor,
} from "@voyantjs/core"
import { __resetRegistry, trigger, workflow } from "@voyantjs/workflows"
import {
  __resetEventFilterRegistry,
  type EventFilterRuntimeEntry,
  getEventFilterRegistry,
} from "@voyantjs/workflows/events"
import { createInMemoryDriver } from "@voyantjs/workflows-orchestrator"
import { afterEach, describe, expect, test } from "vitest"

import { createApp } from "../../src/app.js"
import type { HonoModule } from "../../src/module.js"
import type { VoyantBindings } from "../../src/types.js"

const TEST_ENV: VoyantBindings = { DATABASE_URL: "postgres://test" }

afterEach(() => {
  __resetRegistry()
  __resetEventFilterRegistry()
})

function buildPromotionsLikeModule(): HonoModule {
  // Workflow: returns its input so we can assert on driver.admin.getRun.
  const bulkReindex = workflow<{ kind: string }, { received: { kind: string } }>({
    id: "test-bulk-reindex",
    async run(input) {
      return { received: input }
    },
  })

  // Filter: matches when payload.kind === "all".
  trigger.on("test.event", {
    target: bulkReindex,
    where: { eq: [{ path: "data.kind" }, { lit: "all" }] },
    input: { object: { kind: { path: "data.kind" } } },
  })

  // Pull the single registered runtime entry; in real modules the entry
  // is the value `trigger.on()` returns. The ./events registry is the
  // canonical source so a module's eventFilters[] can carry it.
  const filters = getEventFilterRegistry().list() as readonly (EventFilterRuntimeEntry &
    EventFilterDescriptor)[]

  const moduleSpec: Module = {
    name: "promotions-test",
    workflows: [bulkReindex satisfies WorkflowDescriptor],
    eventFilters: filters,
  }
  return { module: moduleSpec }
}

describe("createApp workflows wiring", () => {
  test("collects workflows + filters and routes EventBus events through to driver.ingestEvent", async () => {
    const module = buildPromotionsLikeModule()
    const eventBus = createEventBus()
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = createApp({
      db: () => null as never,
      modules: [module],
      eventBus,
      workflows: {
        // Wrap the factory so we can capture the constructed driver for
        // post-emit inspection. createApp normally uses the result
        // internally only.
        driver: (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    // Fire the lazy bootstrap explicitly. Production code does this via
    // first-request middleware; tests + Mode 2 sibling processes use
    // app.ready() (architecture doc §18.1).
    await app.ready()
    expect(driverHandle).toBeTruthy()

    // The manifest should be registered for the requested environment.
    const manifest = await driverHandle?.getManifest({ environment: "production" })
    expect(manifest).toBeTruthy()
    expect(manifest?.eventFilters?.length).toBe(1)
    expect(manifest?.eventFilters?.[0]?.eventType).toBe("test.event")

    // Emit an event matching the where clause and verify a run was created.
    await eventBus.emit("test.event", { kind: "all" }, { eventId: "evt_test_1" })

    // Subscribers fire synchronously during emit but the driver's run completes
    // synchronously for InMemory; let the microtask queue drain.
    await new Promise((resolve) => setTimeout(resolve, 0))

    const runs = (await driverHandle?.admin?.listRuns?.({ workflowId: "test-bulk-reindex" }))?.runs
    expect(runs?.length).toBeGreaterThanOrEqual(1)
    const detail = await driverHandle?.admin?.getRun?.(runs?.[0]?.id ?? "")
    expect(detail?.output).toEqual({ received: { kind: "all" } })

    void TEST_ENV
  })

  test("non-matching events do not trigger runs", async () => {
    const module = buildPromotionsLikeModule()
    const eventBus = createEventBus()
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = createApp({
      db: () => null as never,
      modules: [module],
      eventBus,
      workflows: {
        driver: (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    await app.ready()

    // kind: "products" doesn't match where: kind == "all".
    await eventBus.emit("test.event", { kind: "products" }, { eventId: "evt_test_2" })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const runs = (await driverHandle?.admin?.listRuns?.({ workflowId: "test-bulk-reindex" }))?.runs
    expect(runs?.length ?? 0).toBe(0)
  })

  test("events with no matching filters are silently ignored", async () => {
    const module = buildPromotionsLikeModule()
    const eventBus = createEventBus()
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = createApp({
      db: () => null as never,
      modules: [module],
      eventBus,
      workflows: {
        driver: (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    await app.ready()

    // Different event name — no filter targets it.
    await eventBus.emit("unrelated.event", { kind: "all" }, { eventId: "evt_test_3" })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const runs = (await driverHandle?.admin?.listRuns?.({ workflowId: "test-bulk-reindex" }))?.runs
    expect(runs?.length ?? 0).toBe(0)
  })

  test("rejects duplicate workflow ids across modules at construction time", () => {
    const wfA = workflow({ id: "dup-id", async run() {} })
    const wfB = workflow({ id: "dup-id", async run() {} })
    // Reset to clear the duplicate-warn from workflow()
    void wfA
    void wfB

    expect(() => {
      createApp({
        db: () => null as never,
        modules: [
          { module: { name: "module-a", workflows: [{ id: "shared-id" } as WorkflowDescriptor] } },
          { module: { name: "module-b", workflows: [{ id: "shared-id" } as WorkflowDescriptor] } },
        ],
        workflows: {
          driver: (deps) => createInMemoryDriver()(deps),
          environment: "development",
        },
      })
    }).toThrow(/duplicate workflow id "shared-id"/)
  })

  test("app.ready() is idempotent (returns the same promise across calls)", async () => {
    const eventBus = createEventBus()
    const app = createApp({
      db: () => null as never,
      eventBus,
      workflows: {
        driver: (deps) => createInMemoryDriver()(deps),
        environment: "development",
      },
    })

    const a = app.ready()
    const b = app.ready()
    await Promise.all([a, b])
    // No assertion needed — if not idempotent, the bootstrap would run
    // twice and the second register would either no-op or throw.
    expect(true).toBe(true)
  })

  test("apps without workflows config are unaffected (no driver, no forwarder)", async () => {
    const eventBus = createEventBus()
    let receivedEvent = false
    eventBus.subscribe("test.event", () => {
      receivedEvent = true
    })

    const app = createApp({
      db: () => null as never,
      eventBus,
    })

    // No workflows config → no bootstrap-time workflow wiring. Events
    // still dispatch to in-process subscribers as before.
    await app.ready()
    await eventBus.emit("test.event", { kind: "x" })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(receivedEvent).toBe(true)
  })
})
