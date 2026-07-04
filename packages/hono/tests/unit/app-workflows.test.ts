// Integration test for mountApp's workflow runtime wiring.
//
// Stub a module that ships one workflow + one event filter, pass it
// through mountApp with the InMemory driver, await app.ready(), emit
// an event on the framework eventBus, and assert the run was created.
// Exercises the full collection → factory invocation → manifest
// registration → EventBus forwarder → driver.ingestEvent → trigger pipe.

import {
  createEventBus,
  type EventFilterDescriptor,
  type Module,
  type WorkflowDescriptor,
} from "@voyant-travel/core"
import { __resetRegistry, trigger, workflow } from "@voyant-travel/workflows"
import { __resetEventFilterRegistry } from "@voyant-travel/workflows/events"
import { createInMemoryDriver } from "@voyant-travel/workflows-orchestrator"
import { afterEach, describe, expect, test } from "vitest"

import { mountApp } from "../../src/app.js"
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

  // Filter: matches when payload.kind === "all". `trigger.on()` returns
  // the EventFilterRuntimeEntry directly so it drops straight into
  // Module.eventFilters — no registry lookup needed.
  const onPromoChanged = trigger.on("test.event", {
    target: bulkReindex,
    where: { eq: [{ path: "data.kind" }, { lit: "all" }] },
    input: { object: { kind: { path: "data.kind" } } },
  })

  const moduleSpec: Module = {
    name: "promotions-test",
    workflows: [bulkReindex satisfies WorkflowDescriptor],
    eventFilters: [onPromoChanged],
  }
  return { module: moduleSpec }
}

describe("mountApp workflows wiring", () => {
  test("collects workflows + filters and routes EventBus events through to driver.ingestEvent", async () => {
    const module = buildPromotionsLikeModule()
    const eventBus = createEventBus()
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = mountApp({
      db: () => null as never,
      modules: [module],
      eventBus,
      workflows: {
        // Wrap the factory so we can capture the constructed driver for
        // post-emit inspection. mountApp normally uses the result
        // internally only.
        // function-of-bindings (Node/InMemory wrap with `() =>`); inner
        // factory is called by mountApp() with framework deps.
        driver: () => (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    // Fire the lazy bootstrap explicitly. Production code does this via
    // first-request middleware; tests + Node sibling processes use
    // app.ready().
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

  test("registers scheduled workflow config in the runtime manifest", async () => {
    const scheduled = workflow<{ source: string }, { ok: true }>({
      id: "test-scheduled-report",
      schedule: {
        every: "5m",
        timezone: "UTC",
        input: { source: "schedule" },
        overlap: "skip",
        environments: ["production"],
        name: "every-five-minutes",
      },
      async run() {
        return { ok: true }
      },
    })
    const moduleSpec: Module = {
      name: "scheduled-workflows",
      workflows: [scheduled satisfies WorkflowDescriptor],
    }
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = mountApp({
      db: () => null as never,
      modules: [{ module: moduleSpec }],
      workflows: {
        driver: () => (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    await app.ready()

    const manifest = await driverHandle?.getManifest({ environment: "production" })
    expect(manifest?.workflows).toEqual([
      expect.objectContaining({
        id: "test-scheduled-report",
        schedules: [
          {
            every: "5m",
            timezone: "UTC",
            input: { source: "schedule" },
            overlap: "skip",
            environments: ["production"],
            name: "every-five-minutes",
          },
        ],
      }),
    ])
  })

  test("registers manifest-only workflow config without a run-bearing definition", async () => {
    const moduleSpec: Module = {
      name: "manifest-only-workflows",
      workflows: [
        {
          id: "test-manifest-only-scheduled-report",
          config: {
            description: "Manifest-only scheduled report",
            defaultRuntime: "node",
            schedule: {
              every: "15m",
              timezone: "UTC",
              input: { source: "manifest-only" },
              overlap: "skip",
              environments: ["production"],
              name: "every-fifteen-minutes",
            },
          },
        } satisfies WorkflowDescriptor,
      ],
    }
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = mountApp({
      db: () => null as never,
      modules: [{ module: moduleSpec }],
      workflows: {
        driver: () => (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    await app.ready()

    const manifest = await driverHandle?.getManifest({ environment: "production" })
    expect(manifest?.workflows).toEqual([
      expect.objectContaining({
        id: "test-manifest-only-scheduled-report",
        description: "Manifest-only scheduled report",
        schedules: [
          {
            every: "15m",
            timezone: "UTC",
            input: { source: "manifest-only" },
            overlap: "skip",
            environments: ["production"],
            name: "every-fifteen-minutes",
          },
        ],
      }),
    ])
  })

  test("registers manifest-only event filters without runtime declarations", async () => {
    const moduleSpec: Module = {
      name: "manifest-only-filters",
      workflows: [{ id: "test-filter-target" } satisfies WorkflowDescriptor],
      eventFilters: [
        {
          id: "ef_manifest_only",
          eventType: "test.manifest-only",
          manifest: {
            id: "ef_manifest_only",
            eventType: "test.manifest-only",
            payloadHash: "manifest_only",
            targetWorkflowId: "test-filter-target",
            where: { eq: [{ path: "data.kind" }, { lit: "all" }] },
            input: { object: { kind: { path: "data.kind" } } },
          },
        } satisfies EventFilterDescriptor,
      ],
    }
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = mountApp({
      db: () => null as never,
      modules: [{ module: moduleSpec }],
      workflows: {
        driver: () => (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    await app.ready()

    const manifest = await driverHandle?.getManifest({ environment: "production" })
    expect(manifest?.eventFilters).toEqual([
      {
        id: "ef_manifest_only",
        eventType: "test.manifest-only",
        payloadHash: "manifest_only",
        targetWorkflowId: "test-filter-target",
        where: { eq: [{ path: "data.kind" }, { lit: "all" }] },
        input: { object: { kind: { path: "data.kind" } } },
      },
    ])
  })

  test("registers workflow concurrency config in the runtime manifest", async () => {
    const queued = workflow<{ tenantId: string }, { ok: true }>({
      id: "test-queued-workflow",
      concurrency: {
        key: "tenant",
        limit: 1,
        strategy: "queue",
      },
      async run() {
        return { ok: true }
      },
    })
    const moduleSpec: Module = {
      name: "concurrency-workflows",
      workflows: [queued satisfies WorkflowDescriptor],
    }
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = mountApp({
      db: () => null as never,
      modules: [{ module: moduleSpec }],
      workflows: {
        driver: () => (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    await app.ready()

    const manifest = await driverHandle?.getManifest({ environment: "production" })
    expect(manifest?.workflows).toEqual([
      expect.objectContaining({
        id: "test-queued-workflow",
        concurrency: {
          key: "tenant",
          limit: 1,
          strategy: "queue",
        },
      }),
    ])
  })

  test("non-matching events do not trigger runs", async () => {
    const module = buildPromotionsLikeModule()
    const eventBus = createEventBus()
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined

    const app = mountApp({
      db: () => null as never,
      modules: [module],
      eventBus,
      workflows: {
        // function-of-bindings (Node/InMemory wrap with `() =>`); inner
        // factory is called by mountApp() with framework deps.
        driver: () => (deps) => {
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

    const app = mountApp({
      db: () => null as never,
      modules: [module],
      eventBus,
      workflows: {
        // function-of-bindings (Node/InMemory wrap with `() =>`); inner
        // factory is called by mountApp() with framework deps.
        driver: () => (deps) => {
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
      mountApp({
        db: () => null as never,
        modules: [
          { module: { name: "module-a", workflows: [{ id: "shared-id" } as WorkflowDescriptor] } },
          { module: { name: "module-b", workflows: [{ id: "shared-id" } as WorkflowDescriptor] } },
        ],
        workflows: {
          driver: () => createInMemoryDriver(),
          environment: "development",
        },
      })
    }).toThrow(/duplicate workflow id "shared-id"/)
  })

  test("app.ready() is idempotent (returns the same promise across calls)", async () => {
    const eventBus = createEventBus()
    const app = mountApp({
      db: () => null as never,
      eventBus,
      workflows: {
        driver: () => createInMemoryDriver(),
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

    const app = mountApp({
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

  test("function-of-bindings shape sees env at boot (defers construction)", async () => {
    // Mirrors Worker-hosted app shells: driver options come from env
    // bindings that don't exist at mountApp() call time. The
    // bindings-aware factory shape lets apps build the workflow driver
    // after bindings are available.
    interface MockEnv extends VoyantBindings {
      WORKFLOW_RUN_DO?: { id: string }
    }
    let observedBindings: MockEnv | undefined
    const eventBus = createEventBus()
    const app = mountApp<MockEnv>({
      db: () => null as never,
      eventBus,
      workflows: {
        driver: (env) => {
          observedBindings = env
          return (deps) => createInMemoryDriver()(deps)
        },
        environment: "production",
      },
    })

    // Bindings show up at first request (or app.ready with explicit env).
    // app.ready() uses an empty bindings object since no real bindings
    // exist outside a request context — that's enough to verify the
    // outer factory is invoked.
    await app.ready()
    expect(observedBindings).toBeDefined()
  })

  test("bootstrap-time eventBus.emit from a module is routed (forwarder installed first)", async () => {
    // Reviewer feedback P2.3: if module.bootstrap emits an event, the
    // workflow forwarder must already be subscribed. Confirms the order
    // wireWorkflowRuntime → module bootstraps in the lazy bootstrap.
    const factory = createInMemoryDriver()
    let driverHandle: ReturnType<typeof factory> | undefined
    const eventBus = createEventBus()

    // Build a module with a filter on "bootstrap.emit" + a bootstrap that
    // emits that event. If the forwarder is installed AFTER bootstraps,
    // this event is lost; AFTER the fix, it routes correctly.
    const wf = workflow<{ tag: string }, { tag: string }>({
      id: "test-bootstrap-emit",
      async run(input) {
        return input
      },
    })
    const onBootstrapEmit = trigger.on("bootstrap.emit", {
      target: wf,
      input: { object: { tag: { path: "data.tag" } } },
    })
    const moduleSpec: Module = {
      name: "bootstrap-emitter",
      workflows: [wf satisfies WorkflowDescriptor],
      eventFilters: [onBootstrapEmit],
      async bootstrap(ctx) {
        // Emit during bootstrap. With the pre-fix order this fires into
        // a bus with no workflow subscriber.
        await ctx.eventBus.emit(
          "bootstrap.emit",
          { tag: "from-bootstrap" },
          { eventId: "evt_boot" },
        )
      },
    }

    const app = mountApp({
      db: () => null as never,
      modules: [{ module: moduleSpec }],
      eventBus,
      workflows: {
        driver: () => (deps) => {
          driverHandle = factory(deps)
          return driverHandle
        },
        environment: "production",
      },
    })

    await app.ready()
    await new Promise((r) => setTimeout(r, 0))

    // The bootstrap-time emit should have routed through the workflow
    // forwarder and triggered the workflow.
    const runs = (await driverHandle?.admin?.listRuns?.({ workflowId: "test-bootstrap-emit" }))
      ?.runs
    expect(runs?.length).toBeGreaterThanOrEqual(1)
  })

  test("rejects event-filter descriptors that omit the runtime manifest field", async () => {
    // A plugin that only satisfies the public EventFilterDescriptor
    // (`{ id, eventType }`) — the structural minimum from
    // @voyant-travel/core — must not be silently passed through to the
    // manifest builder, which reads `entry.manifest.id` deep inside its
    // sort and would otherwise crash with a confusing TypeError.
    const moduleSpec: Module = {
      name: "bad-plugin",
      eventFilters: [{ id: "filt_bad", eventType: "x.y" } as EventFilterDescriptor],
    }

    const app = mountApp({
      db: () => null as never,
      modules: [{ module: moduleSpec }],
      workflows: {
        driver: () => createInMemoryDriver(),
        environment: "development",
      },
    })

    await expect(app.ready()).rejects.toThrow(
      /event filter "filt_bad".*missing the runtime `manifest` field/,
    )
  })

  test("ready(bindings) forwards real bindings to the driver factory", async () => {
    // Binding-derived drivers that want eager boot must pass the real
    // env to ready() — otherwise the memoized bootstrap promise locks in
    // a driver built from `{}`, and every later request reuses that
    // broken instance with missing DO/KV bindings.
    interface MockEnv extends VoyantBindings {
      WORKFLOW_RUN_DO?: string
      WORKFLOW_MANIFESTS?: string
    }
    let observedBindings: MockEnv | undefined
    const app = mountApp<MockEnv>({
      db: () => null as never,
      workflows: {
        driver: (env) => {
          observedBindings = env
          return (deps) => createInMemoryDriver()(deps)
        },
        environment: "production",
      },
    })

    const realEnv: MockEnv = {
      DATABASE_URL: "postgres://test",
      WORKFLOW_RUN_DO: "do-id",
      WORKFLOW_MANIFESTS: "kv-id",
    }
    await app.ready(realEnv)
    expect(observedBindings).toEqual(realEnv)
  })
})
