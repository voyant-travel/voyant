import { describe, expect, it, vi } from "vitest"

import { asTypesenseClient } from "./typesense-sdk-client.js"

describe("asTypesenseClient", () => {
  it("lists collections through the SDK collection-list retrieve method", async () => {
    const schemas = [{ name: "products__en-GB__customer__default", fields: [] }]
    const retrieve = vi.fn(async () => schemas)
    const collections = vi.fn((name?: string) =>
      name
        ? {
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            retrieve: vi.fn(),
            documents: () => ({ import: vi.fn(), delete: vi.fn(), search: vi.fn() }),
          }
        : { retrieve },
    )
    const client = asTypesenseClient({ collections })

    await expect(client.collections().list()).resolves.toEqual(schemas)
    expect(retrieve).toHaveBeenCalledOnce()
  })

  it("returns SDK import results to the Catalog failure policy", async () => {
    const importResults = [{ success: false, error: "invalid document" }]
    const documents = {
      import: vi.fn(async () => {
        throw Object.assign(new Error("partial import"), { importResults })
      }),
      delete: vi.fn(),
      search: vi.fn(),
    }
    const collection = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      retrieve: vi.fn(),
      documents: () => documents,
    }
    const client = asTypesenseClient({ collections: () => collection })

    await expect(client.collections("products").documents().import([], {})).resolves.toEqual(
      importResults,
    )
  })

  it("preserves unrelated SDK errors", async () => {
    const error = new Error("connection failed")
    const collection = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      retrieve: vi.fn(),
      documents: () => ({
        import: vi.fn(async () => {
          throw error
        }),
        delete: vi.fn(),
        search: vi.fn(),
      }),
    }
    const client = asTypesenseClient({ collections: () => collection })

    await expect(client.collections("products").documents().import([], {})).rejects.toBe(error)
  })
})
