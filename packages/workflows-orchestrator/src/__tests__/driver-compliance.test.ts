// Driver compliance suite — the contract every WorkflowDriver must satisfy.
//
// `runDriverComplianceSuite(name, makeDriver)` is parameterized over a
// driver factory. It runs identical assertions against every implementation
// we ship: InMemory (here), Mode 2 / Postgres (added in PR1's later step),
// Mode 1 / CF edge (added in PR3).
//
// Tests that depend on machinery not yet wired (filter matching, idempotency
// enforcement on TriggerArgs, time-wheel resume of DATETIME waitpoints in
// concrete drivers) are added as those steps land. PR1 step 2 covers the
// minimum viable surface: register/get manifest, trigger, ingestEvent's
// no-matches and manifest-not-registered paths, basic admin reads.
//
// Architecture: docs/architecture/workflows-runtime-architecture.md §6.4.

import { __resetRegistry, workflow } from "@voyantjs/workflows"
import type { DriverFactory, DriverFactoryDeps } from "@voyantjs/workflows/driver"
import type { WorkflowManifest } from "@voyantjs/workflows/protocol"
import { beforeEach, describe, expect, test } from "vitest"

import { createInMemoryDriver } from "../driver-inmemory.js"

/**
 * Build a `DriverFactoryDeps` value suitable for compliance tests. Captures
 * log lines so individual tests can assert on them when needed.
 */
function testFactoryDeps(): DriverFactoryDeps & { logs: Array<[string, string, object?]> } {
  const logs: Array<[string, string, object?]> = []
  return {
    services: {
      resolve<T>(name: string): T {
        throw new Error(`compliance harness: no service registered under "${name}"`)
      },
      has() {
        return false
      },
    },
    logger: (level, msg, data) => logs.push([level, msg, data]),
    logs,
  }
}

/**
 * Build a minimal manifest for tests. The shape matches `WorkflowManifest`;
 * filter-related fields stay empty until the event-router (PR2) lands.
 */
function buildTestManifest(versionId = "v_test_001"): WorkflowManifest {
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

// ---- The parameterized contract ----

export function runDriverComplianceSuite(name: string, makeFactory: () => DriverFactory): void {
  describe(`${name} driver compliance`, () => {
    beforeEach(() => {
      __resetRegistry()
    })

    describe("registerManifest / getManifest", () => {
      test("returns versionId from the supplied manifest", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const manifest = buildTestManifest("v_a")
        const result = await driver.registerManifest({
          environment: "production",
          manifest,
        })
        expect(result.versionId).toBe("v_a")
      })

      test("getManifest returns the registered manifest for the right environment", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const manifest = buildTestManifest("v_b")
        await driver.registerManifest({ environment: "production", manifest })

        const got = await driver.getManifest({ environment: "production" })
        expect(got).toEqual(manifest)
      })

      test("getManifest returns null when no manifest is registered for an environment", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const got = await driver.getManifest({ environment: "preview" })
        expect(got).toBeNull()
      })

      test("registerManifest is idempotent: same versionId returns the same value", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const manifest = buildTestManifest("v_c")
        const first = await driver.registerManifest({ environment: "production", manifest })
        const second = await driver.registerManifest({ environment: "production", manifest })
        expect(first.versionId).toBe(second.versionId)
        expect(first.versionId).toBe("v_c")
      })

      test("manifests are environment-scoped (production vs preview don't bleed)", async () => {
        const driver = makeFactory()(testFactoryDeps())
        await driver.registerManifest({
          environment: "production",
          manifest: buildTestManifest("v_prod"),
        })
        await driver.registerManifest({
          environment: "preview",
          manifest: buildTestManifest("v_prev"),
        })

        const prod = await driver.getManifest({ environment: "production" })
        const prev = await driver.getManifest({ environment: "preview" })
        expect(prod?.versionId).toBe("v_prod")
        expect(prev?.versionId).toBe("v_prev")
      })
    })

    describe("trigger", () => {
      test("creates a run that completes for a trivial workflow body", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wf = workflow<{ n: number }, { doubled: number }>({
          id: "compliance-double",
          async run(input) {
            return { doubled: input.n * 2 }
          },
        })

        const run = await driver.trigger(wf, { n: 21 })
        expect(run.workflowId).toBe("compliance-double")
        // The driver returns Run<TOut> with the public status; the in-memory
        // driver runs synchronously to completion.
        expect(run.status).toBe("completed")
      })

      test("respects environment from TriggerOptions", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wf = workflow<{}, void>({
          id: "compliance-env",
          async run() {},
        })

        const run = await driver.trigger(wf, {}, { environment: "preview" })
        expect(run.status).toBe("completed")
        // Detail-level env assertion belongs to admin tests below.
      })

      test("idempotencyKey produces a stable run across retries (same key → same run)", async () => {
        const driver = makeFactory()(testFactoryDeps())
        const wf = workflow<{ n: number }, { n: number }>({
          id: "compliance-idem",
          async run(input) {
            return { n: input.n }
          },
        })

        const a = await driver.trigger(wf, { n: 1 }, { idempotencyKey: "key-1" })
        const b = await driver.trigger(wf, { n: 999 }, { idempotencyKey: "key-1" })
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
            metadata: { eventId: "evt_test_1" },
            emittedAt: new Date(1_700_000_000_000).toISOString(),
          },
        })
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.reason).toBe("manifest_not_registered")
        }
      })

      test("returns ok=true matches=[] when the manifest has no event filters", async () => {
        const driver = makeFactory()(testFactoryDeps())
        await driver.registerManifest({
          environment: "production",
          manifest: buildTestManifest("v_empty"),
        })
        const result = await driver.ingestEvent({
          environment: "production",
          envelope: {
            name: "promotion.changed",
            data: {},
            metadata: { eventId: "evt_test_2" },
            emittedAt: new Date(1_700_000_000_000).toISOString(),
          },
        })
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.eventId).toBe("evt_test_2")
          expect(result.matches).toEqual([])
        }
      })

      test("derives eventId when metadata.eventId is absent", async () => {
        const driver = makeFactory()(testFactoryDeps())
        await driver.registerManifest({
          environment: "production",
          manifest: buildTestManifest("v_noid"),
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
        const wf = workflow<{}, void>({
          id: "compliance-admin",
          async run() {},
        })
        const created = await driver.trigger(wf, {})

        const detail = await driver.admin?.getRun?.(created.id)
        expect(detail?.id).toBe(created.id)
        expect(detail?.workflowId).toBe("compliance-admin")

        const missing = await driver.admin?.getRun?.("nonexistent_run_id")
        expect(missing).toBeNull()
      })

      test("listRuns surfaces created runs (admin probes its own existence)", async () => {
        const driver = makeFactory()(testFactoryDeps())
        if (!driver.admin?.listRuns) return // partial admin: skip

        const wf = workflow<{}, void>({
          id: "compliance-list",
          async run() {},
        })
        await driver.trigger(wf, {})
        await driver.trigger(wf, {})

        const result = await driver.admin.listRuns({ workflowId: "compliance-list" })
        expect(result.runs.length).toBeGreaterThanOrEqual(2)
      })
    })

    describe("shutdown", () => {
      test("subsequent operations after shutdown are refused", async () => {
        const driver = makeFactory()(testFactoryDeps())
        if (!driver.shutdown) return

        await driver.shutdown()
        const wf = workflow<{}, void>({
          id: "compliance-shutdown",
          async run() {},
        })
        await expect(driver.trigger(wf, {})).rejects.toThrow()
      })
    })
  })
}

// ---- Run the suite against every driver shipped in this package ----

runDriverComplianceSuite("InMemory", () => createInMemoryDriver())
