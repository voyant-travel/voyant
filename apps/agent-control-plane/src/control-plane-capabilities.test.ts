import { describe, expect, it } from "vitest"

import { buildCapabilities } from "./control-plane.js"

describe("control-plane capabilities", () => {
  it("reports dry-run capabilities", () => {
    expect(buildCapabilities()).toMatchObject({
      service: "agent-control-plane",
      dryRunOnly: true,
      dispatchableActions: [
        "collect-ci",
        "complete-pr",
        "cleanup",
        "open-pr",
        "publish-evidence",
        "remote-bootstrap",
        "remote-cleanup",
        "remote-open-pr",
        "remote-publish-evidence",
        "remote-repair-ci",
        "remote-run-command",
        "repair-ci",
        "run-command",
        "start",
        "sync-pr",
      ],
      snapshotContracts: {
        tick: {
          persistence: "none",
          version: 1,
        },
      },
    })
  })
})
