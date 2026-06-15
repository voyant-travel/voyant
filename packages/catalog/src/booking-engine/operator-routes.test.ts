import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { cancelEntity } from "./cancel.js"
import { BookingEngineError } from "./errors.js"
import {
  type CatalogBookingRouteModuleOptions,
  createCatalogBookingOrdersRoutes,
  mountCatalogBookingRoutes,
} from "./operator-routes.js"
import { getOrderById, listOrders } from "./orders.js"
import { createSourceAdapterRegistry } from "./registry.js"

vi.mock("./orders.js", () => ({
  listOrders: vi.fn(),
  getOrderById: vi.fn(),
}))

vi.mock("./cancel.js", () => ({
  cancelEntity: vi.fn(),
}))

// The booking-engine routes (quote/book/drafts/holds) are exercised by
// routes.test.ts; here we stub the factory so the mount wiring stays focused
// on orders + the multi-surface mount.
vi.mock("./routes.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./routes.js")>()
  return {
    ...actual,
    createCatalogBookingRoutes: vi.fn(() =>
      new Hono().post("/quote", (c) => c.json({ ok: "quote" })),
    ),
  }
})

const db = { kind: "db" } as never
const registry = createSourceAdapterRegistry()

function makeOptions(
  overrides: Partial<CatalogBookingRouteModuleOptions> = {},
): CatalogBookingRouteModuleOptions {
  return {
    booking: {
      resolveDb: () => db,
      resolveSourceRegistry: () => registry,
      resolveOwnedHandlers: () => ({}) as never,
    } as never,
    resolveRegistry: () => registry,
    ...overrides,
  }
}

function ordersApp(options = makeOptions()) {
  const app = new Hono()
  app.route("/v1/admin/catalog", createCatalogBookingOrdersRoutes(options))
  return app
}

beforeEach(() => {
  vi.mocked(listOrders).mockReset()
  vi.mocked(getOrderById).mockReset()
  vi.mocked(cancelEntity).mockReset()
})

describe("createCatalogBookingOrdersRoutes", () => {
  describe("GET /orders", () => {
    it("delegates to listOrders with parsed filters and returns rows", async () => {
      vi.mocked(listOrders).mockResolvedValue({ rows: [{ id: "snap_1" } as never] })
      const app = ordersApp()

      const res = await app.request(
        "/v1/admin/catalog/orders?bookingId=bk_1&entityModule=products&sourceKinds=demo,owned&limit=10&offset=5",
      )

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ rows: [{ id: "snap_1" }] })
      expect(listOrders).toHaveBeenCalledWith(db, {
        bookingId: "bk_1",
        entityModule: "products",
        sourceKinds: ["demo", "owned"],
        limit: 10,
        offset: 5,
      })
    })

    it("falls back to default limit/offset when not numeric", async () => {
      vi.mocked(listOrders).mockResolvedValue({ rows: [] })
      const app = ordersApp()

      await app.request("/v1/admin/catalog/orders?limit=abc")

      expect(listOrders).toHaveBeenCalledWith(db, expect.objectContaining({ limit: 50, offset: 0 }))
    })
  })

  describe("GET /orders/:id", () => {
    it("returns the order row when found", async () => {
      vi.mocked(getOrderById).mockResolvedValue({ id: "snap_1" } as never)
      const app = ordersApp()

      const res = await app.request("/v1/admin/catalog/orders/snap_1")

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id: "snap_1" })
      expect(getOrderById).toHaveBeenCalledWith(db, "snap_1")
    })

    it("404s when the order is missing", async () => {
      vi.mocked(getOrderById).mockResolvedValue(null)
      const app = ordersApp()

      const res = await app.request("/v1/admin/catalog/orders/missing")

      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: "order not found" })
    })
  })

  describe("POST /orders/:id/cancel", () => {
    it("400s when required body fields are missing", async () => {
      const app = ordersApp()

      const res = await app.request("/v1/admin/catalog/orders/snap_1/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: "bk_1" }),
      })

      expect(res.status).toBe(400)
      expect(cancelEntity).not.toHaveBeenCalled()
    })

    it("delegates to cancelEntity with the resolved registry", async () => {
      vi.mocked(cancelEntity).mockResolvedValue({
        status: "cancelled",
        snapshotId: "snap_1",
      } as never)
      const app = ordersApp()

      const res = await app.request("/v1/admin/catalog/orders/snap_1/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: "bk_1",
          entityModule: "products",
          entityId: "prod_1",
          reason: "customer request",
        }),
      })

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ status: "cancelled", snapshotId: "snap_1" })
      expect(cancelEntity).toHaveBeenCalledWith(
        db,
        { registry },
        expect.objectContaining({
          bookingId: "bk_1",
          entityModule: "products",
          entityId: "prod_1",
          reason: "customer request",
        }),
      )
    })

    it("translates BookingEngineError codes into HTTP statuses", async () => {
      vi.mocked(cancelEntity).mockRejectedValue(new BookingEngineError("ORDER_NOT_FOUND", "nope"))
      const app = ordersApp()

      const res = await app.request("/v1/admin/catalog/orders/snap_1/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: "bk_1",
          entityModule: "products",
          entityId: "prod_1",
        }),
      })

      expect(res.status).toBe(404)
      const body = (await res.json()) as { code: string }
      expect(body.code).toBe("ORDER_NOT_FOUND")
    })
  })
})

describe("mountCatalogBookingRoutes", () => {
  it("mounts the booking-engine surface on both admin and public prefixes", async () => {
    const app = new Hono()
    mountCatalogBookingRoutes(app, makeOptions())

    const admin = await app.request("/v1/admin/catalog/quote", { method: "POST" })
    const pub = await app.request("/v1/public/catalog/quote", { method: "POST" })

    expect(admin.status).toBe(200)
    expect(pub.status).toBe(200)
    expect(await admin.json()).toEqual({ ok: "quote" })
  })

  it("mounts admin-only order routes", async () => {
    vi.mocked(listOrders).mockResolvedValue({ rows: [] })
    const app = new Hono()
    mountCatalogBookingRoutes(app, makeOptions())

    const res = await app.request("/v1/admin/catalog/orders")

    expect(res.status).toBe(200)
    expect(listOrders).toHaveBeenCalled()
  })
})
