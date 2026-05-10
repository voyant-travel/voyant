import { __resetRegistry, workflow } from "@voyantjs/workflows"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { createInMemoryDriver } from "../driver-inmemory.js"
import { buildTestManifest, testFactoryDeps } from "../testing/driver-compliance.js"

describe("InMemory driver schedule runner", () => {
  beforeEach(() => {
    __resetRegistry()
  })

  afterEach(() => {
    __resetRegistry()
  })

  test("fires workflow schedules registered through manifests", async () => {
    const observed: Array<{ input: unknown; scheduleId: string }> = []
    const wf = workflow<{ source: string }, void>({
      id: "scheduled-from-manifest",
      async run(input, ctx) {
        observed.push({
          input,
          scheduleId:
            ctx.run.triggeredBy.kind === "schedule" ? ctx.run.triggeredBy.scheduleId : "missing",
        })
      },
    })
    const manifest = buildTestManifest("v_schedule")
    manifest.workflows.push({
      id: wf.id,
      version: "v1",
      steps: [],
      schedules: [
        {
          at: new Date(Date.now() + 20).toISOString(),
          input: { source: "manifest" },
          name: "once",
        },
      ],
      defaultRuntime: "edge",
      hasCompensation: false,
      sourceLocation: { file: "<test>", line: 1 },
    })

    const driver = createInMemoryDriver({
      defaultEnvironment: "production",
      schedulePollIntervalMs: 5,
    })(testFactoryDeps())
    await driver.registerManifest({ environment: "production", manifest })

    await vi.waitFor(() => expect(observed).toHaveLength(1))

    expect(observed).toEqual([
      {
        input: { source: "manifest" },
        scheduleId: "v_schedule:scheduled-from-manifest:once",
      },
    ])
    const runs = await driver.admin?.listRuns?.({ workflowId: wf.id, environment: "production" })
    expect(runs?.runs).toHaveLength(1)
    await driver.shutdown?.()
  })

  test("filters manifest schedules by registered environment", async () => {
    let fired = 0
    const wf = workflow({
      id: "preview-only-schedule",
      async run() {
        fired++
      },
    })
    const manifest = buildTestManifest("v_preview_only")
    manifest.workflows.push({
      id: wf.id,
      version: "v1",
      steps: [],
      schedules: [{ every: "1s", environments: ["preview"] }],
      defaultRuntime: "edge",
      hasCompensation: false,
      sourceLocation: { file: "<test>", line: 1 },
    })

    const driver = createInMemoryDriver({
      defaultEnvironment: "production",
      schedulePollIntervalMs: 5,
    })(testFactoryDeps())
    await driver.registerManifest({ environment: "production", manifest })

    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(fired).toBe(0)
    await driver.shutdown?.()
  })
})
