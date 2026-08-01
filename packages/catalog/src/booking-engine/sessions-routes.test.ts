import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import {
  createInMemoryBookingSessionRepository,
  createInMemoryOwnedInventoryPorts,
} from "./sessions-memory.js"
import { createBookingSessionRoutes } from "./sessions-routes.js"
import { createBookingSessionModule } from "./sessions-service.js"

function createApp() {
  const repository = createInMemoryBookingSessionRepository()
  const inventory = createInMemoryOwnedInventoryPorts()
  inventory.setCapacity("product:prod_owned_1", 2)
  const module = createBookingSessionModule({
    now: () => new Date("2026-08-01T12:00:00.000Z"),
    ports: {
      repository,
      normalizeSelection: async ({ selection }) => selection,
      composeQuote: async () => ({
        currency: "EUR",
        lines: [],
        taxes: [],
        subtotal: 10000,
        taxTotal: 0,
        total: 10000,
      }),
      placeCapacityHold: inventory.placeCapacityHold,
      commitOwnedBooking: inventory.commitOwnedBooking,
    },
  })
  const app = new Hono()
  app.route(
    "/v1/public/catalog",
    createBookingSessionRoutes({ actorKind: "anonymous", resolveModule: () => module }),
  )
  app.route(
    "/v1/admin/catalog",
    createBookingSessionRoutes({ actorKind: "staff", resolveModule: () => module }),
  )
  return { app }
}

describe("Booking Session v1 routes", () => {
  it("adapts public anonymous and admin staff transports to the same module outcomes", async () => {
    const { app } = createApp()
    const publicBody = JSON.stringify({
      idempotencyKey: "route_create_public",
      target: { kind: "product", productId: "prod_owned_1" },
    })
    const adminBody = JSON.stringify({
      idempotencyKey: "route_create_staff",
      target: { kind: "product", productId: "prod_owned_1" },
    })
    const headers = { "content-type": "application/json" }

    const publicResponse = await app.request("/v1/public/catalog/booking-sessions", {
      method: "POST",
      headers,
      body: publicBody,
    })
    const adminResponse = await app.request("/v1/admin/catalog/booking-sessions", {
      method: "POST",
      headers,
      body: adminBody,
    })

    expect(publicResponse.status).toBe(200)
    expect(adminResponse.status).toBe(200)
    await expect(publicResponse.json()).resolves.toMatchObject({
      kind: "session_created",
      session: { actorKind: "anonymous", revision: 1, target: { productId: "prod_owned_1" } },
      capability: { headerName: "Voyant-Booking-Session-Capability" },
    })
    await expect(adminResponse.json()).resolves.toMatchObject({
      kind: "session_created",
      session: { actorKind: "staff", revision: 1, target: { productId: "prod_owned_1" } },
    })
  })

  it("requires the anonymous capability for public mutations while staff uses the same module", async () => {
    const { app } = createApp()
    const headers = { "content-type": "application/json" }
    const publicCreated = await app.request("/v1/public/catalog/booking-sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        idempotencyKey: "route_public_create",
        target: { kind: "product", productId: "prod_owned_1" },
      }),
    })
    const publicSession = (await publicCreated.json()) as {
      session: { id: string; revision: number }
      capability: { token: string }
    }

    const missingCapability = await app.request(
      `/v1/public/catalog/booking-sessions/${publicSession.session.id}/quote`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          expectedRevision: publicSession.session.revision,
          idempotencyKey: "missing_capability_quote",
        }),
      },
    )
    await expect(missingCapability.json()).resolves.toMatchObject({
      kind: "rejected",
      error: { kind: "capability_required" },
    })

    const wrongCapability = await app.request(
      `/v1/public/catalog/booking-sessions/${publicSession.session.id}/quote`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Voyant-Booking-Session-Capability": "wrong_capability_token",
        },
        body: JSON.stringify({
          expectedRevision: publicSession.session.revision,
          idempotencyKey: "wrong_capability_quote",
        }),
      },
    )
    await expect(wrongCapability.json()).resolves.toMatchObject({
      kind: "rejected",
      error: { kind: "capability_required" },
    })

    const quoted = await app.request(
      `/v1/public/catalog/booking-sessions/${publicSession.session.id}/quote`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Voyant-Booking-Session-Capability": publicSession.capability.token,
        },
        body: JSON.stringify({
          expectedRevision: publicSession.session.revision,
          idempotencyKey: "route_quote_key",
        }),
      },
    )
    await expect(quoted.json()).resolves.toMatchObject({ kind: "quote_created" })

    const adminCreated = await app.request("/v1/admin/catalog/booking-sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        idempotencyKey: "route_staff_create",
        target: { kind: "product", productId: "prod_owned_1" },
      }),
    })
    const adminSession = (await adminCreated.json()) as {
      session: { id: string; revision: number }
    }
    const staffQuote = await app.request(
      `/v1/admin/catalog/booking-sessions/${adminSession.session.id}/quote`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          expectedRevision: adminSession.session.revision,
          idempotencyKey: "staff_quote_key",
        }),
      },
    )
    await expect(staffQuote.json()).resolves.toMatchObject({ kind: "quote_created" })

    const publicAgainstStaff = await app.request(
      `/v1/public/catalog/booking-sessions/${adminSession.session.id}/quote`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Voyant-Booking-Session-Capability": publicSession.capability.token,
        },
        body: JSON.stringify({
          expectedRevision: adminSession.session.revision,
          idempotencyKey: "public_against_staff_quote",
        }),
      },
    )
    await expect(publicAgainstStaff.json()).resolves.toMatchObject({
      kind: "rejected",
      error: { kind: "not_authorized" },
    })
  })
})
