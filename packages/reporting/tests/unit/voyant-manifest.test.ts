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

  it("wires the reporting-react admin extension runtime", () => {
    expect(reportingVoyantModule.admin?.runtime).toEqual({
      entry: "@voyant-travel/reporting-react/admin",
      export: "createSelectedReportingAdminExtension",
    })
    const paths = reportingVoyantModule.admin?.routes?.map((route) => route.path)
    expect(paths).toEqual(["/reporting", "/reporting/$id"])
    for (const route of reportingVoyantModule.admin?.routes ?? []) {
      expect(route.requiredScopes).toEqual(["reports:read"])
      expect(route.runtime).toEqual({
        entry: "@voyant-travel/reporting-react/admin",
        export: "createReportingAdminExtension",
      })
    }
  })

  it("contributes a cross-module operator overview template", () => {
    expect(reportingVoyantModule.reporting?.templates).toEqual([
      expect.objectContaining({
        id: "reporting.template.operator-overview",
        version: 1,
        widgets: expect.arrayContaining([
          expect.objectContaining({ widgetId: "bookings.widget.total" }),
          expect.objectContaining({ widgetId: "finance.net-issued-trend" }),
        ]),
      }),
    ])
  })
})
