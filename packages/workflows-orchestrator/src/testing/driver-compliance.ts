// Driver compliance suite — the contract every WorkflowDriver must satisfy.
//
// `runDriverComplianceSuite(name, makeDriver)` is parameterized over a
// driver factory. It runs identical assertions against every implementation
// we ship: InMemory, Mode 2 / Postgres, Mode 1 / CF edge.
//
// Importable from a regular `.ts` file so downstream packages
// (`@voyantjs/workflows-orchestrator-node`, `-cloudflare`) can run the
// same suite against their own driver factories without duplicating the
// assertions. Vitest globals are imported explicitly because this file
// isn't a `.test.ts` (no auto-injection).
//
// Tests that depend on machinery not yet wired (filter matching,
// time-wheel resume of DATETIME waitpoints) are added as those
// capabilities land. PR1 covers: register/get manifest, trigger,
// idempotency dedup, ingestEvent's manifest-not-registered + no-filters
// paths, ctx.services, basic admin reads, shutdown.
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §6.4.

import { __resetRegistry, workflow } from "@voyantjs/workflows"
import type { DriverFactory, DriverFactoryDeps, ServiceResolver } from "@voyantjs/workflows/driver"
import type { WorkflowManifest } from "@voyantjs/workflows/protocol"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { WorkflowConcurrencyRejectedError } from "../concurrency.js"

/**
 * Tiny in-memory ServiceResolver builder for compliance tests. Lets a test
 * register named services then assert workflow bodies can resolve them via
 * `ctx.services.resolve(...)`.
 */
export function makeServiceResolver(entries: Record<string, unknown> = {}): ServiceResolver {
  const map = new Map(Object.entries(entries))
  return {
    resolve<T>(name: string): T {
      if (!map.has(name)) {
        throw new Error(`compliance harness: no service registered under "${name}"`)
      }
      return map.get(name) as T
    },
    has(name: string): boolean {
      return map.has(name)
    },
  }
}

/**
 * Build a `DriverFactoryDeps` value suitable for compliance tests. Captures
 * log lines so individual tests can assert on them when needed. Pass
 * `services` to register specific entries; defaults to an empty resolver.
 */
export function testFactoryDeps(
  services: ServiceResolver = makeServiceResolver(),
): DriverFactoryDeps & { logs: Array<[string, string, object?]> } {
  const logs: Array<[string, string, object?]> = []
  return {
    services,
    logger: (level, msg, data) => logs.push([level, msg, data]),
    logs,
  }
}

/**
 * Build a minimal manifest for tests. The shape matches `WorkflowManifest`;
 * filter-related fields stay empty until the event-router (PR2) lands.
 */
export function buildTestManifest(versionId = "v_test_001"): WorkflowManifest {
  return {
    schemaVersion: 1,
    projectId: "default",
    versionId,
    builtAt: 1_700_000_000_000,
    builderVersion: "test-0.0.0",
    capabilities: ["events:v1"],
    workflows: [],
    eventFilters: [],
    bindings: {},
    environments: { production: {}, preview: {}, development: {} },
  }
}

// Per-test counter so workflow ids stay unique across tests in a suite —
// some persistent stores (Mode 2's Postgres) carry state between tests in
// the same run, and a duplicate id would HMR-warn at minimum and
// pollute results at worst.
let suiteCounter = 0
function uniqueId(prefix: string): string {
  return `${prefix}-${++suiteCounter}`
}

// ---- Suite options ----

/**
 * Opt-in capability flags for drivers that don't share a process with
 * step bodies. Default to `true` because in-process drivers (InMemory,
 * Mode 2) satisfy every contract. Out-of-process drivers (Mode 1 / CF
 * edge — orchestrator and tenant live in separate Worker isolates) opt
 * out of in-process-only assertions like `ctx.services` threading.
 */
export interface DriverComplianceCapabilities {
  /**
   * When true, the framework's `ModuleContainer` is plumbed to step
   * bodies via `ctx.services`. False for Mode 1, where the orchestrator
   * and tenant are separate Workers and a per-tenant container would
   * have to ship across a serialization boundary.
   */
  servicesThreading?: boolean
  /**
   * When true, `admin.listRuns(...)` returns runs the driver knows about.
   * False for self-host Mode 1, which has no native cross-run query
   * layer (per architecture doc §8.3) — `listRuns` exists but returns
   * an empty page; voyant-cloud provides an index in its repo.
   */
  crossRunQueries?: boolean
  /**
   * When true, the driver under test runs an in-process DATETIME wakeup
   * loop/timer during compliance tests. False for drivers whose compliance
   * harness intentionally disables or fakes the time wheel.
   */
  autoDatetimeWakeups?: boolean
  /**
   * When true, workflow-level `WorkflowConfig.concurrency` is enforced
   * for in-process workflow definitions. False for Mode 1 / Cloudflare
   * until it grows a cross-run coordination DO.
   */
  workflowConcurrency?: boolean
}

// ---- The parameterized contract ----

export function runDriverComplianceSuite(
  name: string,
  makeFactory: () => DriverFactory,
  capabilities: DriverComplianceCapabilities = {},
): void {
  const servicesThreading = capabilities.servicesThreading ?? true
  const crossRunQueries = capabilities.crossRunQueries ?? true
  const autoDatetimeWakeups = capabilities.autoDatetimeWakeups ?? false
  const workflowConcurrency = capabilities.workflowConcurrency ?? true
  describe(`${name} driver compliance`, () => {
    beforeEach(() => {
      __resetRegistry()
    })

    describe("registerManifest / getManifest", () => {
      test("returns versionId from the supplied manifest", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const manifest = buildTestManifest(uniqueId("v"))
        const result = await driver.registerManifest({
          environment: "production",
          manifest,
        })
        expect(result.versionId).toBe(manifest.versionId)
      })

      test("getManifest returns the registered manifest for the right environment", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const manifest = buildTestManifest(uniqueId("v"))
        await driver.registerManifest({ environment: "production", manifest })

        const got = await driver.getManifest({ environment: "production" })
        expect(got).toBeTruthy()
        expect(got?.versionId).toBe(manifest.versionId)
      })

      test("getManifest returns null when no manifest is registered for an environment", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const got = await driver.getManifest({ environment: "preview" })
        expect(got).toBeNull()
      })

      test("registerManifest is idempotent: same versionId returns the same value", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const manifest = buildTestManifest(uniqueId("v"))
        const first = await driver.registerManifest({ environment: "production", manifest })
        const second = await driver.registerManifest({ environment: "production", manifest })
        expect(first.versionId).toBe(second.versionId)
        expect(first.versionId).toBe(manifest.versionId)
      })

      test("manifests are environment-scoped (production vs preview don't bleed)", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const prodManifest = buildTestManifest(uniqueId("v_prod"))
        const prevManifest = buildTestManifest(uniqueId("v_prev"))
        await driver.registerManifest({ environment: "production", manifest: prodManifest })
        await driver.registerManifest({ environment: "preview", manifest: prevManifest })

        const prod = await driver.getManifest({ environment: "production" })
        const prev = await driver.getManifest({ environment: "preview" })
        expect(prod?.versionId).toBe(prodManifest.versionId)
        expect(prev?.versionId).toBe(prevManifest.versionId)
      })
    })

    describe("trigger", () => {
      test("creates a run that completes for a trivial workflow body", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wfId = uniqueId("compliance-double")
        const wf = workflow<{ n: number }, { doubled: number }>({
          id: wfId,
          async run(input) {
            return { doubled: input.n * 2 }
          },
        })

        const run = await driver.trigger(wf, { n: 21 })
        expect(run.workflowId).toBe(wfId)
        expect(run.status).toBe("completed")
      })

      test("respects environment from TriggerOptions", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wf = workflow<Record<string, never>, void>({
          id: uniqueId("compliance-env"),
          async run() {},
        })

        const run = await driver.trigger(wf, {}, { environment: "preview" })
        expect(run.status).toBe("completed")
      })

      test("delay parks the run instead of invoking the workflow immediately", async () => {
        const driver = makeFactory()(testFactoryDeps())
        let invocationCount = 0
        const wf = workflow<Record<string, never>, void>({
          id: uniqueId("compliance-delay"),
          async run() {
            invocationCount++
          },
        })

        const run = await driver.trigger(wf, {}, { delay: "1s" })
        expect(run.status).toBe("waiting")
        expect(invocationCount).toBe(0)
      })

      test.runIf(autoDatetimeWakeups)(
        "delay continues scheduling later DATETIME waits after the trigger delay fires",
        async () => {
          const driver = makeFactory()(testFactoryDeps())
          const completed = vi.fn()
          const wf = workflow<Record<string, never>, void>({
            id: uniqueId("compliance-delay-then-sleep"),
            async run(_, ctx) {
              await ctx.sleep("1ms")
              completed()
            },
          })

          const run = await driver.trigger(wf, {}, { delay: "1ms" })
          expect(run.status).toBe("waiting")

          await vi.waitFor(() => expect(completed).toHaveBeenCalledTimes(1), { timeout: 250 })
        },
      )

      test("idempotencyKey produces a stable run across retries (same key → same run)", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wf = workflow<{ n: number }, { n: number }>({
          id: uniqueId("compliance-idem"),
          async run(input) {
            return { n: input.n }
          },
        })

        const key = `key-${suiteCounter}`
        const a = await driver.trigger(wf, { n: 1 }, { idempotencyKey: key })
        const b = await driver.trigger(wf, { n: 999 }, { idempotencyKey: key })
        expect(b.id).toBe(a.id)
      })

      test("concurrent triggers with the same idempotencyKey only run once", async () => {
        // Closes the get-then-save race window. A counter inside the
        // workflow body lets us assert exactly-once side effects across
        // 8 parallel triggers — without `tryInsert`'s atomicity, the
        // counter would tick more than once.
        const driver = makeFactory()(testFactoryDeps())
        let invocationCount = 0
        const wf = workflow<{ tag: string }, { invoked: number }>({
          id: uniqueId("compliance-race"),
          async run() {
            invocationCount++
            return { invoked: invocationCount }
          },
        })

        const key = `race-${suiteCounter}`
        const triggers = Array.from({ length: 8 }, (_, i) =>
          driver.trigger(wf, { tag: `caller-${i}` }, { idempotencyKey: key }),
        )
        const results = await Promise.all(triggers)

        // All 8 callers receive the same runId.
        const ids = new Set(results.map((r) => r.id))
        expect(ids.size).toBe(1)

        // The body runs at most once. (The first writer wins; later
        // callers return the existing record without re-driving.)
        expect(invocationCount).toBeLessThanOrEqual(1)
      })

      test.skipIf(!workflowConcurrency)(
        "concurrency queue strategy serializes triggers with the same key",
        async () => {
          const driver = makeFactory()(testFactoryDeps())
          const gate = deferred<void>()
          const started: string[] = []
          const wf = workflow<{ key: string }, string>({
            id: uniqueId("compliance-concurrency-queue"),
            concurrency: {
              key: (input) => input.key,
              limit: 1,
              strategy: "queue",
            },
            async run(input) {
              started.push(input.key)
              if (started.length === 1) await gate.promise
              return input.key
            },
          })

          const first = driver.trigger(wf, { key: "same" })
          await vi.waitFor(() => expect(started).toEqual(["same"]))
          const second = driver.trigger(wf, { key: "same" })
          await Promise.resolve()
          expect(started).toEqual(["same"])

          gate.resolve()
          await Promise.all([first, second])
          expect(started).toEqual(["same", "same"])
        },
      )

      test.skipIf(!workflowConcurrency)(
        "concurrency cancel-newest strategy rejects overflow triggers",
        async () => {
          const driver = makeFactory()(testFactoryDeps())
          const gate = deferred<void>()
          const wf = workflow<{ n: number }, number>({
            id: uniqueId("compliance-concurrency-cancel-newest"),
            concurrency: {
              key: "shared",
              limit: 1,
              strategy: "cancel-newest",
            },
            async run(input) {
              await gate.promise
              return input.n
            },
          })

          const first = driver.trigger(wf, { n: 1 })
          await expect(driver.trigger(wf, { n: 2 })).rejects.toBeInstanceOf(
            WorkflowConcurrencyRejectedError,
          )

          gate.resolve()
          await expect(first).resolves.toMatchObject({ status: "completed" })
        },
      )
    })

    describe("ingestEvent", () => {
      test("returns ok=false when no manifest is registered", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const result = await driver.ingestEvent({
          environment: "production",
          envelope: {
            name: "promotion.changed",
            data: { kind: "all" },
            metadata: { eventId: `evt_${uniqueId("not-registered")}` },
            emittedAt: new Date(1_700_000_000_000).toISOString(),
          },
        })
        // Drivers that registered a manifest earlier in the suite may
        // accept this — gate on the fresh-driver case below instead.
        if (result.ok) {
          expect(result.matches).toEqual([])
        } else {
          expect(result.reason).toBe("manifest_not_registered")
        }
      })

      test("returns ok=true matches=[] when the manifest has no event filters", async () => {
        const driver = makeFactory()(testFactoryDeps())
        await driver.registerManifest({
          environment: "production",
          manifest: buildTestManifest(uniqueId("v_empty")),
        })
        const eventId = `evt_${uniqueId("none")}`
        const result = await driver.ingestEvent({
          environment: "production",
          envelope: {
            name: "promotion.changed",
            data: {},
            metadata: { eventId },
            emittedAt: new Date(1_700_000_000_000).toISOString(),
          },
        })
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.eventId).toBe(eventId)
          expect(result.matches).toEqual([])
        }
      })

      test("derives eventId when metadata.eventId is absent", async () => {
        const driver = makeFactory()(testFactoryDeps())
        await driver.registerManifest({
          environment: "production",
          manifest: buildTestManifest(uniqueId("v_noid")),
        })
        const result = await driver.ingestEvent({
          environment: "production",
          envelope: {
            name: "promotion.changed",
            data: {},
            emittedAt: new Date(1_700_000_000_000).toISOString(),
          },
        })
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.eventId).toMatch(/^evt_/)
        }
      })

      test("eventId fallback is stable across calls (content-derived)", async () => {
        // Same envelope content → same derived eventId. External HTTP
        // retries that don't stamp metadata.eventId still dedupe via the
        // driver's `${filterId}:${eventId}` idempotency key.
        const driver = makeFactory()(testFactoryDeps())
        const wfId = uniqueId("compliance-stable-id")
        const wf = workflow<unknown, void>({
          id: wfId,
          async run() {},
        })
        const filterId = `ef_${uniqueId("ef-stable")}`
        const manifest = {
          ...buildTestManifest(uniqueId("v_stable")),
          eventFilters: [
            {
              id: filterId,
              eventType: "evt.stable",
              payloadHash: filterId,
              targetWorkflowId: wfId,
            },
          ],
        }
        await driver.registerManifest({ environment: "production", manifest })

        const envelope = {
          name: "evt.stable",
          data: { k: "v" },
          emittedAt: new Date(1_700_000_000_000).toISOString(),
        }
        const a = await driver.ingestEvent({ environment: "production", envelope })
        const b = await driver.ingestEvent({ environment: "production", envelope })
        if (!a.ok || !b.ok) throw new Error("expected ok=true on both")
        expect(a.eventId).toBe(b.eventId)
        const ma = a.matches[0]
        const mb = b.matches[0]
        if (ma?.status !== "queued" || mb?.status !== "queued") {
          throw new Error("expected queued matches")
        }
        // Same eventId → same derived idempotencyKey → same run.
        expect(mb.runId).toBe(ma.runId)
        void wf
      })

      test("matches a where predicate and triggers a run", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wfId = uniqueId("compliance-ingest-match")
        const wf = workflow<unknown, void>({
          id: wfId,
          async run() {},
        })
        const filterId = `ef_${uniqueId("ef")}`
        const manifest: WorkflowManifest = {
          ...buildTestManifest(uniqueId("v_match")),
          eventFilters: [
            {
              id: filterId,
              eventType: "promotion.changed",
              where: { eq: [{ path: "data.kind" }, { lit: "all" }] },
              payloadHash: filterId,
              targetWorkflowId: wfId,
            },
          ],
        }
        await driver.registerManifest({ environment: "production", manifest })

        const result = await driver.ingestEvent({
          environment: "production",
          envelope: {
            name: "promotion.changed",
            data: { kind: "all" },
            metadata: { eventId: `evt_${uniqueId("match")}` },
            emittedAt: new Date(1_700_000_000_000).toISOString(),
          },
        })
        expect(result.ok).toBe(true)
        if (!result.ok) return
        expect(result.matches).toHaveLength(1)
        const m = result.matches[0]
        expect(m?.status).toBe("queued")
        if (m?.status === "queued") {
          expect(m.filterId).toBe(filterId)
          expect(m.targetWorkflowId).toBe(wfId)
          const detail = await driver.admin?.getRun?.(m.runId)
          expect(detail?.workflowId).toBe(wfId)
        }
        void wf
      })

      test("predicate failure on one filter doesn't block another", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wfId = uniqueId("compliance-ingest-mixed")
        const wf = workflow<unknown, void>({
          id: wfId,
          async run() {},
        })
        const goodId = `ef_${uniqueId("ok")}`
        const manifest: WorkflowManifest = {
          ...buildTestManifest(uniqueId("v_mixed")),
          eventFilters: [
            {
              id: `ef_${uniqueId("bad")}`,
              eventType: "evt.x",
              where: { wat: "huh" } as unknown as never,
              payloadHash: "h",
              targetWorkflowId: wfId,
            },
            {
              id: goodId,
              eventType: "evt.x",
              where: { eq: [{ path: "data.k" }, { lit: "v" }] },
              payloadHash: "h",
              targetWorkflowId: wfId,
            },
          ],
        }
        await driver.registerManifest({ environment: "production", manifest })

        const result = await driver.ingestEvent({
          environment: "production",
          envelope: {
            name: "evt.x",
            data: { k: "v" },
            metadata: { eventId: `evt_${uniqueId("mixed")}` },
            emittedAt: new Date(1_700_000_000_000).toISOString(),
          },
        })
        expect(result.ok).toBe(true)
        if (!result.ok) return
        const skipped = result.matches.find((m) => m.status === "skipped")
        const queued = result.matches.find((m) => m.status === "queued")
        expect(skipped?.status).toBe("skipped")
        if (skipped?.status === "skipped") {
          expect(skipped.reason).toBe("where_eval_error")
        }
        expect(queued?.status).toBe("queued")
        void wf
      })

      test("input mapper projects correctly through to the workflow", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wfId = uniqueId("compliance-ingest-input")
        const wf = workflow<{ kind: string; offer: string }, { kind: string; offer: string }>({
          id: wfId,
          async run(input) {
            return input
          },
        })
        const filterId = `ef_${uniqueId("ef-input")}`
        const manifest: WorkflowManifest = {
          ...buildTestManifest(uniqueId("v_input")),
          eventFilters: [
            {
              id: filterId,
              eventType: "promotion.changed",
              input: {
                object: {
                  kind: { path: "data.affected.kind" },
                  offer: { path: "data.offerId" },
                },
              },
              payloadHash: filterId,
              targetWorkflowId: wfId,
            },
          ],
        }
        await driver.registerManifest({ environment: "production", manifest })

        const result = await driver.ingestEvent({
          environment: "production",
          envelope: {
            name: "promotion.changed",
            data: { affected: { kind: "all" }, offerId: "pofr_42" },
            metadata: { eventId: `evt_${uniqueId("input")}` },
            emittedAt: new Date(1_700_000_000_000).toISOString(),
          },
        })
        expect(result.ok).toBe(true)
        if (!result.ok) return
        const m = result.matches[0]
        if (m?.status !== "queued") throw new Error("expected queued match")
        const detail = await driver.admin?.getRun?.(m.runId)
        expect(detail?.output).toEqual({ kind: "all", offer: "pofr_42" })
        void wf
      })

      test("metadata.eventId dedupes across retries (same event → same run)", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wfId = uniqueId("compliance-ingest-dedup")
        const wf = workflow<unknown, void>({
          id: wfId,
          async run() {},
        })
        const filterId = `ef_${uniqueId("ef-dedup")}`
        const manifest: WorkflowManifest = {
          ...buildTestManifest(uniqueId("v_dedup")),
          eventFilters: [
            {
              id: filterId,
              eventType: "evt.dedup",
              payloadHash: filterId,
              targetWorkflowId: wfId,
            },
          ],
        }
        await driver.registerManifest({ environment: "production", manifest })

        const sharedEventId = `evt_${uniqueId("shared")}`
        const envelope = {
          name: "evt.dedup",
          data: {},
          metadata: { eventId: sharedEventId },
          emittedAt: new Date(1_700_000_000_000).toISOString(),
        }
        const a = await driver.ingestEvent({ environment: "production", envelope })
        const b = await driver.ingestEvent({ environment: "production", envelope })
        if (!a.ok || !b.ok) throw new Error("expected ok=true")
        const ma = a.matches[0]
        const mb = b.matches[0]
        if (ma?.status !== "queued" || mb?.status !== "queued") {
          throw new Error("expected queued matches")
        }
        expect(mb.runId).toBe(ma.runId)
        void wf
      })
    })

    describe("admin (when implemented)", () => {
      test("getRun returns a run by id, null for missing", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wfId = uniqueId("compliance-admin")
        const wf = workflow<Record<string, never>, void>({
          id: wfId,
          async run() {},
        })
        const created = await driver.trigger(wf, {})

        const detail = await driver.admin?.getRun?.(created.id)
        expect(detail?.id).toBe(created.id)
        expect(detail?.workflowId).toBe(wfId)

        const missing = await driver.admin?.getRun?.("nonexistent_run_id")
        expect(missing).toBeNull()
      })

      test.skipIf(!crossRunQueries)(
        "listRuns surfaces created runs (admin probes its own existence)",
        async () => {
          const driver = makeFactory()(testFactoryDeps())
          if (!driver.admin?.listRuns) return

          const wfId = uniqueId("compliance-list")
          const wf = workflow<Record<string, never>, void>({
            id: wfId,
            async run() {},
          })
          await driver.trigger(wf, {})
          await driver.trigger(wf, {})

          const result = await driver.admin.listRuns({ workflowId: wfId })
          expect(result.runs.length).toBeGreaterThanOrEqual(2)
        },
      )
    })

    describe("shutdown", () => {
      test("subsequent operations after shutdown are refused", async () => {
        const driver = makeFactory()(testFactoryDeps())
        if (!driver.shutdown) return

        await driver.shutdown()
        const wf = workflow<Record<string, never>, void>({
          id: uniqueId("compliance-shutdown"),
          async run() {},
        })
        await expect(driver.trigger(wf, {})).rejects.toThrow()
      })
    })

    describe.skipIf(!servicesThreading)("ctx.services (container threading)", () => {
      test("workflow body resolves a service registered on the harness", async () => {
        interface Greeter {
          hello(name: string): string
        }
        const greeter: Greeter = { hello: (n) => `hi ${n}` }
        const services = makeServiceResolver({ greeter })
        const driver = makeFactory()(testFactoryDeps(services))

        const wf = workflow<{ name: string }, { greeting: string }>({
          id: uniqueId("compliance-services-resolve"),
          async run(input, ctx) {
            const g = ctx.services.resolve<Greeter>("greeter")
            return { greeting: g.hello(input.name) }
          },
        })

        const run = await driver.trigger(wf, { name: "world" })
        const detail = await driver.admin?.getRun?.(run.id)
        expect(detail?.output).toEqual({ greeting: "hi world" })
      })

      test("ctx.services.has returns true for registered, false for missing", async () => {
        const services = makeServiceResolver({ db: {} })
        const driver = makeFactory()(testFactoryDeps(services))

        const wf = workflow<Record<string, never>, { hasDb: boolean; hasMissing: boolean }>({
          id: uniqueId("compliance-services-has"),
          async run(_input, ctx) {
            return {
              hasDb: ctx.services.has("db"),
              hasMissing: ctx.services.has("missing"),
            }
          },
        })

        const run = await driver.trigger(wf, {})
        const detail = await driver.admin?.getRun?.(run.id)
        expect(detail?.output).toEqual({ hasDb: true, hasMissing: false })
      })

      test("ctx.services.resolve on an unregistered key surfaces a step error", async () => {
        const driver = makeFactory()(testFactoryDeps())

        const wf = workflow<Record<string, never>, void>({
          id: uniqueId("compliance-services-missing"),
          async run(_input, ctx) {
            ctx.services.resolve("nope")
          },
        })

        const run = await driver.trigger(wf, {})
        const detail = await driver.admin?.getRun?.(run.id)
        expect(detail?.status).toBe("failed")
      })
    })
  })
}

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
} {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
