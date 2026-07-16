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
    namespace: "custom",
    key: "loyalty_tier",
    type: "select",
    label: "Tier",
    options: ["gold", "silver"],
  },
  {
    entity: "person",
    namespace: "app--test",
    key: "loyalty_tier",
    type: "select",
    label: "App tier",
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
      const db = {
        transaction: async (callback: (tx: unknown) => unknown) => callback({}),
      }
      c.set("db" as never, db)
      c.set("userId" as never, "u")
      c.set("container" as never, {
        resolve: (key: string) =>
          key === RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY
            ? {
                customFields: withRegistry ? () => registry : undefined,
                customFieldsForWrite: withRegistry ? () => registry : undefined,
              }
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
      ...json({ customFields: { custom: { typo: 1 } } }),
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
      ...json({ customFields: { custom: { loyalty_tier: "gold" } } }),
    })
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      "pers_x",
      expect.objectContaining({ customFields: { custom: { loyalty_tier: "gold" } } }),
    )
  })

  it("rejects app-owned namespaces on ordinary person routes", async () => {
    const spy = vi.spyOn(relationshipsService, "updatePerson")
    const res = await app().request("/people/pers_x", {
      method: "PATCH",
      ...json({ customFields: { "app--test": { loyalty_tier: "gold" } } }),
    })
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it("rejects custom fields when the deployment declares none (400)", async () => {
    const spy = vi.spyOn(relationshipsService, "updatePerson")
    const res = await app(false).request("/people/pers_x", {
      method: "PATCH",
      ...json({ customFields: { custom: { anything: 1 } } }),
    })
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it("an absent customFields on PATCH is a no-op (required not enforced on update)", async () => {
    const spy = vi
      .spyOn(relationshipsService, "updatePerson")
      .mockResolvedValue({ id: "pers_x" } as never)
    const res = await requiredApp().request("/people/pers_x", {
      method: "PATCH",
      ...json({ firstName: "Jo" }),
    })
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalled()
  })
})

// A registry where one person field is `required` — exercises create-time enforcement.
const requiredRegistry = createCustomFieldRegistry([
  {
    entity: "person",
    namespace: "custom",
    key: "loyalty_tier",
    type: "select",
    label: "Tier",
    options: ["gold"],
  },
  {
    entity: "person",
    namespace: "custom",
    key: "passport_no",
    type: "text",
    label: "Passport",
    required: true,
  },
  {
    entity: "person",
    namespace: "app--test",
    key: "app_required",
    type: "text",
    label: "App required",
    required: true,
  },
])

function requiredApp() {
  return new Hono()
    .onError(handleApiError)
    .use("*", async (c, next) => {
      const db = {
        transaction: async (callback: (tx: unknown) => unknown) => callback({}),
      }
      c.set("db" as never, db)
      c.set("userId" as never, "u")
      c.set("container" as never, {
        resolve: (key: string) =>
          key === RELATIONSHIPS_ROUTE_RUNTIME_CONTAINER_KEY
            ? {
                customFields: () => requiredRegistry,
                customFieldsForWrite: () => requiredRegistry,
              }
            : undefined,
      })
      await next()
    })
    .route("/", accountRoutes)
}

describe("relationships custom-fields required-on-create enforcement", () => {
  afterEach(() => vi.restoreAllMocks())

  it("rejects a create that omits customFields entirely when a field is required (400)", async () => {
    const spy = vi.spyOn(relationshipsService, "createPerson")
    const res = await requiredApp().request("/people", {
      method: "POST",
      ...json({ firstName: "Jo", lastName: "Doe" }),
    })
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it("rejects a create that supplies customFields but omits the required field (400)", async () => {
    const spy = vi.spyOn(relationshipsService, "createPerson")
    const res = await requiredApp().request("/people", {
      method: "POST",
      ...json({
        firstName: "Jo",
        lastName: "Doe",
        customFields: { custom: { loyalty_tier: "gold" } },
      }),
    })
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it("allows a create that supplies the required field", async () => {
    const spy = vi
      .spyOn(relationshipsService, "createPerson")
      .mockResolvedValue({ id: "pers_new" } as never)
    const res = await requiredApp().request("/people", {
      method: "POST",
      ...json({
        firstName: "Jo",
        lastName: "Doe",
        customFields: { custom: { passport_no: "X123" } },
      }),
    })
    expect(res.status).toBe(201)
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ customFields: { custom: { passport_no: "X123" } } }),
    )
  })
})
