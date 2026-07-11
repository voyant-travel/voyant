import { assertPortConforms } from "@voyant-travel/core/project"
import { describe, expect, it, vi } from "vitest"
import type { FlightConnectorAdapter } from "./contract/adapter.js"
import { createFlightsHonoModule, createFlightsVoyantRuntime, flightsRuntimePort } from "./hono.js"
import { flightsVoyantModule } from "./voyant.js"

describe("flights deployment manifest", () => {
  it("owns its injectable runtime, schema, and migrations", () => {
    expect(flightsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/flights",
      packageName: "@voyant-travel/flights",
      runtimePorts: [{ id: "flights.runtime" }],
      requires: { capabilities: ["finance.payment-sessions"] },
      api: [
        {
          id: "@voyant-travel/flights#api",
          surface: "admin",
          mount: "flights",
          runtime: {
            entry: "@voyant-travel/flights/hono",
            export: "createFlightsVoyantRuntime",
          },
        },
      ],
      schema: [
        {
          id: "@voyant-travel/flights#schema",
          source: "@voyant-travel/flights/reference/local-postgres",
        },
      ],
      migrations: [{ id: "@voyant-travel/flights#migrations", source: "./migrations" }],
    })
  })

  it("requires Finance payment-session schema and graph capability", async () => {
    const packageJson = await import("../package.json", { with: { type: "json" } })

    expect(packageJson.default.voyant.requiresSchemas).toEqual([
      "@voyant-travel/db",
      "@voyant-travel/finance",
    ])
    expect(flightsVoyantModule.requires).toEqual({
      capabilities: ["finance.payment-sessions"],
    })
  })

  it("declares only the existing non-transactional admin surface", () => {
    expect(flightsVoyantModule.api).toEqual([
      {
        id: "@voyant-travel/flights#api",
        surface: "admin",
        mount: "flights",
        runtime: {
          entry: "@voyant-travel/flights/hono",
          export: "createFlightsVoyantRuntime",
        },
      },
    ])

    const runtime = createFlightsHonoModule({
      resolveAdapter: () => {
        throw new Error("not used by the manifest test")
      },
    })
    expect(runtime.module).toEqual({ name: "flights" })
    expect(runtime.adminRoutes).toBeDefined()
    expect(runtime.publicRoutes).toBeUndefined()
    expect(runtime.webhookRoutes).toBeUndefined()
  })

  it("owns runtime assembly and validates Node-host providers", async () => {
    const adapter: FlightConnectorAdapter = {
      capabilities: { provider: "stub", declared: [] },
      searchFlights: vi.fn(async () => ({ offers: [] })),
      priceOffer: vi.fn(async () => ({ offer: {} as never, valid: true })),
      bookFlight: vi.fn(async () => ({ order: {} as never })),
      getOrder: vi.fn(async () => ({ order: {} as never })),
      cancelOrder: vi.fn(async () => ({ order: {} as never })),
    }
    const provider = {
      resolveAdapter: vi.fn(() => adapter),
      startCardPayment: vi.fn(async () => {}),
    }

    await expect(assertPortConforms(flightsRuntimePort, provider)).resolves.toBeUndefined()
    await expect(assertPortConforms(flightsRuntimePort, {} as never)).rejects.toThrow(
      /resolveAdapter/,
    )

    const runtime = await createFlightsVoyantRuntime({
      unitId: "@voyant-travel/flights",
      projectConfig: {},
      api: flightsVoyantModule.api ?? [],
      hasPort: () => true,
      getPort: vi.fn(async () => provider) as never,
    })
    expect(runtime.module).toEqual({ name: "flights" })
    expect(runtime.adminRoutes).toBeDefined()
  })
})
