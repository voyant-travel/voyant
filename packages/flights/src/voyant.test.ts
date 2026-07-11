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
    const adapter = { capabilities: { provider: "stub", declared: [] } } as FlightConnectorAdapter
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
      hasPort: () => true,
      getPort: async () => provider,
    })
    expect(runtime.module).toEqual({ name: "flights" })
    expect(runtime.adminRoutes).toBeDefined()
  })
})
