import { createEventBus } from "@voyant-travel/core"
import { createCustomFieldRegistry } from "@voyant-travel/core/custom-fields"
import { newId } from "@voyant-travel/db/lib/typeid"
import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BOOKING_ROUTE_RUNTIME_CONTAINER_KEY } from "../../src/route-runtime.js"
import { bookingRoutes } from "../../src/routes.js"
import { bookingsService } from "../../src/service.js"

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

const registry = createCustomFieldRegistry([
  { entity: "booking", key: "tour_guide", type: "text", label: "Tour guide" },
  { entity: "booking", key: "group_size", type: "number", label: "Group size" },
])

/** Mount the booking routes with an optional custom-field registry on the runtime. */
function appWithCustomFields(opts: { withRegistry: boolean }) {
  return new Hono()
    .onError(handleApiError)
    .use("*", async (c, next) => {
      c.set("db" as never, {})
      c.set("eventBus" as never, createEventBus())
      c.set("userId" as never, "test-user")
      c.set("actor" as never, "staff")
      c.set("container" as never, {
        resolve: (key: string) =>
          key === BOOKING_ROUTE_RUNTIME_CONTAINER_KEY
            ? { customFields: opts.withRegistry ? () => registry : undefined }
            : undefined,
      })
      await next()
    })
    .route("/", bookingRoutes)
}

describe("booking route custom-fields validation", () => {
  afterEach(() => vi.restoreAllMocks())

  it("rejects an unknown custom field key (400, service not called)", async () => {
    const updateSpy = vi.spyOn(bookingsService, "updateBooking")
    const res = await appWithCustomFields({ withRegistry: true }).request(`/${newId("bookings")}`, {
      method: "PATCH",
      ...json({ customFields: { tourguide: "typo" } }),
    })
    expect(res.status).toBe(400)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("rejects a wrong-typed custom field (400)", async () => {
    const res = await appWithCustomFields({ withRegistry: true }).request(`/${newId("bookings")}`, {
      method: "PATCH",
      ...json({ customFields: { group_size: "four" } }),
    })
    expect(res.status).toBe(400)
  })

  it("passes validated custom fields through to the service", async () => {
    const updateSpy = vi
      .spyOn(bookingsService, "updateBooking")
      .mockResolvedValue({ id: "bk_x" } as never)
    const id = newId("bookings")
    const res = await appWithCustomFields({ withRegistry: true }).request(`/${id}`, {
      method: "PATCH",
      ...json({ customFields: { tour_guide: "Ana", group_size: 4 } }),
    })
    expect(res.status).toBe(200)
    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      id,
      expect.objectContaining({ customFields: { tour_guide: "Ana", group_size: 4 } }),
    )
  })

  it("rejects custom fields when the deployment declares none (400)", async () => {
    const updateSpy = vi.spyOn(bookingsService, "updateBooking")
    const res = await appWithCustomFields({ withRegistry: false }).request(
      `/${newId("bookings")}`,
      {
        method: "PATCH",
        ...json({ customFields: { anything: 1 } }),
      },
    )
    expect(res.status).toBe(400)
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
