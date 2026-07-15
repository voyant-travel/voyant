import { describe, expect, it } from "vitest"
import {
  type CompositionRegistry,
  composeFromManifest,
  diffManifestRegistry,
} from "../../src/composition.js"
import type { ApiExtension, ApiModule } from "../../src/module.js"

interface Caps {
  prefix: string
}

const mod = (name: string): ApiModule => ({ module: { name } })
const ext = (module: string): ApiExtension => ({ extension: { name: module, module } })

const registry: CompositionRegistry<Caps> = {
  modules: {
    "@voyant-travel/a": () => mod("a"),
    "@voyant-travel/b": ({ capabilities, options }) =>
      mod(`${capabilities.prefix}:b:${options.flavor ?? "default"}`),
  },
  extensions: {
    "@voyant-travel/x/ext": () => ext("x"),
  },
}

describe("composeFromManifest", () => {
  it("derives modules + extensions in manifest order, passing caps + options", () => {
    const result = composeFromManifest(
      {
        modules: ["@voyant-travel/b", "@voyant-travel/a"],
        extensions: ["@voyant-travel/x/ext"],
      },
      registry,
      { prefix: "op" },
    )
    // Order preserved (b before a, as listed).
    expect(result.modules.map((m) => m.module.name)).toEqual(["op:b:default", "a"])
    expect(result.extensions.map((e) => e.extension.module)).toEqual(["x"])
  })

  it("passes per-entry options to the factory", () => {
    const result = composeFromManifest(
      { modules: [{ resolve: "@voyant-travel/b", options: { flavor: "spicy" } }] },
      registry,
      { prefix: "op" },
    )
    expect(result.modules[0]?.module.name).toBe("op:b:spicy")
  })

  it("flattens multi-module factories in manifest order", () => {
    const result = composeFromManifest(
      {
        modules: ["@voyant-travel/a", "@voyant-travel/commercial-cluster", "@voyant-travel/b"],
      },
      {
        ...registry,
        modules: {
          ...registry.modules,
          "@voyant-travel/commercial-cluster": () => [mod("pricing"), mod("markets")],
        },
      },
      { prefix: "op" },
    )

    expect(result.modules.map((m) => m.module.name)).toEqual([
      "a",
      "pricing",
      "markets",
      "op:b:default",
    ])
  })

  it("throws when a manifest module has no registered factory", () => {
    expect(() =>
      composeFromManifest({ modules: ["@voyant-travel/missing"] }, registry, { prefix: "op" }),
    ).toThrow(/no module factory registered for "@voyant-travel\/missing"/)
  })

  it("throws when a manifest extension has no registered factory", () => {
    expect(() =>
      composeFromManifest({ extensions: ["@voyant-travel/missing/ext"] }, registry, {
        prefix: "op",
      }),
    ).toThrow(/no extension factory registered for "@voyant-travel\/missing\/ext"/)
  })
})

describe("diffManifestRegistry", () => {
  it("reports manifest entries with no factory and orphan factories", () => {
    const diff = diffManifestRegistry(
      ["@voyant-travel/a", "@voyant-travel/missing"],
      ["@voyant-travel/a", "@voyant-travel/orphan"],
    )
    expect(diff.missingFactories).toEqual(["@voyant-travel/missing"])
    expect(diff.orphanFactories).toEqual(["@voyant-travel/orphan"])
  })

  it("is clean when manifest and registry match (entries normalized)", () => {
    const diff = diffManifestRegistry(
      [{ resolve: "@voyant-travel/a" }, "@voyant-travel/b"],
      ["@voyant-travel/b", "@voyant-travel/a"],
    )
    expect(diff.missingFactories).toEqual([])
    expect(diff.orphanFactories).toEqual([])
  })
})
