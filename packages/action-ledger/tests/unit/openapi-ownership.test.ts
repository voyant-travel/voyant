import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { createActionLedgerHealthRoutes } from "../../src/health-routes.js"
import { actionLedgerAdminRoutes } from "../../src/routes.js"

const document = JSON.parse(
  readFileSync(new URL("../../openapi/admin/action-ledger-health.json", import.meta.url), "utf8"),
) as { paths: Record<string, Record<string, { "x-voyant-api-id"?: string }>> }

describe("action ledger health OpenAPI ownership", () => {
  it("claims every health route operation", () => {
    const apiId = "@voyant-travel/action-ledger#health-extension.api"
    expect(document.paths["/v1/admin/action-ledger/health"]?.get?.["x-voyant-api-id"]).toBe(apiId)
    expect(document.paths["/v1/admin/action-ledger/health/check"]?.post?.["x-voyant-api-id"]).toBe(
      apiId,
    )
  })

  it("stamps the same ownership on the live route registry", () => {
    const checkDrift = async () => ({ ok: true, rows: [] })
    const routes = createActionLedgerHealthRoutes({
      checkBookingDrift: checkDrift,
      checkFinanceDrift: checkDrift,
      checkProductDrift: checkDrift,
    })
    const live = routes.getOpenAPIDocument({ info: { title: "test", version: "1" } })
    const apiId = "@voyant-travel/action-ledger#health-extension.api"

    expect(live.paths?.["/health"]?.get?.["x-voyant-api-id"]).toBe(apiId)
    expect(live.paths?.["/health/check"]?.post?.["x-voyant-api-id"]).toBe(apiId)
  })

  it("keeps base operations assigned to the base graph API", () => {
    const live = actionLedgerAdminRoutes.getOpenAPIDocument({
      info: { title: "test", version: "1" },
    })
    const apiId = "@voyant-travel/action-ledger#api.admin"

    for (const pathItem of Object.values(live.paths ?? {})) {
      for (const operation of Object.values(pathItem ?? {})) {
        if (operation && typeof operation === "object" && "responses" in operation) {
          expect(operation["x-voyant-api-id"]).toBe(apiId)
        }
      }
    }
  })
})
