import { describe, expect, it } from "vitest"

import {
  defineVoyantConfig,
  resolveEntry,
  type VoyantConfig,
  validateVoyantConfig,
} from "../../src/config.js"

describe("defineVoyantConfig", () => {
  it("returns the config unchanged", () => {
    const config = defineVoyantConfig({
      modules: ["crm", "bookings"],
      plugins: ["payload-cms"],
      deployment: "cloudflare-worker",
      admin: { enabled: true, path: "/app" },
    })

    expect(config.modules).toEqual(["crm", "bookings"])
    expect(config.plugins).toEqual(["payload-cms"])
    expect(config.deployment).toBe("cloudflare-worker")
    expect(config.admin).toEqual({ enabled: true, path: "/app" })
  })

  it("preserves unknown fields through the identity helper", () => {
    const config = defineVoyantConfig({
      modules: ["crm"],
      featureFlags: { links_enabled: true },
      projectConfig: {
        database: { urlEnv: "DATABASE_URL", adapter: "serverless" },
      },
    })

    expect(config.featureFlags).toEqual({ links_enabled: true })
    expect(config.projectConfig?.database?.adapter).toBe("serverless")
  })

  it("accepts inline module descriptors with options", () => {
    const config = defineVoyantConfig({
      modules: ["crm", { resolve: "./src/modules/custom", options: { maxItems: 20 } }],
    })

    expect(config.modules).toHaveLength(2)
    const custom = config.modules?.[1]
    expect(typeof custom).toBe("object")
    if (typeof custom === "object") {
      expect(custom.resolve).toBe("./src/modules/custom")
      expect(custom.options).toEqual({ maxItems: 20 })
    }
  })
})

describe("validateVoyantConfig", () => {
  it("accepts an empty object", () => {
    const result = validateVoyantConfig({})
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it("accepts a fully-populated valid config", () => {
    const config: VoyantConfig = {
      projectConfig: {
        database: { urlEnv: "DATABASE_URL", adapter: "node" },
        cache: { provider: "postgres" },
        auth: { provider: "better-auth" },
      },
      admin: { enabled: true, path: "/app", backendUrl: "https://api.example.com" },
      modules: ["crm", { resolve: "custom", options: {} }],
      plugins: ["payload-cms", { resolve: "bokun" }],
      featureFlags: { links_enabled: true, query_graph: false },
      deployment: "cloudflare-worker",
    }
    const result = validateVoyantConfig(config)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it("rejects non-object input", () => {
    expect(validateVoyantConfig(null).ok).toBe(false)
    expect(validateVoyantConfig("string").ok).toBe(false)
    expect(validateVoyantConfig(42).ok).toBe(false)
  })

  it("rejects modules that are not an array", () => {
    const result = validateVoyantConfig({ modules: "crm" })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({ path: "modules", message: "Expected an array." })
  })

  it("rejects plugins that are not an array", () => {
    const result = validateVoyantConfig({ plugins: {} })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({ path: "plugins", message: "Expected an array." })
  })

  it("rejects empty-string module entries", () => {
    const result = validateVoyantConfig({ modules: ["crm", ""] })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.path === "modules[1]")).toBe(true)
  })

  it("rejects module entries missing a resolve string", () => {
    const result = validateVoyantConfig({ modules: [{ options: {} }] })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.path === "modules[0]")).toBe(true)
  })

  it("rejects duplicate module names", () => {
    const result = validateVoyantConfig({ modules: ["crm", "bookings", "crm"] })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({
      path: "modules[2]",
      message: 'Duplicate module "crm".',
    })
  })

  it("rejects duplicate plugin names across string and object forms", () => {
    const result = validateVoyantConfig({
      plugins: ["payload-cms", { resolve: "payload-cms" }],
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({
      path: "plugins[1]",
      message: 'Duplicate plugin "payload-cms".',
    })
  })

  it("rejects admin.enabled that is not a boolean", () => {
    const result = validateVoyantConfig({ admin: { enabled: "yes" } })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({
      path: "admin.enabled",
      message: "Expected a boolean.",
    })
  })

  it("rejects admin.path that is not a string", () => {
    const result = validateVoyantConfig({ admin: { path: 42 } })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({ path: "admin.path", message: "Expected a string." })
  })

  it("rejects admin that is not an object", () => {
    const result = validateVoyantConfig({ admin: "enabled" })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({ path: "admin", message: "Expected an object." })
  })

  it("rejects featureFlags with non-boolean values", () => {
    const result = validateVoyantConfig({
      featureFlags: { a: true, b: "yes", c: false },
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({
      path: "featureFlags.b",
      message: "Expected a boolean.",
    })
  })

  it("rejects featureFlags that is not an object", () => {
    const result = validateVoyantConfig({ featureFlags: [] })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({
      path: "featureFlags",
      message: "Expected an object of booleans.",
    })
  })

  it("rejects deployment that is not a string", () => {
    const result = validateVoyantConfig({ deployment: 123 })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({ path: "deployment", message: "Expected a string." })
  })

  it("surfaces multiple issues at once", () => {
    const result = validateVoyantConfig({
      modules: [""],
      plugins: {},
      admin: { enabled: "yes" },
    })
    expect(result.ok).toBe(false)
    expect(result.issues.length).toBeGreaterThanOrEqual(3)
  })

  it("accepts additionalSchemas as module-style entries", () => {
    const result = validateVoyantConfig({
      modules: ["crm"],
      additionalSchemas: ["@voyant-travel/catalog", { resolve: "@voyant-travel/accommodations" }],
    })
    expect(result.ok).toBe(true)
  })

  it("rejects additionalSchemas that are not an array", () => {
    const result = validateVoyantConfig({ additionalSchemas: "@voyant-travel/catalog" })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({
      path: "additionalSchemas",
      message: "Expected an array.",
    })
  })

  it("rejects duplicate additionalSchemas entries", () => {
    const result = validateVoyantConfig({
      additionalSchemas: ["@voyant-travel/catalog", "@voyant-travel/catalog"],
    })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.path === "additionalSchemas[1]")).toBe(true)
  })

  it("accepts extensions as module-style entries", () => {
    const result = validateVoyantConfig({
      modules: ["crm"],
      extensions: ["@voyant-travel/catalog-authoring", { resolve: "@voyant-travel/inventory" }],
    })
    expect(result.ok).toBe(true)
  })

  it("rejects extensions that are not an array", () => {
    const result = validateVoyantConfig({ extensions: "@voyant-travel/catalog-authoring" })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({ path: "extensions", message: "Expected an array." })
  })

  it("rejects duplicate extension entries", () => {
    const result = validateVoyantConfig({
      extensions: ["@voyant-travel/catalog-authoring", "@voyant-travel/catalog-authoring"],
    })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.path === "extensions[1]")).toBe(true)
  })

  it("accepts schemas as an array of file-path strings", () => {
    const result = validateVoyantConfig({ schemas: ["./src/db/schema.ts"] })
    expect(result.ok).toBe(true)
  })

  it("rejects schemas that are not an array", () => {
    const result = validateVoyantConfig({ schemas: "./src/db/schema.ts" })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({
      path: "schemas",
      message: "Expected an array of file-path strings.",
    })
  })

  it("rejects empty-string schemas entries", () => {
    const result = validateVoyantConfig({ schemas: ["./ok.ts", ""] })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.path === "schemas[1]")).toBe(true)
  })
})

describe("resolveEntry", () => {
  it("expands a string entry to the canonical shape", () => {
    expect(resolveEntry("crm")).toEqual({ resolve: "crm", options: {} })
  })

  it("passes object entries through with default options", () => {
    expect(resolveEntry({ resolve: "custom" })).toEqual({ resolve: "custom", options: {} })
  })

  it("preserves supplied options", () => {
    expect(resolveEntry({ resolve: "custom", options: { foo: "bar" } })).toEqual({
      resolve: "custom",
      options: { foo: "bar" },
    })
  })
})
