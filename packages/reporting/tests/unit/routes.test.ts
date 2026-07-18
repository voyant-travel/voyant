import { OpenAPIHono } from "@hono/zod-openapi"
import { handleApiError } from "@voyant-travel/hono"
import { describe, expect, it } from "vitest"

import { ReportingRegistry } from "../../src/registry.js"
import { createReportingRoutes } from "../../src/routes.js"

function createApp(scopes: string[], registry = new ReportingRegistry([])) {
  const app = new OpenAPIHono()
  app.use("*", async (c, next) => {
    c.set("db", {} as never)
    c.set("scopes", scopes)
    await next()
  })
  app.route("/v1/admin/reporting", createReportingRoutes(registry))
  app.onError((error, c) => handleApiError(error, c))
  return app
}

describe("reporting routes", () => {
  it("parses the bounded text language for report readers", async () => {
    const response = await createApp(["reports:read"]).request(
      "/v1/admin/reporting/queries/parse",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "from bookings select count() as bookings limit 10" }),
      },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: { dataset: { id: "bookings" }, limit: 10 },
    })
  })

  it("does not expose catalog metadata without reports read access", async () => {
    const response = await createApp([]).request("/v1/admin/reporting/catalog")
    expect(response.status).toBe(403)
  })

  it("maps missing source dataset scopes to a forbidden preview response", async () => {
    const registry = new ReportingRegistry([
      {
        namespace: "finance",
        datasets: [
          {
            definition: {
              id: "finance.receivables",
              version: 1,
              label: "Receivables",
              grain: "One row per invoice",
              requiredScopes: ["finance:read"],
              fields: [
                {
                  id: "status",
                  label: "Status",
                  role: "dimension",
                  valueType: "string",
                  sensitivity: "internal",
                  requiredScopes: [],
                  aggregations: [],
                },
              ],
              defaultLimit: 100,
              maximumLimit: 1_000,
            },
            execute: async () => ({ columns: [], rows: [], truncated: false, warnings: [] }),
          },
        ],
      },
    ])
    const response = await createApp(["reports:read"], registry).request(
      "/v1/admin/reporting/queries/preview",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: {
            dataset: { id: "finance.receivables", version: 1 },
            select: [{ kind: "field", field: "status" }],
            filters: [],
            groupBy: [],
            orderBy: [],
          },
          parameters: {},
        }),
      },
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      error: "forbidden",
      missingScopes: ["finance:read"],
    })
  })
})
