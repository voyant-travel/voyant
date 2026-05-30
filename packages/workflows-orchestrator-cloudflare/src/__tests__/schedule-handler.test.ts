import type { WorkflowManifest } from "@voyantjs/workflows/protocol"
import { describe, expect, test } from "vitest"

import { createInMemoryKv, createKvManifestStore } from "../manifest-kv-store.js"
import { handleGetSchedules, type ScheduleListResponse } from "../schedule-handler.js"
import { createKvScheduleStateStore } from "../schedule-state-store.js"

function makeManifest(
  versionId: string,
  workflows: Array<{
    id: string
    schedules: WorkflowManifest["workflows"][number]["schedules"]
  }>,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    projectId: "proj_test",
    versionId,
    builtAt: 0,
    builderVersion: "test",
    capabilities: [],
    eventFilters: [],
    bindings: {},
    environments: {},
    workflows: workflows.map((w) => ({
      id: w.id,
      version: "1",
      steps: [],
      schedules: w.schedules,
      defaultRuntime: "edge",
      hasCompensation: false,
      sourceLocation: { file: "test.ts", line: 1 },
    })),
  }
}

const NOW = Date.UTC(2026, 4, 22, 12, 0, 0) // 2026-05-22T12:00:00Z

describe("handleGetSchedules", () => {
  test("returns 400 for an invalid environment", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    const res = await handleGetSchedules("staging", { manifestStore: store, now: () => NOW })
    expect(res.status).toBe(400)
  })

  test("returns 404 when no manifest is registered", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    const res = await handleGetSchedules("production", { manifestStore: store, now: () => NOW })
    expect(res.status).toBe(404)
  })

  test("projects cron schedules with computed nextRunAt", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    await store.registerManifest({
      environment: "production",
      versionId: "v_1",
      manifest: makeManifest("v_1", [
        {
          id: "bookings.expire-stale-holds",
          schedules: [{ cron: "*/5 * * * *", timezone: "UTC", overlap: "skip" }],
        },
      ]),
    })

    const res = await handleGetSchedules("production", { manifestStore: store, now: () => NOW })
    expect(res.status).toBe(200)
    const body = (await res.json()) as ScheduleListResponse
    expect(body.environment).toBe("production")
    expect(body.versionId).toBe("v_1")
    expect(body.data).toHaveLength(1)
    const entry = body.data[0]!
    expect(entry.workflowId).toBe("bookings.expire-stale-holds")
    expect(entry.enabled).toBe(true)
    // Next */5 fire after 12:00:00 is 12:05:00.
    expect(entry.nextRunAt).toBe(Date.UTC(2026, 4, 22, 12, 5, 0))
  })

  test("flags registration-disabled and env-filtered schedules", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    await store.registerManifest({
      environment: "preview",
      versionId: "v_2",
      manifest: makeManifest("v_2", [
        {
          id: "wf.disabled",
          schedules: [{ cron: "0 * * * *", enabled: false }],
        },
        {
          id: "wf.prod-only",
          schedules: [{ cron: "0 * * * *", environments: ["production"] }],
        },
      ]),
    })

    const res = await handleGetSchedules("preview", { manifestStore: store, now: () => NOW })
    const body = (await res.json()) as ScheduleListResponse
    const disabled = body.data.find((d) => d.workflowId === "wf.disabled")
    const filtered = body.data.find((d) => d.workflowId === "wf.prod-only")
    expect(disabled).toMatchObject({
      enabled: false,
      disabledReason: "registration_disabled",
      nextRunAt: null,
    })
    expect(filtered).toMatchObject({
      enabled: false,
      disabledReason: "env_filtered",
      nextRunAt: null,
    })
  })

  test("includes schedulesEnabledByEnv when provided", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    await store.registerManifest({
      environment: "production",
      versionId: "v_3",
      manifest: makeManifest("v_3", []),
    })

    const enabled = await handleGetSchedules("production", {
      manifestStore: store,
      schedulesEnabledByEnv: true,
      now: () => NOW,
    })
    const disabled = await handleGetSchedules("production", {
      manifestStore: store,
      schedulesEnabledByEnv: false,
      now: () => NOW,
    })
    const omitted = await handleGetSchedules("production", {
      manifestStore: store,
      now: () => NOW,
    })

    expect(((await enabled.json()) as ScheduleListResponse).schedulesEnabledByEnv).toBe(true)
    expect(((await disabled.json()) as ScheduleListResponse).schedulesEnabledByEnv).toBe(false)
    expect((await omitted.json()) as ScheduleListResponse).not.toHaveProperty(
      "schedulesEnabledByEnv",
    )
  })

  test("computes nextRunAt for every / at declarations", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    const atIso = new Date(NOW + 60_000).toISOString()
    await store.registerManifest({
      environment: "production",
      versionId: "v_4",
      manifest: makeManifest("v_4", [
        { id: "wf.every", schedules: [{ every: "30s" }] },
        { id: "wf.at", schedules: [{ at: atIso }] },
        { id: "wf.past-at", schedules: [{ at: new Date(NOW - 60_000).toISOString() }] },
      ]),
    })

    const res = await handleGetSchedules("production", { manifestStore: store, now: () => NOW })
    const body = (await res.json()) as ScheduleListResponse
    const every = body.data.find((d) => d.workflowId === "wf.every")
    const at = body.data.find((d) => d.workflowId === "wf.at")
    const past = body.data.find((d) => d.workflowId === "wf.past-at")
    expect(every?.nextRunAt).toBe(NOW + 30_000)
    expect(at?.nextRunAt).toBe(NOW + 60_000)
    // past `at` returns POSITIVE_INFINITY → coerced to null.
    expect(past?.nextRunAt).toBeNull()
  })

  test("returns null nextRunAt for invalid cron without throwing", async () => {
    const kv = createInMemoryKv()
    const store = createKvManifestStore({ kv })
    await store.registerManifest({
      environment: "production",
      versionId: "v_5",
      manifest: makeManifest("v_5", [{ id: "wf.bogus", schedules: [{ cron: "not a cron" }] }]),
    })

    const res = await handleGetSchedules("production", { manifestStore: store, now: () => NOW })
    const body = (await res.json()) as ScheduleListResponse
    expect(body.data[0]?.nextRunAt).toBeNull()
  })

  test("merges persisted scheduler state into schedule rows", async () => {
    const manifestKv = createInMemoryKv()
    const stateKv = createInMemoryKv()
    const store = createKvManifestStore({ kv: manifestKv })
    const scheduleStateStore = createKvScheduleStateStore({ kv: stateKv })
    await store.registerManifest({
      environment: "production",
      versionId: "v_6",
      manifest: makeManifest("v_6", [
        { id: "wf.stateful", schedules: [{ cron: "0 * * * *", name: "hourly" }] },
        { id: "wf.empty", schedules: [{ every: "30s" }] },
      ]),
    })
    await scheduleStateStore.putState("production", {
      scheduleId: "v_6:wf.stateful:hourly",
      workflowId: "wf.stateful",
      versionId: "v_6",
      lastFireAt: NOW - 60_000,
      lastRunId: "run_123",
      lastError: "dispatch failed",
      lockedUntil: NOW + 15_000,
      lastSuccessfulRunAt: NOW - 120_000,
      updatedAt: NOW - 30_000,
    })

    const res = await handleGetSchedules("production", {
      manifestStore: store,
      scheduleStateStore,
      now: () => NOW,
    })
    const body = (await res.json()) as ScheduleListResponse
    const stateful = body.data.find((row) => row.workflowId === "wf.stateful")
    const empty = body.data.find((row) => row.workflowId === "wf.empty")

    expect(stateful).toMatchObject({
      lastFireAt: NOW - 60_000,
      lastRunId: "run_123",
      lastError: "dispatch failed",
      lockedUntil: NOW + 15_000,
      lastSuccessfulRunAt: NOW - 120_000,
      stateUpdatedAt: NOW - 30_000,
    })
    expect(empty).toMatchObject({
      lastFireAt: null,
      lastRunId: null,
      lastError: null,
      lockedUntil: null,
      lastSuccessfulRunAt: null,
      stateUpdatedAt: null,
    })
  })
})
