import { reportingContributionRuntimePort } from "@voyant-travel/reporting-contracts/runtime-port"
import { describe, expect, it } from "vitest"

import reportingVoyantModule from "../../src/voyant.js"

describe("reporting manifest", () => {
  it("owns persistence and consumes additive module contributions", () => {
    expect(reportingVoyantModule.id).toBe("@voyant-travel/reporting")
    expect(reportingVoyantModule.runtimePorts).toContainEqual(
      expect.objectContaining({ id: reportingContributionRuntimePort.id, cardinality: "many" }),
    )
    expect(reportingVoyantModule.api?.[0]).toMatchObject({
      surface: "admin",
      mount: "reporting",
      resource: "reports",
      authorization: "route",
    })
    expect(reportingVoyantModule.access?.resources[0]?.actions.map(({ action }) => action)).toEqual(
      ["read", "write", "export"],
    )
  })
})
