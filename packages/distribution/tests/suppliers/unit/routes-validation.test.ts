import { suppliersApiModule } from "@voyant-travel/distribution"
import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

function makeApp() {
  const app = new Hono()
  app.onError(handleApiError)
  app.route("/", suppliersApiModule.adminRoutes)
  return app
}

describe("Supplier route validation", () => {
  it("rejects reversed supplier rate ranges before handlers run", async () => {
    const app = makeApp()

    const createRes = await app.request("/supplier_1/services/service_1/rates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Invalid rate",
        currency: "EUR",
        amountCents: 5000,
        unit: "per_group",
        validFrom: "2026-09-10",
        validTo: "2026-09-01",
        minPax: 8,
        maxPax: 2,
      }),
    })

    expect(createRes.status).toBe(400)

    const updateRes = await app.request("/supplier_1/services/service_1/rates/rate_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        validFrom: "2026-09-10",
        validTo: "2026-09-01",
        minPax: 8,
        maxPax: 2,
      }),
    })

    expect(updateRes.status).toBe(400)
  })

  it("rejects reversed supplier contract terms and renewals outside the term", async () => {
    const app = makeApp()

    const createRes = await app.request("/supplier_1/contracts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agreementNumber: "QA-BAD",
        startDate: "2027-06-30",
        endDate: "2026-07-01",
        renewalDate: "2028-01-01",
        terms: "Bad range",
        status: "active",
      }),
    })

    expect(createRes.status).toBe(400)

    const updateRes = await app.request("/supplier_1/contracts/contract_1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startDate: "2026-07-01",
        endDate: "2026-12-31",
        renewalDate: "2027-01-01",
      }),
    })

    expect(updateRes.status).toBe(400)
  })
})
