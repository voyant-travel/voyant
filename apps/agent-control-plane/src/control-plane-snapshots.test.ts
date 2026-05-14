import { describe, expect, it } from "vitest"

import { acceptTickSnapshot, tickSnapshotRequestSchema } from "./control-plane.js"
import { tickSnapshot } from "./control-plane-test-fixtures.js"

describe("control-plane tick snapshots", () => {
  it("accepts and summarizes tick snapshots without dispatching work", () => {
    expect(acceptTickSnapshot(tickSnapshot)).toEqual({
      accepted: true,
      snapshot: tickSnapshot,
      summary: {
        dispatchableRecommendationCount: 2,
        firstDispatchableAction: "remote-bootstrap",
        firstDispatchableIssueNumber: 579,
        recentEventCount: 1,
        recommendationCount: 2,
      },
    })
  })

  it("preserves extra issue metadata when validating tick snapshots", () => {
    expect(tickSnapshotRequestSchema.parse(tickSnapshot).recommendations[0]?.issue).toMatchObject({
      agentBrief: "Acceptance criteria and verification lane.",
      hasAgentBrief: true,
      labels: ["agent:ready", "ui"],
      state: "OPEN",
    })
  })
})
