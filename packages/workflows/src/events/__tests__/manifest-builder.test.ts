import { afterEach, describe, expect, test } from "vitest"

import { __resetRegistry, workflow } from "../../index.js"
import { trigger } from "../../trigger.js"
import { buildManifest } from "../manifest-builder.js"
import { __resetEventFilterRegistry, getEventFilterRegistry } from "../registry.js"

afterEach(() => {
  __resetRegistry()
  __resetEventFilterRegistry()
})

describe("buildManifest", () => {
  test("empty inputs produce a deterministic manifest", async () => {
    const a = await buildManifest({
      environment: "production",
      workflows: [],
      eventFilters: [],
      builtAt: 1_700_000_000_000,
    })
    const b = await buildManifest({
      environment: "production",
      workflows: [],
      eventFilters: [],
      builtAt: 1_700_000_000_000,
    })
    expect(a.versionId).toBe(b.versionId)
    expect(a.versionId).toMatch(/^[0-9a-f]{16}$/)
    expect(a.workflows).toEqual([])
    expect(a.eventFilters).toEqual([])
  })

  test("ordering of workflows and filters is canonical (id-sorted)", async () => {
    const wfA = workflow({ id: "z-wf", async run() {} })
    const wfB = workflow({ id: "a-wf", async run() {} })
    trigger.on("evt.x", { target: wfA })
    trigger.on("evt.y", { target: wfB })

    const manifest = await buildManifest({
      environment: "production",
      workflows: [wfA, wfB],
      eventFilters: getEventFilterRegistry().list(),
    })

    const ids = manifest.workflows.map((w) => w.id)
    expect(ids).toEqual([...ids].sort())

    const filterIds = manifest.eventFilters.map((f) => f.id)
    expect(filterIds).toEqual([...filterIds].sort())
  })

  test("identical inputs produce byte-identical manifests (modulo builtAt)", async () => {
    const wf = workflow({ id: "stable-wf", async run() {} })
    trigger.on("evt.stable", {
      target: wf,
      where: { eq: [{ path: "data.k" }, { lit: "v" }] },
    })

    const a = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: getEventFilterRegistry().list(),
      builtAt: 1_700_000_000_000,
    })
    const b = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: getEventFilterRegistry().list(),
      builtAt: 1_700_000_000_000,
    })
    expect(a.versionId).toBe(b.versionId)
    // versionId is computed independently of builtAt, so even mismatched
    // build times should produce the same versionId.
    const c = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: getEventFilterRegistry().list(),
      builtAt: 1_999_999_999_999,
    })
    expect(c.versionId).toBe(a.versionId)
  })

  test("differing eventFilters produce different versionIds", async () => {
    const wf = workflow({ id: "diff-wf", async run() {} })
    trigger.on("evt.a", { target: wf })
    const onlyA = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: getEventFilterRegistry().list(),
    })

    trigger.on("evt.b", { target: wf })
    const aAndB = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: getEventFilterRegistry().list(),
    })

    expect(onlyA.versionId).not.toBe(aAndB.versionId)
  })

  test("schedule declarations flow into workflow manifest entries", async () => {
    const wf = workflow({
      id: "scheduled-wf",
      schedule: [
        {
          cron: "0 * * * *",
          timezone: "UTC",
          environments: ["production"],
          input: { kind: "hourly" },
          overlap: "skip",
          name: "hourly",
        },
        {
          at: new Date(Date.UTC(2026, 0, 1, 12, 0, 0)),
          enabled: false,
          name: "new-year",
        },
      ],
      async run() {},
    })

    const manifest = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: [],
    })

    expect(manifest.workflows[0]?.schedules).toEqual([
      {
        cron: "0 * * * *",
        timezone: "UTC",
        environments: ["production"],
        input: { kind: "hourly" },
        overlap: "skip",
        name: "hourly",
      },
      {
        at: "2026-01-01T12:00:00.000Z",
        enabled: false,
        name: "new-year",
      },
    ])
  })

  test("schedule changes participate in manifest identity", async () => {
    const withoutSchedule = workflow({ id: "identity-wf", async run() {} })
    const a = await buildManifest({
      environment: "production",
      workflows: [withoutSchedule],
      eventFilters: [],
    })

    __resetRegistry()
    const withSchedule = workflow({
      id: "identity-wf",
      schedule: { every: "5m" },
      async run() {},
    })
    const b = await buildManifest({
      environment: "production",
      workflows: [withSchedule],
      eventFilters: [],
    })

    expect(a.versionId).not.toBe(b.versionId)
  })

  test("filter manifest entries flow through verbatim", async () => {
    const wf = workflow({ id: "passthrough-wf", async run() {} })
    trigger.on<{ kind: string }>("promotion.changed", {
      target: wf,
      where: { eq: [{ path: "data.kind" }, { lit: "all" }] },
      input: { passthrough: true },
    })

    const manifest = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: getEventFilterRegistry().list(),
    })

    expect(manifest.eventFilters).toHaveLength(1)
    expect(manifest.eventFilters[0]).toMatchObject({
      eventType: "promotion.changed",
      targetWorkflowId: "passthrough-wf",
      where: { eq: [{ path: "data.kind" }, { lit: "all" }] },
      input: { passthrough: true },
    })
  })
})
