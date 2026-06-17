import { createCustomFieldRegistry } from "@voyant-travel/core/custom-fields"
import { handleApiError } from "@voyant-travel/hono"
import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY } from "../../src/route-runtime.js"
import { accountRoutes } from "../../src/routes/accounts.js"
import { relationshipsService } from "../../src/service/index.js"

const registry = createCustomFieldRegistry([
  {
    entity: "person",
    key: "loyalty_tier",
    type: "select",
    label: "Tier",
    options: ["gold", "silver"],
  },
])

const json = (body: Record<string, unknown>) => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

function app(withRegistry = true) {
  return new Hono()
    .onError(handleApiError)
    .use("*", async (c, next) => {
      c.set("db" as never, {})
      c.set("userId" as never, "u")
      c.set("container" as never, {
        resolve: (key: string) =>
          key === RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY
            ? { customFields: withRegistry ? () => registry : undefined }
            : undefined,
      })
      await next()
    })
    .route("/", accountRoutes)
}

describe("relationships person custom-fields validation", () => {
  afterEach(() => vi.restoreAllMocks())

  it("rejects an unknown custom field (400, service not called)", async () => {
    const spy = vi.spyOn(relationshipsService, "updatePerson")
    const res = await app().request("/people/pers_x", {
      method: "PATCH",
      ...json({ customFields: { typo: 1 } }),
    })
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it("passes validated custom fields through to the service", async () => {
    const spy = vi
      .spyOn(relationshipsService, "updatePerson")
      .mockResolvedValue({ id: "pers_x" } as never)
    const res = await app().request("/people/pers_x", {
      method: "PATCH",
      ...json({ customFields: { loyalty_tier: "gold" } }),
    })
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      "pers_x",
      expect.objectContaining({ customFields: { loyalty_tier: "gold" } }),
    )
  })

  it("rejects custom fields when the deployment declares none (400)", async () => {
    const spy = vi.spyOn(relationshipsService, "updatePerson")
    const res = await app(false).request("/people/pers_x", {
      method: "PATCH",
      ...json({ customFields: { anything: 1 } }),
    })
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })
})
