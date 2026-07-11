import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  lockPackage: vi.fn(async () => ({ id: "hold_pkg_1" })),
}))

vi.mock("@voyant-travel/connect-sdk", () => ({
  createVoyantConnectClient: vi.fn(() => ({
    packages: {
      lock: mocks.lockPackage,
    },
  })),
}))

vi.mock("@voyant-travel/plugin-voyant-connect", async () => {
  const actual = await vi.importActual<typeof import("@voyant-travel/plugin-voyant-connect")>(
    "@voyant-travel/plugin-voyant-connect",
  )
  return {
    ...actual,
    resolveVoyantConnectEnv: vi.fn(() => ({
      apiKey: ["connect", "key"].join("_"),
      operatorId: "operator_1",
      baseUrl: "https://connect.test",
    })),
  }
})

import { createOperatorCatalogBookingRouteModuleOptions } from "./catalog-booking-runtime"

describe("operator Connect package hold preparation", () => {
  it("locks stored package offers that do not include hold status", async () => {
    const options = createOperatorCatalogBookingRouteModuleOptions()
    const offer = {
      id: "offer_pkg_1",
      connectionId: "conn_1",
      supplierId: "supplier_1",
      productRef: { id: "product_1" },
      stay: { checkIn: "2026-08-01", checkOut: "2026-08-08" },
      flights: [],
      pricing: { currency: "EUR", total: 120000 },
      cancellationPolicy: { refundable: false },
      expiresAt: "2026-07-03T12:00:00.000Z",
    }

    const next = await options.booking.prepareBookParameters({
      c: { env: {} },
      parameters: { connectRoute: "packages" },
      provenance: {
        sourceKind: "voyant-connect",
        sourceConnectionId: "conn_1",
      },
      quote: {
        upstream_payload: { offer },
      },
    })

    expect(mocks.lockPackage).toHaveBeenCalledWith("conn_1", offer)
    expect(next.holdId).toBe("hold_pkg_1")
  })
})
