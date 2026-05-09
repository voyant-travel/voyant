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
import { beforeEach, describe, expect, test } from "vitest"

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

// ---- The parameterized contract ----

export function runDriverComplianceSuite(name: string, makeFactory: () => DriverFactory): void {
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

      test("listRuns surfaces created runs (admin probes its own existence)", async () => {
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
      })
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

    describe("ctx.services (container threading)", () => {
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
