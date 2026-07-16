import { createEventBus } from "@voyant-travel/core"
import {
  type CustomFieldsRuntime,
  customFieldsRuntimePort,
} from "@voyant-travel/core/custom-fields"
import { newId } from "@voyant-travel/db/lib/typeid"
import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BOOKING_ROUTE_RUNTIME_CONTAINER_KEY } from "../../../bookings/src/route-runtime.js"
import { bookingRoutes } from "../../../bookings/src/routes.js"
import { bookingsService } from "../../../bookings/src/service.js"
import { RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY } from "../../src/route-runtime.js"
import { accountRoutes } from "../../src/routes/accounts.js"
import { createRelationshipsRuntimePortContribution } from "../../src/runtime-contributor.js"
import { relationshipsRouteRuntimePort } from "../../src/runtime-port.js"
import { relationshipsService } from "../../src/service/index.js"

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const rows = [
  {
    entityType: "booking",
    key: "group_size",
    fieldType: "double",
    label: "Group size",
    isRequired: true,
    isSearchable: false,
    isExportable: true,
    isInvoiceable: false,
    options: null,
  },
  {
    entityType: "person",
    key: "loyalty_tier",
    fieldType: "enum",
    label: "Tier",
    isRequired: true,
    isSearchable: true,
    isExportable: true,
    isInvoiceable: true,
    options: [
      { label: "Gold", value: "gold" },
      { label: "Silver", value: "silver" },
    ],
  },
]

function fakeDb() {
  return { select: () => ({ from: () => Promise.resolve(rows) }) }
}

const contributions = createRelationshipsRuntimePortContribution({})
const relationshipsRuntime = contributions[relationshipsRouteRuntimePort.id] as {
  customFields: (db: unknown) => Promise<unknown>
}
const customFields = contributions[customFieldsRuntimePort.id] as CustomFieldsRuntime

function bookingApp() {
  return new Hono()
    .onError(handleApiError)
    .use("*", async (c, next) => {
      c.set("db" as never, fakeDb())
      c.set("eventBus" as never, createEventBus())
      c.set("userId" as never, "test-user")
      c.set("actor" as never, "staff")
      c.set("container" as never, {
        resolve: (key: string) =>
          key === BOOKING_ROUTE_RUNTIME_CONTAINER_KEY
            ? { customFields: customFields.resolveRegistry }
            : undefined,
      })
      await next()
    })
    .route("/", bookingRoutes)
}

function relationshipsApp() {
  return new Hono()
    .onError(handleApiError)
    .use("*", async (c, next) => {
      c.set("db" as never, fakeDb())
      c.set("userId" as never, "test-user")
      c.set("container" as never, {
        resolve: (key: string) =>
          key === RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY ? relationshipsRuntime : undefined,
      })
      await next()
    })
    .route("/", accountRoutes)
}

describe("database-owned custom-field write boundaries", () => {
  afterEach(() => vi.restoreAllMocks())

  it("returns only channel-visible persisted values through the shared runtime", async () => {
    vi.spyOn(relationshipsService, "getPersonById").mockResolvedValue({
      customFields: { loyalty_tier: "gold", internal_note: "hidden" },
    } as never)

    await expect(
      customFields.resolveVisibleValues(fakeDb(), "person", "person_1", "invoice"),
    ).resolves.toEqual({ loyalty_tier: "gold" })
  })

  it("validates valid, invalid, required, and unknown booking fields from persisted rows", async () => {
    const update = vi
      .spyOn(bookingsService, "updateBooking")
      .mockResolvedValue({ id: "bk" } as never)
    const id = newId("bookings")

    expect(
      (
        await bookingApp().request(`/${id}`, {
          method: "PATCH",
          ...json({ customFields: { group_size: 4 } }),
        })
      ).status,
    ).toBe(200)
    expect(update).toHaveBeenCalled()

    for (const customFields of [{ group_size: "four" }, { unknown: 4 }]) {
      expect(
        (
          await bookingApp().request(`/${id}`, {
            method: "PATCH",
            ...json({ customFields }),
          })
        ).status,
      ).toBe(400)
    }

    expect(
      (
        await bookingApp().request("/", {
          method: "POST",
          ...json({ bookingNumber: "BK-DB-1", sellCurrency: "EUR" }),
        })
      ).status,
    ).toBe(400)
  })

  it("validates valid, invalid, required, and unknown relationship fields from persisted rows", async () => {
    const create = vi
      .spyOn(relationshipsService, "createPerson")
      .mockResolvedValue({ id: "pers_new" } as never)

    expect(
      (
        await relationshipsApp().request("/people", {
          method: "POST",
          ...json({
            firstName: "Jo",
            lastName: "Doe",
            customFields: { loyalty_tier: "gold" },
          }),
        })
      ).status,
    ).toBe(201)
    expect(create).toHaveBeenCalled()

    for (const customFields of [{ loyalty_tier: "bronze" }, { unknown: "gold" }, {}]) {
      expect(
        (
          await relationshipsApp().request("/people", {
            method: "POST",
            ...json({ firstName: "Jo", lastName: "Doe", customFields }),
          })
        ).status,
      ).toBe(400)
    }
  })
})
