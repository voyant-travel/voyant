import { Hono } from "hono"
import { describe, expect, it, vi } from "vitest"

import {
  type CatalogOffersConnectClient,
  type CatalogOffersRouteModuleOptions,
  createCatalogOffersAdminRoutes,
  createCatalogOffersApiExtension,
} from "./operator-routes.js"

// A db stub whose `.select().from().where().limit()` chain resolves to the
// provided rows. The package-offers / package-detail / cruise handlers under
// test only ever issue this `.limit()`-terminated query shape.
function dbStub(rows: unknown[]): unknown {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  }
  return { select: () => chain }
}

function makeOptions(
  overrides: Partial<CatalogOffersRouteModuleOptions> = {},
): CatalogOffersRouteModuleOptions {
  return {
    resolveConnectClient: () => null,
    fetchIndexFields: vi.fn(async () => new Map()),
    resolveDynamicHotelIds: vi.fn(async () => []),
    resolveAirportLabels: vi.fn(async (_c, codes: string[]) =>
      codes.map((code) => ({ code, label: code })),
    ),
    ...overrides,
  }
}

// Mount the relative routes under /v1/admin/catalog with a db in context, the
// way the deployment composes the extension.
function app(options: CatalogOffersRouteModuleOptions, rows: unknown[] = []): Hono {
  const hono = new Hono()
  hono.use("*", async (c, next) => {
    ;(c as { set(key: string, value: unknown): void }).set("db", dbStub(rows))
    await next()
  })
  hono.route("/v1/admin/catalog", createCatalogOffersAdminRoutes(options))
  return hono
}

function post(hono: Hono, path: string, body: unknown) {
  return hono.request(`/v1/admin/catalog${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const validOffersBody = {
  productId: "tui-pkg:AYT61172",
  departureDateFrom: "2026-07-01",
  departureDateTo: "2026-07-31",
}

describe("createCatalogOffersAdminRoutes", () => {
  it("publishes a package-owned extension descriptor", () => {
    const extension = createCatalogOffersApiExtension(makeOptions())

    expect(extension.extension).toEqual({ name: "catalog-offers", module: "catalog" })
    expect(extension.adminRoutes).toBeDefined()
  })

  it("returns connect_not_configured + empty list (200) when no client", async () => {
    const hono = app(makeOptions())
    const res = await post(hono, "/package-offers", validOffersBody)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ error: "connect_not_configured", offers: [] })
  })

  it("400s on a missing required body field", async () => {
    const hono = app(makeOptions())
    const res = await post(hono, "/package-offers", { productId: "x" })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe("invalid_request")
  })

  it("delegates to the connect client and maps the offers", async () => {
    const client: CatalogOffersConnectClient = {
      transport: {
        request: vi.fn(async () => ({
          offers: [
            {
              id: "o1",
              productRef: { entityId: "tui-pkg:AYT61172" },
              stay: { checkIn: "2026-07-05", nights: 7, board: "AI" },
              pricing: {
                perPerson: { amountMinor: 50000, currency: "EUR" },
                total: { amountMinor: 100000, currency: "EUR" },
              },
              flights: [{ origin: "OTP", destination: "AYT", carrier: "TK" }],
            },
          ],
        })),
      },
      accommodations: { getOnConnection: vi.fn() },
      cruises: { getOnConnection: vi.fn(), listSailingPricing: vi.fn() },
    }
    const options = makeOptions({
      resolveConnectClient: () => client,
      fetchIndexFields: vi.fn(async () => new Map([["tui-pkg:AYT61172", { name: "Hotel X" }]])),
    })
    const hono = app(options, [{ connectionId: "conn-1", sourceRef: "tui-pkg:AYT61172" }])

    const res = await post(hono, "/package-offers", validOffersBody)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      product: { name: string } | null
      offers: Array<{ id: string; perPerson: { amountMinor: number } }>
    }
    expect(client.transport.request).toHaveBeenCalledOnce()
    expect(body.product?.name).toBe("Hotel X")
    expect(body.offers).toHaveLength(1)
    expect(body.offers[0]?.id).toBe("o1")
    expect(body.offers[0]?.perPerson.amountMinor).toBe(50000)
  })

  it("returns no_connection_for_product (200) when the entry has no connection", async () => {
    const client: CatalogOffersConnectClient = {
      transport: { request: vi.fn() },
      accommodations: { getOnConnection: vi.fn() },
      cruises: { getOnConnection: vi.fn(), listSailingPricing: vi.fn() },
    }
    const hono = app(makeOptions({ resolveConnectClient: () => client }), [])
    const res = await post(hono, "/package-offers", validOffersBody)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ error: "no_connection_for_product", offers: [] })
    expect(client.transport.request).not.toHaveBeenCalled()
  })

  it("decodes cruise ids and maps sailing pricing to the cheapest per cabin", async () => {
    const cruiseId = `crus_sr_${globalThis
      .btoa(JSON.stringify({ connectionId: "conn-c", externalId: "CR1" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")}`
    const client: CatalogOffersConnectClient = {
      transport: { request: vi.fn() },
      accommodations: { getOnConnection: vi.fn() },
      cruises: {
        getOnConnection: vi.fn(),
        listSailingPricing: vi.fn(async () => [
          { cabinCategoryId: "IB", pricePerPerson: { amountMinor: 90000, currency: "USD" } },
          { cabinCategoryId: "IB", pricePerPerson: { amountMinor: 80000, currency: "USD" } },
        ]),
      },
    }
    const hono = app(makeOptions({ resolveConnectClient: () => client }))
    const res = await post(hono, "/cruise-sailing-pricing", { cruiseId, sailingRef: "S1" })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      currency: string
      cabins: Array<{ code: string; fromAmountMinor: number }>
    }
    expect(body.currency).toBe("USD")
    expect(body.cabins).toEqual([{ code: "IB", fromAmountMinor: 80000, available: true }])
  })

  it("cruise-price returns nulls (200) for an undecodable cruise id", async () => {
    const client: CatalogOffersConnectClient = {
      transport: { request: vi.fn() },
      accommodations: { getOnConnection: vi.fn() },
      cruises: { getOnConnection: vi.fn(), listSailingPricing: vi.fn() },
    }
    const hono = app(makeOptions({ resolveConnectClient: () => client }))
    const res = await post(hono, "/cruise-price", { cruiseId: "not-a-cruise" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ fromAmountMinor: null, currency: null })
    expect(client.cruises.getOnConnection).not.toHaveBeenCalled()
  })
})
