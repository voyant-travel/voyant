import { describe, expect, it } from "vitest"

import { workflowRunsVoyantModule } from "../../src/voyant.js"

describe("workflow-runs deployment manifest", () => {
  it("owns the package schema and migrations", () => {
    expect(workflowRunsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/workflow-runs",
      packageName: "@voyant-travel/workflow-runs",
      schema: [
        {
          id: "@voyant-travel/workflow-runs#schema",
          source: "@voyant-travel/workflow-runs/schema",
        },
      ],
      migrations: [
        {
          id: "@voyant-travel/workflow-runs#migrations",
          source: "./migrations",
        },
      ],
    })
  })
})
