import { createRootRoute, createRoute } from "@tanstack/react-router"
import { operatorAdminNavMessages } from "@voyant-travel/i18n"
import { describe, expect, it } from "vitest"

import {
  createSelectedGraphAdminExtensions,
  selectedGraphAdminExtensionFactories,
} from "../.voyant/admin/selected-graph-admin.generated.js"
import { operatorFrontend } from "../.voyant/routes/_lib/operator-frontend.js"

describe("selected-graph Team admin composition", () => {
  it("selects the package team extension exactly once", () => {
    expect(selectedGraphAdminExtensionFactories["@voyant-travel/auth#team"]).toBeTypeOf("function")
    expect(
      createSelectedGraphAdminExtensions({ navMessages: operatorAdminNavMessages.en.nav }).filter(
        ({ id }) => id === "auth-team",
      ),
    ).toHaveLength(1)
  })

  it("registers exactly one team route in the final operator router", () => {
    const rootRoute = createRootRoute()
    const workspaceRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: "_workspace",
    })
    const routeTree = rootRoute.addChildren([workspaceRoute])

    const router = operatorFrontend.createRouter({ routeTree, workspaceRoute })
    const teamRouteIds = Object.keys(router.routesById).filter(
      (routeId) => routeId === "/_workspace/settings/team",
    )

    expect(teamRouteIds).toEqual(["/_workspace/settings/team"])
  })
})
