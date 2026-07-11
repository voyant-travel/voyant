import { describe, expect, it } from "vitest"

import { defineWorkflowConfig, type VoyantWorkflowConfig } from "../config.js"

describe("defineWorkflowConfig", () => {
  it("preserves standalone workflow runtime settings", () => {
    const input = {
      projectId: "travel-operations",
      entry: { worker: "./src/worker.ts", container: "./src/container.ts" },
      environments: {
        production: {},
        preview: {},
        development: {},
      },
      bindings: {
        runs: { type: "d1", name: "WORKFLOW_RUNS" },
      },
      workflows: {
        dirs: ["./src/workflows"],
        defaults: { timeout: "10m" },
      },
    } satisfies VoyantWorkflowConfig

    expect(defineWorkflowConfig(input)).toBe(input)
  })
})
