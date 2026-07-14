import { actionLedgerService } from "@voyant-travel/action-ledger/service"
import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { productConfigurationRoutes } from "../../src/routes-configuration.js"
import { productsService } from "../../src/service.js"

const db = { test: "db" }

function createApp() {
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("db" as never, db)
    c.set("userId" as never, "usr_products")
    c.set("sessionId" as never, "sess_products")
    c.set("callerType" as never, "session")
    c.set("actor" as never, "staff")
    c.set("organizationId" as never, "org_products")
    await next()
  })
  app.route("/", productConfigurationRoutes)
  return app
}

describe("product configuration routes action ledger", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("ledgers activation setting creation as a product-targeted create", async () => {
    vi.spyOn(productsService, "getActivationSettingByProductId").mockResolvedValue(null)
    vi.spyOn(productsService, "upsertActivationSetting").mockResolvedValue({
      id: "pact_1",
      productId: "prod_1",
      activationMode: "scheduled",
      activateAt: null,
      deactivateAt: null,
      sellAt: new Date("2026-06-01T09:00:00.000Z"),
      stopSellAt: null,
      createdAt: new Date("2026-05-17T10:00:00.000Z"),
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    } as never)
    const appendEntry = vi
      .spyOn(actionLedgerService, "appendEntry")
      .mockResolvedValue({ entry: {} as never, replayed: false })

    const response = await createApp().request("/prod_1/activation-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-correlation-id": "corr_products_1",
      },
      body: JSON.stringify({
        activationMode: "scheduled",
        sellAt: "2026-06-01T09:00:00.000Z",
      }),
    })

    expect(response.status).toBe(201)
    expect(appendEntry).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        actionName: "product.activation_settings.create",
        actionKind: "create",
        evaluatedRisk: "medium",
        principalType: "user",
        principalId: "usr_products",
        sessionId: "sess_products",
        callerType: "session",
        actorType: "staff",
        organizationId: "org_products",
        correlationId: "corr_products_1",
        targetType: "product",
        targetId: "prod_1",
        routeOrToolName: "products.activation_settings.create",
        mutationDetail: expect.objectContaining({
          summary: "Created product activation settings fields: activationMode, sellAt",
          reversalKind: "none",
        }),
      }),
    )
  })

  it("ledgers capability upserts against existing rows as updates with changed fields", async () => {
    const before = {
      id: "pcap_1",
      productId: "prod_1",
      capability: "guided",
      enabled: true,
      notes: null,
      createdAt: new Date("2026-05-17T10:00:00.000Z"),
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    }
    vi.spyOn(productsService, "getCapabilityByProductAndName").mockResolvedValue(before as never)
    vi.spyOn(productsService, "createCapability").mockResolvedValue({
      ...before,
      enabled: false,
      notes: "Temporarily paused",
      updatedAt: new Date("2026-05-17T10:05:00.000Z"),
    } as never)
    const appendEntry = vi
      .spyOn(actionLedgerService, "appendEntry")
      .mockResolvedValue({ entry: {} as never, replayed: false })

    const response = await createApp().request("/prod_1/capabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        capability: "guided",
        enabled: false,
        notes: "Temporarily paused",
      }),
    })

    expect(response.status).toBe(201)
    expect(appendEntry).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        actionName: "product.capability.update",
        actionKind: "update",
        targetType: "product",
        targetId: "prod_1",
        routeOrToolName: "products.capability.update",
        mutationDetail: expect.objectContaining({
          summary: "Updated product capability fields: enabled, notes",
          reversalKind: "none",
        }),
      }),
    )
  })

  it("ledgers delivery format deletion using the before row product id", async () => {
    vi.spyOn(productsService, "getDeliveryFormatById").mockResolvedValue({
      id: "pdlf_1",
      productId: "prod_1",
      format: "service_voucher",
      isDefault: true,
      createdAt: new Date("2026-05-17T10:00:00.000Z"),
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    } as never)
    vi.spyOn(productsService, "deleteDeliveryFormat").mockResolvedValue({ id: "pdlf_1" } as never)
    const appendEntry = vi
      .spyOn(actionLedgerService, "appendEntry")
      .mockResolvedValue({ entry: {} as never, replayed: false })

    const response = await createApp().request("/delivery-formats/pdlf_1", {
      method: "DELETE",
    })

    expect(response.status).toBe(200)
    expect(appendEntry).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        actionName: "product.delivery_format.delete",
        actionKind: "delete",
        targetType: "product",
        targetId: "prod_1",
        routeOrToolName: "products.delivery_format.delete",
        mutationDetail: expect.objectContaining({
          summary: "Deleted product delivery format",
          reversalKind: "none",
        }),
      }),
    )
  })
})
