import { describe, expect, it, vi } from "vitest"

import { resolveManagedPlugins } from "./plugin-resolution.js"

function project(plugins: string[], settings: Record<string, unknown> = {}) {
  return { plugins, settings } as Parameters<typeof resolveManagedPlugins>[0]
}

describe("resolveManagedPlugins", () => {
  it("returns an empty list when the profile declares no plugins", async () => {
    const importModule = vi.fn()
    const resolved = await resolveManagedPlugins(project([]), {}, { importModule })
    expect(resolved).toEqual([])
    expect(importModule).not.toHaveBeenCalled()
  })

  it("invokes a `voyantPlugin` factory with settings + env and returns the bundle", async () => {
    const env = { STRIPE_SECRET: "sk_test" }
    const factory = vi.fn((ctx) => ({ name: "stripe", context: ctx }))
    const resolved = await resolveManagedPlugins(
      project(["@voyant-travel/plugin-stripe"], {
        "@voyant-travel/plugin-stripe": { mode: "live" },
      }),
      env,
      { importModule: async () => ({ voyantPlugin: factory }) },
    )

    expect(factory).toHaveBeenCalledWith({
      specifier: "@voyant-travel/plugin-stripe",
      settings: { mode: "live" },
      env,
    })
    expect(resolved).toHaveLength(1)
    expect((resolved[0] as { name: string }).name).toBe("stripe")
  })

  it("accepts a `default` export that is already a built plugin object", async () => {
    const resolved = await resolveManagedPlugins(
      project(["@acme/plugin"]),
      {},
      {
        importModule: async () => ({ default: { name: "acme" } }),
      },
    )
    expect((resolved[0] as { name: string }).name).toBe("acme")
  })

  it("resolves plugins in profile order", async () => {
    const resolved = await resolveManagedPlugins(
      project(["@a/one", "@b/two"]),
      {},
      {
        importModule: async (specifier) => ({
          voyantPlugin: () => ({ name: specifier }),
        }),
      },
    )
    expect(resolved.map((p) => (p as { name: string }).name)).toEqual(["@a/one", "@b/two"])
  })

  it("throws a specifier-named error when no managed-plugin entry is exported", async () => {
    await expect(
      resolveManagedPlugins(
        project(["@bad/plugin"]),
        {},
        {
          importModule: async () => ({ somethingElse: true }),
        },
      ),
    ).rejects.toThrow(/@bad\/plugin.*does not export a managed-plugin entry/)
  })

  it("wraps an import failure with the specifier", async () => {
    await expect(
      resolveManagedPlugins(
        project(["@missing/plugin"]),
        {},
        {
          importModule: async () => {
            throw new Error("Cannot find module")
          },
        },
      ),
    ).rejects.toThrow(/Failed to import managed plugin "@missing\/plugin": Cannot find module/)
  })

  it("throws when a factory returns a non-plugin value", async () => {
    await expect(
      resolveManagedPlugins(
        project(["@weird/plugin"]),
        {},
        {
          importModule: async () => ({ voyantPlugin: () => 123 }),
        },
      ),
    ).rejects.toThrow(/resolved to a value without a "name"/)
  })
})
