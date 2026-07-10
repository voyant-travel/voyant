import { composeVoyantGraphRuntime } from "@voyant-travel/framework"
import { describe, expect, it } from "vitest"

import { graphIdFromSpecifier } from "../../../../packages/framework/src/deployment-graph"
import {
  OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MODULE_IDS,
  OPERATOR_LOCAL_DEPLOYMENT_GRAPH_PLUGIN_IDS,
} from "../../deployment-graph.local"
import { createGeneratedGraphRuntime } from "../graph-runtime.generated"
import {
  OPERATOR_COMPATIBILITY_BRIDGE_MODULE_SPECIFIERS,
  OPERATOR_COMPATIBILITY_BRIDGE_PLUGIN_SPECIFIERS,
  OPERATOR_VOYANT_PROJECT,
} from "../../voyant.project"
import {
  buildOperatorProviders,
  deploymentLocalExtensions,
  deploymentLocalModules,
  operatorGraphCompatibilityExtensions,
  operatorGraphCompatibilityModules,
  operatorGraphRuntimeBindings,
} from "./composition"
import { recordPaidBookingCancellationSettlement } from "./subscribers/booking-cancellation-settlement"
import { closeTerminalBookingPaymentSchedules } from "./subscribers/booking-payment-cleanup"

async function composeOperatorGraph() {
  return composeVoyantGraphRuntime({
    runtime: createGeneratedGraphRuntime(),
    capabilities: buildOperatorProviders(),
    bindings: operatorGraphRuntimeBindings,
  })
}

describe("operator graph runtime composition", () => {
  it("wires booking payment cleanup and paid-cancellation settlement providers", () => {
    const providers = buildOperatorProviders()

    expect(providers.closePaymentSchedulesForBooking).toBe(closeTerminalBookingPaymentSchedules)
    expect(providers.recordCancellationFinancialSettlement).toBe(
      recordPaidBookingCancellationSettlement,
    )
  })

  it("mounts selected package exports once in graph order", async () => {
    const composed = await composeOperatorGraph()
    const moduleNames = composed.modules.map((module) => module.module.name)
    const extensionNames = composed.extensions.map((extension) => extension.extension.name)

    expect(moduleNames).toContain("bookings")
    expect(moduleNames).toContain("finance")
    expect(moduleNames).toContain("catalog")
    expect(extensionNames).toContain("bookings-suppliers")
    expect(extensionNames).toContain("booking-tax")
    expect(new Set(moduleNames).size).toBe(moduleNames.length)
    expect(new Set(extensionNames).size).toBe(extensionNames.length)
  })

  it("selects package-owned bridge units directly and keeps only genuine operator-local ids", () => {
    const moduleIds = new Set(OPERATOR_VOYANT_PROJECT.modules.map((unit) => unit.id))
    const pluginIds = new Set(OPERATOR_VOYANT_PROJECT.plugins.map((unit) => unit.id))

    for (const specifier of OPERATOR_COMPATIBILITY_BRIDGE_MODULE_SPECIFIERS) {
      expect(moduleIds).toContain(graphIdFromSpecifier(specifier))
    }
    for (const specifier of OPERATOR_COMPATIBILITY_BRIDGE_PLUGIN_SPECIFIERS) {
      expect(pluginIds).toContain(graphIdFromSpecifier(specifier))
    }

    const operatorIds = [...moduleIds, ...pluginIds].filter((id) =>
      id.startsWith("@voyant-travel/operator#"),
    )
    expect(operatorIds.sort()).toEqual(
      [
        ...OPERATOR_LOCAL_DEPLOYMENT_GRAPH_MODULE_IDS,
        ...OPERATOR_LOCAL_DEPLOYMENT_GRAPH_PLUGIN_IDS,
      ].sort(),
    )
  })

  it("keeps invitations, team, and MCP explicitly deployment-local and graph-keyed", async () => {
    expect(deploymentLocalModules).toHaveProperty("@voyant-travel/operator#invitations")
    expect(deploymentLocalModules).toHaveProperty("@voyant-travel/operator#team")
    expect(deploymentLocalModules).toHaveProperty("@voyant-travel/operator#mcp")

    const composed = await composeOperatorGraph()
    const byName = (name: string) => composed.modules.find((module) => module.module.name === name)

    expect(byName("invitations")?.lazyAdminRoutes).toBeTypeOf("function")
    expect(byName("invitations")?.lazyPublicRoutes).toBeTypeOf("function")
    expect(byName("team")?.lazyAdminRoutes).toBeTypeOf("function")
    expect(byName("mcp")?.lazyAdminRoutes).toBeTypeOf("function")
  })

  it("composes graph package and local extensions without legacy duplicates", async () => {
    const composed = await composeOperatorGraph()
    const byName = (name: string) =>
      composed.extensions.find((extension) => extension.extension.name === name)

    expect(byName("channel-push")?.extension.module).toBe("distribution")
    expect(byName("channel-push")?.adminRoutes).toBeDefined()
    expect(byName("booking-tax")?.extension.module).toBe("bookings")
    expect(byName("booking-tax")?.adminRoutes).toBeDefined()
    expect(byName("mice-booking")?.extension.module).toBe("bookings")
    expect(byName("booking-schedule")?.publicPath).toBe("payment-policy")
    expect(byName("proposal")?.publicPath).toBe("proposals")

    for (const id of Object.keys(deploymentLocalExtensions)) {
      expect(operatorGraphRuntimeBindings).toHaveProperty(id)
    }
  })

  it("keeps deployment option wiring package-owned and graph-gated", () => {
    for (const id of [
      ...Object.keys(operatorGraphCompatibilityModules),
      ...Object.keys(operatorGraphCompatibilityExtensions),
    ]) {
      expect(id).not.toMatch(/^@voyant-travel\/operator#/)
      expect(operatorGraphRuntimeBindings).toHaveProperty(id)
    }
    expect(operatorGraphRuntimeBindings).not.toHaveProperty(
      "@voyant-travel/public-document-delivery",
    )
  })

  it("initializes the real operator app from the generated graph runtime", async () => {
    const { app } = await import("./app")

    expect(app.fetch).toBeTypeOf("function")
  })
})
