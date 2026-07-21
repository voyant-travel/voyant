import { afterEach, describe, expect, test } from "vitest"
import { z } from "zod"

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
      description: "Runs scheduled work.",
      input: { type: "object", required: ["kind"] },
      output: { type: "object", required: ["ok"] },
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

    expect(manifest.capabilities).toEqual({
      trigger: true,
      events: true,
      schedules: true,
      rerun: true,
      resume: true,
      cancel: true,
      humanApproval: true,
      stepRerun: false,
    })
    expect(manifest.workflows[0]).toMatchObject({
      id: "scheduled-wf",
      displayName: "Scheduled Wf",
      description: "Runs scheduled work.",
      capabilities: {
        canTrigger: true,
        canRerun: true,
        canResume: false,
        canCancel: true,
        hasSchedules: true,
        supportsEvents: false,
        supportsHumanApproval: false,
        supportsStepRerun: false,
      },
      inputSchema: { type: "object", required: ["kind"] },
      outputSchema: { type: "object", required: ["ok"] },
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

  test("workflow timeout is normalized into manifest metadata and identity", async () => {
    const withoutTimeout = workflow({ id: "timeout-wf", async run() {} })
    const a = await buildManifest({
      environment: "production",
      workflows: [withoutTimeout],
      eventFilters: [],
    })

    expect(a.workflows[0]).not.toHaveProperty("timeoutMs")

    __resetRegistry()
    const withTimeout = workflow({
      id: "timeout-wf",
      timeout: "1h",
      async run() {},
    })
    const b = await buildManifest({
      environment: "production",
      workflows: [withTimeout],
      eventFilters: [],
    })

    expect(b.workflows[0]?.timeoutMs).toBe(3_600_000)
    expect(b.versionId).not.toBe(a.versionId)
  })

  test("zod schemas are converted before manifest identity is hashed", async () => {
    const bookingSchemaWorkflow = workflow({
      id: "schema-wf",
      input: z.object({ bookingId: z.string() }),
      output: z.object({ ok: z.boolean() }),
      async run() {},
    })

    const bookingManifest = await buildManifest({
      environment: "production",
      workflows: [bookingSchemaWorkflow],
      eventFilters: [],
    })

    expect(bookingManifest.workflows[0]?.inputSchema).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      additionalProperties: false,
      type: "object",
      properties: {
        bookingId: { type: "string" },
      },
      required: ["bookingId"],
    })
    expect(bookingManifest.workflows[0]?.outputSchema).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      additionalProperties: false,
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
      required: ["ok"],
    })

    __resetRegistry()
    const customerSchemaWorkflow = workflow({
      id: "schema-wf",
      input: z.object({ customerId: z.number() }),
      async run() {},
    })
    const customerManifest = await buildManifest({
      environment: "production",
      workflows: [customerSchemaWorkflow],
      eventFilters: [],
    })

    expect(customerManifest.workflows[0]?.inputSchema).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      additionalProperties: false,
      type: "object",
      properties: {
        customerId: { type: "number" },
      },
      required: ["customerId"],
    })
    expect(customerManifest.versionId).not.toBe(bookingManifest.versionId)
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
    expect(manifest.workflows[0]?.capabilities).toEqual({
      canTrigger: true,
      canRerun: true,
      canResume: false,
      canCancel: true,
      hasSchedules: false,
      supportsEvents: true,
      supportsHumanApproval: false,
      supportsStepRerun: false,
    })
  })

  test("bundle metadata and diagnostics flow into the manifest identity", async () => {
    const wf = workflow({ id: "diagnostic-wf", async run() {} })

    const a = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: [],
      bundle: {
        artifactName: "workflows.js",
        sizeBytes: 1234,
        hash: "abc123",
        hashAlgorithm: "sha256",
      },
      diagnostics: [
        {
          code: "unsupported_import",
          severity: "warning",
          message: "Optional import is not available in the hosted runner.",
          sourceLocation: { file: "src/workflows.ts", line: 7 },
        },
      ],
    })
    const b = await buildManifest({
      environment: "production",
      workflows: [wf],
      eventFilters: [],
      bundle: {
        artifactName: "workflows.js",
        sizeBytes: 9999,
        hash: "different",
        hashAlgorithm: "sha256",
      },
      diagnostics: [
        {
          code: "unsupported_import",
          severity: "error",
          message: "Hosted runner cannot load this import.",
        },
      ],
    })

    expect(a.bundle).toEqual({
      artifactName: "workflows.js",
      sizeBytes: 1234,
      hash: "abc123",
      hashAlgorithm: "sha256",
    })
    expect(a.diagnostics).toEqual([
      {
        code: "unsupported_import",
        severity: "warning",
        message: "Optional import is not available in the hosted runner.",
        sourceLocation: { file: "src/workflows.ts", line: 7 },
      },
    ])
    expect(a.versionId).not.toBe(b.versionId)
  })
})
