import { __resetRegistry, workflow } from "@voyantjs/workflows"
import {
  createInMemoryKv,
  createKvManifestStore,
} from "@voyantjs/workflows-orchestrator-cloudflare"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { publishManifest, scheduleAutoPublishManifest } from "../auto-publish.js"

beforeEach(() => {
  __resetRegistry()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function registerWorkflows(): void {
  workflow({ id: "bookings.expire-stale-holds", schedule: { cron: "*/5 * * * *" }, async run() {} })
  workflow({
    id: "notifications.send-due-reminders",
    schedule: { cron: "0 * * * *" },
    async run() {},
  })
  workflow({ id: "checkout.finalize", async run() {} })
}

describe("publishManifest", () => {
  it("returns null when the registry is empty", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    const result = await publishManifest({ manifestStore: store, environment: "production" })
    expect(result).toBeNull()
    expect(await store.getCurrent("production")).toBeNull()
  })

  it("writes a content-addressed manifest when KV has no envelope", async () => {
    registerWorkflows()
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    const result = await publishManifest({ manifestStore: store, environment: "production" })
    expect(result).not.toBeNull()
    expect(result?.versionId).toMatch(/^[a-f0-9]+$/)
    const current = await store.getCurrent("production")
    expect(current?.versionId).toBe(result?.versionId)
    expect(
      (current?.manifest as { workflows: Array<{ id: string }> }).workflows.map((w) => w.id),
    ).toEqual([
      "bookings.expire-stale-holds",
      "checkout.finalize",
      "notifications.send-due-reminders",
    ])
  })

  it("is idempotent — second publish with matching versionId is a no-op", async () => {
    registerWorkflows()
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    const registerSpy = vi.spyOn(store, "registerManifest")

    const first = await publishManifest({ manifestStore: store, environment: "production" })
    const second = await publishManifest({ manifestStore: store, environment: "production" })

    expect(first?.versionId).toBeTruthy()
    expect(second).toBeNull()
    expect(registerSpy).toHaveBeenCalledTimes(1)
  })

  it("re-publishes when the in-process registry's versionId changes", async () => {
    registerWorkflows()
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    const first = await publishManifest({ manifestStore: store, environment: "production" })

    // Mutate the registry — adding a new workflow changes the content hash.
    workflow({ id: "billing.charge-overdue", async run() {} })
    const second = await publishManifest({ manifestStore: store, environment: "production" })

    expect(second).not.toBeNull()
    expect(second?.versionId).not.toBe(first?.versionId)
    const current = await store.getCurrent("production")
    expect(current?.versionId).toBe(second?.versionId)
  })

  it("defaults environment to production when the value is unset or unrecognized", async () => {
    registerWorkflows()
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    await publishManifest({ manifestStore: store, environment: "staging" as never })
    expect(await store.getCurrent("production")).not.toBeNull()
    expect(await store.getCurrent("preview")).toBeNull()
  })

  it("respects preview and development environments when explicitly set", async () => {
    registerWorkflows()
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    await publishManifest({ manifestStore: store, environment: "preview" })
    expect(await store.getCurrent("preview")).not.toBeNull()
    expect(await store.getCurrent("production")).toBeNull()
  })

  it("uses injected listWorkflows / listEventFilters when supplied", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    const result = await publishManifest({
      manifestStore: store,
      environment: "production",
      listWorkflows: () => [{ id: "injected.wf", config: { schedule: { every: "1m" } } }],
      listEventFilters: () => [],
    })
    expect(result?.workflows.map((w) => w.id)).toEqual(["injected.wf"])
    expect(result?.workflows[0]?.schedules[0]).toMatchObject({ every: "1m" })
  })
})

describe("scheduleAutoPublishManifest", () => {
  it("invokes waitUntil with the publish work", async () => {
    registerWorkflows()
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })

    let captured: Promise<unknown> | undefined
    scheduleAutoPublishManifest({
      manifestStore: store,
      environment: "production",
      waitUntil: (p) => {
        captured = p
      },
    })
    expect(captured).toBeInstanceOf(Promise)
    await captured
    expect(await store.getCurrent("production")).not.toBeNull()
  })

  it("latches per-store — repeat calls on the same store skip rechecking", async () => {
    registerWorkflows()
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    const getCurrent = vi.spyOn(store, "getCurrent")

    const waits: Array<Promise<unknown>> = []
    const waitUntil = (p: Promise<unknown>) => {
      waits.push(p)
    }
    scheduleAutoPublishManifest({ manifestStore: store, environment: "production", waitUntil })
    scheduleAutoPublishManifest({ manifestStore: store, environment: "production", waitUntil })
    scheduleAutoPublishManifest({ manifestStore: store, environment: "production", waitUntil })

    expect(waits).toHaveLength(1)
    await Promise.all(waits)
    expect(getCurrent).toHaveBeenCalledTimes(1)
  })

  it("clears the latch when the publish fails so a future request can retry", async () => {
    registerWorkflows()
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    vi.spyOn(store, "registerManifest").mockRejectedValueOnce(new Error("kv down"))
    const logged: Array<{ level: string; msg: string }> = []
    const logger = (level: "info" | "warn" | "error", msg: string) => {
      logged.push({ level, msg })
    }

    const waits: Array<Promise<unknown>> = []
    const waitUntil = (p: Promise<unknown>) => {
      waits.push(p)
    }
    scheduleAutoPublishManifest({
      manifestStore: store,
      environment: "production",
      waitUntil,
      logger,
    })
    await Promise.all(waits)
    expect(logged.some((entry) => entry.level === "warn")).toBe(true)

    // Retry must hit registerManifest again now that the latch cleared.
    scheduleAutoPublishManifest({
      manifestStore: store,
      environment: "production",
      waitUntil,
      logger,
    })
    await Promise.all(waits)
    expect(await store.getCurrent("production")).not.toBeNull()
  })
})
