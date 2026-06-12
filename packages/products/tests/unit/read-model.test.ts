import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../src/service-public.js", () => ({
  publicProductsService: {
    listCatalogProducts: vi.fn(),
    getCatalogProductById: vi.fn(),
    getCatalogProductBySlug: vi.fn(),
    getCatalogProductBrochure: vi.fn(),
    listCatalogCategories: vi.fn(),
    listCatalogTags: vi.fn(),
    listCatalogDestinations: vi.fn(),
  },
}))

import { Hono } from "hono"
// Import after mock so the routes use the mocked module.
import {
  invalidateProductReadModel,
  productDocKey,
  productDocVariant,
  readThroughProductDoc,
} from "../../src/read-model.js"
import { productRoutes, readModelInvalidation } from "../../src/routes.js"
import { publicProductRoutes } from "../../src/routes-public.js"
import { publicProductsService } from "../../src/service-public.js"

const mockedService = vi.mocked(publicProductsService)

function fakeKv() {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn(async <T = string>(key: string, options?: { type?: "json" | "text" }) => {
      const value = store.get(key)
      if (value === undefined) return null
      return (options?.type === "json" ? JSON.parse(value) : value) as T | null
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    list: vi.fn(async (options?: { prefix?: string }) => ({
      keys: [...store.keys()]
        .filter((name) => !options?.prefix || name.startsWith(options.prefix))
        .map((name) => ({ name })),
    })),
  }
}

const PRODUCT = { id: "prod_abc123", slug: "alpine-tour", name: "Alpine Tour" }

beforeEach(() => {
  vi.clearAllMocks()
  mockedService.getCatalogProductById.mockResolvedValue(PRODUCT as never)
  mockedService.getCatalogProductBySlug.mockResolvedValue(PRODUCT as never)
})

describe("read-model primitives", () => {
  it("readThroughProductDoc serves the second read from KV", async () => {
    const kv = fakeKv()
    const compute = vi.fn(async () => ({ id: "prod_1" }))

    const first = await readThroughProductDoc(kv, "rm:v1:product:prod_1:default", compute)
    const second = await readThroughProductDoc(kv, "rm:v1:product:prod_1:default", compute)

    expect(first.fromReadModel).toBe(false)
    expect(second.fromReadModel).toBe(true)
    expect(second.data).toEqual({ id: "prod_1" })
    expect(compute).toHaveBeenCalledOnce()
  })

  it("never caches null compute results", async () => {
    const kv = fakeKv()
    const compute = vi.fn(async () => null)

    await readThroughProductDoc(kv, "rm:v1:product:prod_x:default", compute)
    await readThroughProductDoc(kv, "rm:v1:product:prod_x:default", compute)

    expect(compute).toHaveBeenCalledTimes(2)
    expect(kv.put).not.toHaveBeenCalled()
  })

  it("invalidateProductReadModel drops every variant for the product only", async () => {
    const kv = fakeKv()
    kv.store.set(productDocKey("prod_1", "default"), "{}")
    kv.store.set(productDocKey("prod_1", "lang=de"), "{}")
    kv.store.set(productDocKey("prod_2", "default"), "{}")

    await invalidateProductReadModel(kv, "prod_1")

    expect(kv.store.has(productDocKey("prod_1", "default"))).toBe(false)
    expect(kv.store.has(productDocKey("prod_1", "lang=de"))).toBe(false)
    expect(kv.store.has(productDocKey("prod_2", "default"))).toBe(true)
  })

  it("variant key incorporates the locale", () => {
    expect(productDocVariant({})).toBe("default")
    expect(productDocVariant({ languageTag: "de-DE" })).toBe("lang=de-DE")
  })
})

describe("public detail routes — KV document plane", () => {
  it("GET /:id serves the second request from KV without touching the service", async () => {
    const kv = fakeKv()
    const env = { CACHE: kv }

    const first = await publicProductRoutes.request(`/${PRODUCT.id}`, {}, env)
    const second = await publicProductRoutes.request(`/${PRODUCT.id}`, {}, env)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ data: PRODUCT })
    expect(mockedService.getCatalogProductById).toHaveBeenCalledOnce()
  })

  it("GET /slug/:slug shares the id-keyed document with GET /:id", async () => {
    const kv = fakeKv()
    const env = { CACHE: kv }

    await publicProductRoutes.request(`/${PRODUCT.id}`, {}, env)
    const viaSlug = await publicProductRoutes.request(`/slug/${PRODUCT.slug}`, {}, env)

    expect(viaSlug.status).toBe(200)
    expect(await viaSlug.json()).toEqual({ data: PRODUCT })
    // Slug resolution hit the service once (mapping miss), but the
    // document itself came from the shared id-keyed entry.
    expect(mockedService.getCatalogProductById).toHaveBeenCalledOnce()
  })

  it("locale variants cache independently", async () => {
    const kv = fakeKv()
    const env = { CACHE: kv }

    await publicProductRoutes.request(`/${PRODUCT.id}`, {}, env)
    await publicProductRoutes.request(`/${PRODUCT.id}?languageTag=de-DE`, {}, env)

    expect(mockedService.getCatalogProductById).toHaveBeenCalledTimes(2)
  })

  it("works without a CACHE binding (live path)", async () => {
    const first = await publicProductRoutes.request(`/${PRODUCT.id}`)
    const second = await publicProductRoutes.request(`/${PRODUCT.id}`)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(mockedService.getCatalogProductById).toHaveBeenCalledTimes(2)
  })
})

describe("admin mutation invalidation middleware", () => {
  function stubAdminApp() {
    const app = new Hono()
    // biome-ignore lint/suspicious/noExplicitAny: structural middleware shape (same cast as production mounting)
    app.use("*", readModelInvalidation() as any)
    app.patch("/:id", (c) => c.json({ ok: true }))
    app.patch("/:id/fails", (c) => c.json({ error: "nope" }, 422))
    return app
  }

  it("drops the product's cached documents after a successful mutation", async () => {
    const kv = fakeKv()
    kv.store.set(productDocKey(PRODUCT.id, "default"), JSON.stringify(PRODUCT))
    kv.store.set(productDocKey(PRODUCT.id, "lang=de"), JSON.stringify(PRODUCT))
    kv.store.set(productDocKey("prod_other", "default"), "{}")

    const res = await stubAdminApp().request(`/${PRODUCT.id}`, { method: "PATCH" }, { CACHE: kv })

    expect(res.status).toBe(200)
    expect(kv.store.has(productDocKey(PRODUCT.id, "default"))).toBe(false)
    expect(kv.store.has(productDocKey(PRODUCT.id, "lang=de"))).toBe(false)
    expect(kv.store.has(productDocKey("prod_other", "default"))).toBe(true)
  })

  it("does not invalidate on failed mutations", async () => {
    const kv = fakeKv()
    kv.store.set(productDocKey(PRODUCT.id, "default"), JSON.stringify(PRODUCT))

    const res = await stubAdminApp().request(
      `/${PRODUCT.id}/fails`,
      { method: "PATCH" },
      { CACHE: kv },
    )

    expect(res.status).toBe(422)
    expect(kv.store.has(productDocKey(PRODUCT.id, "default"))).toBe(true)
  })

  it("ignores GET requests entirely", async () => {
    const kv = fakeKv()
    kv.store.set(productDocKey(PRODUCT.id, "default"), JSON.stringify(PRODUCT))
    const app = stubAdminApp()
    app.get("/:id", (c) => c.json({ ok: true }))

    await app.request(`/${PRODUCT.id}`, { method: "GET" }, { CACHE: kv })

    expect(kv.store.has(productDocKey(PRODUCT.id, "default"))).toBe(true)
    expect(kv.list).not.toHaveBeenCalled()
  })

  it("is mounted on the assembled admin routes (no invalidation on 404s)", async () => {
    const kv = fakeKv()
    kv.store.set(productDocKey(PRODUCT.id, "default"), JSON.stringify(PRODUCT))

    const miss = await productRoutes.request(
      `/${PRODUCT.id}/definitely-not-a-route`,
      { method: "PATCH" },
      { CACHE: kv },
    )

    expect(miss.status).toBe(404)
    expect(kv.store.has(productDocKey(PRODUCT.id, "default"))).toBe(true)
  })
})
