import { createContainer, createEventBus } from "@voyant-travel/core"
import { assertPortConforms } from "@voyant-travel/core/project"
import type { AnyDrizzleDb } from "@voyant-travel/db"
import { describe, expect, it, vi } from "vitest"

import {
  createTripsVoyantRuntime,
  type TripsDatabaseRuntime,
  tripsDatabaseRuntimePort,
  tripsRoutesRuntimePort,
} from "../src/index.js"
import { TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY } from "../src/payment-subscriber-runtime.js"
import { tripsVoyantModule } from "../src/voyant.js"

describe("trips deployment manifest", () => {
  it("owns the package deployment surfaces", () => {
    expect(tripsVoyantModule).toMatchObject({
      schemaVersion: "voyant.module.v1",
      id: "@voyant-travel/trips",
      packageName: "@voyant-travel/trips",
      runtimePorts: [{ id: "trips.routes-runtime" }, { id: "trips.database-runtime" }],
      api: [
        {
          id: "@voyant-travel/trips#api.admin",
          surface: "admin",
          transactional: true,
          runtime: { entry: "@voyant-travel/trips", export: "createTripsVoyantRuntime" },
        },
        {
          id: "@voyant-travel/trips#api.public",
          surface: "public",
          transactional: true,
          runtime: { entry: "@voyant-travel/trips", export: "createTripsVoyantRuntime" },
        },
      ],
      schema: [{ id: "@voyant-travel/trips#schema" }],
      migrations: [{ id: "@voyant-travel/trips#migrations" }],
      subscribers: [
        {
          id: "@voyant-travel/trips#subscriber.payment-completed",
          eventType: "payment.completed",
          source: "@voyant-travel/trips",
          runtime: {
            entry: "./payment-subscribers",
            export: "tripsPaymentCompletedSubscriber",
          },
        },
      ],
    })
  })

  it("owns the executable payment completion runtime reference", () => {
    expect(tripsVoyantModule.subscribers?.[0]).toHaveProperty("runtime")
  })

  it("ships typed runtime ports and owns route and database lifecycle composition", async () => {
    const routeOptions = vi.fn(async () => ({}))
    const db = { source: "test" } as unknown as AnyDrizzleDb
    const withDb = vi.fn(
      async <T>(_bindings: unknown, operation: (value: AnyDrizzleDb) => Promise<T>): Promise<T> =>
        operation(db),
    )
    const databaseRuntime: TripsDatabaseRuntime = { withDb }

    await expect(assertPortConforms(tripsRoutesRuntimePort, routeOptions)).resolves.toBeUndefined()
    await expect(
      assertPortConforms(tripsRoutesRuntimePort, { routeOptions: true } as never),
    ).rejects.toThrow(/must be a function/)
    await expect(
      assertPortConforms(tripsDatabaseRuntimePort, databaseRuntime),
    ).resolves.toBeUndefined()
    await expect(
      assertPortConforms(tripsDatabaseRuntimePort, { withDb: true } as never),
    ).rejects.toThrow(/withDb/)

    const module = await createTripsVoyantRuntime({
      unitId: tripsVoyantModule.id,
      hasPort: () => true,
      getPort: vi.fn(async (port) =>
        port.id === tripsRoutesRuntimePort.id ? routeOptions : databaseRuntime,
      ) as never,
    })
    const bindings = { DATABASE_URL: "postgres://test" }
    const container = createContainer()

    expect(module.adminRoutes).toBeDefined()
    expect(module.publicRoutes).toBeDefined()
    expect(module.module.requiresTransactionalDb).toBe(true)

    await module.module.bootstrap?.({ bindings, container, eventBus: createEventBus() })
    const runtime = container.resolve<{
      withDb<T>(operation: (input: AnyDrizzleDb) => Promise<T>): Promise<T>
    }>(TRIPS_PAYMENT_SUBSCRIBER_RUNTIME_KEY)
    await expect(runtime.withDb(async (value) => value)).resolves.toBe(db)
    expect(withDb).toHaveBeenCalledWith(bindings, expect.any(Function))
  })
})
