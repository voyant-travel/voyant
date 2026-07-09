import { describe, expect, it, vi } from "vitest"

import {
  resolveManagedCustomExtensions,
  resolveManagedCustomModules,
} from "./custom-source-resolution.js"

function project(customSource: { modules?: string[]; extensions?: string[] } = {}) {
  return { customSource } as Parameters<typeof resolveManagedCustomModules>[0]
}

describe("resolveManagedCustomModules", () => {
  it("returns an empty record when the profile declares no custom modules", async () => {
    const importModule = vi.fn()
    const resolved = await resolveManagedCustomModules(project(), {}, { importModule })
    expect(resolved).toEqual({})
    expect(importModule).not.toHaveBeenCalled()
  })

  it("uses a `voyantModule` factory keyed by the package specifier", async () => {
    const factory = vi.fn(() => ({ module: { name: "loyalty" } }))
    const resolved = await resolveManagedCustomModules(
      project({ modules: ["@acme/loyalty"] }),
      { DATABASE_URL: "postgres://test" },
      { importModule: async () => ({ voyantModule: factory }) },
    )

    expect(Object.keys(resolved)).toEqual(["@acme/loyalty"])
    expect(resolved["@acme/loyalty"]?.({ capabilities: {} as never, options: {} })).toEqual({
      module: { name: "loyalty" },
    })
    expect(factory).toHaveBeenCalledWith({ capabilities: {}, options: {} })
  })

  it("accepts a `default` export that is already a Hono module object", async () => {
    const resolved = await resolveManagedCustomModules(
      project({ modules: ["@acme/cases"] }),
      {},
      {
        importModule: async () => ({ default: { module: { name: "cases" } } }),
      },
    )
    expect(resolved["@acme/cases"]?.({ capabilities: {} as never, options: {} })).toEqual({
      module: { name: "cases" },
    })
  })

  it("throws a specifier-named error when no managed-module entry is exported", async () => {
    await expect(
      resolveManagedCustomModules(
        project({ modules: ["@bad/module"] }),
        {},
        {
          importModule: async () => ({ somethingElse: true }),
        },
      ),
    ).rejects.toThrow(/@bad\/module.*does not export a managed-module entry/)
  })

  it("wraps an import failure with the specifier", async () => {
    await expect(
      resolveManagedCustomModules(
        project({ modules: ["@missing/module"] }),
        {},
        {
          importModule: async () => {
            throw new Error("Cannot find module")
          },
        },
      ),
    ).rejects.toThrow(/Failed to import custom module "@missing\/module": Cannot find module/)
  })
})

describe("resolveManagedCustomExtensions", () => {
  it("uses a `voyantExtension` factory keyed by the package specifier", async () => {
    const factory = vi.fn(() => ({ extension: { name: "source-health", module: "products" } }))
    const resolved = await resolveManagedCustomExtensions(
      project({ extensions: ["@acme/source-health"] }),
      {},
      { importModule: async () => ({ voyantExtension: factory }) },
    )

    expect(Object.keys(resolved)).toEqual(["@acme/source-health"])
    expect(resolved["@acme/source-health"]?.({ capabilities: {} as never, options: {} })).toEqual({
      extension: { name: "source-health", module: "products" },
    })
  })

  it("accepts a `default` export that is already a Hono extension object", async () => {
    const resolved = await resolveManagedCustomExtensions(
      project({ extensions: ["@acme/product-sync"] }),
      {},
      {
        importModule: async () => ({
          default: { extension: { name: "product-sync", module: "products" } },
        }),
      },
    )
    expect(resolved["@acme/product-sync"]?.({ capabilities: {} as never, options: {} })).toEqual({
      extension: { name: "product-sync", module: "products" },
    })
  })

  it("throws a specifier-named error when no managed-extension entry is exported", async () => {
    await expect(
      resolveManagedCustomExtensions(
        project({ extensions: ["@bad/extension"] }),
        {},
        {
          importModule: async () => ({ somethingElse: true }),
        },
      ),
    ).rejects.toThrow(/@bad\/extension.*does not export a managed-extension entry/)
  })

  it("wraps an import failure with the specifier", async () => {
    await expect(
      resolveManagedCustomExtensions(
        project({ extensions: ["@missing/extension"] }),
        {},
        {
          importModule: async () => {
            throw new Error("Cannot find module")
          },
        },
      ),
    ).rejects.toThrow(/Failed to import custom extension "@missing\/extension": Cannot find module/)
  })
})
