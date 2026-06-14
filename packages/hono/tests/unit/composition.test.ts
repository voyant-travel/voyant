import { describe, expect, it } from "vitest"
import {
  type CompositionRegistry,
  composeFromManifest,
  diffManifestRegistry,
} from "../../src/composition.js"
import type { HonoExtension, HonoModule } from "../../src/module.js"

interface Caps {
  prefix: string
}

const mod = (name: string): HonoModule => ({ module: { name } })
const ext = (module: string): HonoExtension => ({ extension: { name: module, module } })

const registry: CompositionRegistry<Caps> = {
  modules: {
    "@voyantjs/a": () => mod("a"),
    "@voyantjs/b": ({ capabilities, options }) =>
      mod(`${capabilities.prefix}:b:${options.flavor ?? "default"}`),
  },
  extensions: {
    "@voyantjs/x/ext": () => ext("x"),
  },
}

describe("composeFromManifest", () => {
  it("derives modules + extensions in manifest order, passing caps + options", () => {
    const result = composeFromManifest(
      {
        modules: ["@voyantjs/b", "@voyantjs/a"],
        extensions: ["@voyantjs/x/ext"],
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
      { modules: [{ resolve: "@voyantjs/b", options: { flavor: "spicy" } }] },
      registry,
      { prefix: "op" },
    )
    expect(result.modules[0]?.module.name).toBe("op:b:spicy")
  })

  it("flattens multi-module factories in manifest order", () => {
    const result = composeFromManifest(
      {
        modules: ["@voyantjs/a", "@voyantjs/commercial-cluster", "@voyantjs/b"],
      },
      {
        ...registry,
        modules: {
          ...registry.modules,
          "@voyantjs/commercial-cluster": () => [mod("pricing"), mod("markets")],
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
      composeFromManifest({ modules: ["@voyantjs/missing"] }, registry, { prefix: "op" }),
    ).toThrow(/no module factory registered for "@voyantjs\/missing"/)
  })

  it("throws when a manifest extension has no registered factory", () => {
    expect(() =>
      composeFromManifest({ extensions: ["@voyantjs/missing/ext"] }, registry, { prefix: "op" }),
    ).toThrow(/no extension factory registered for "@voyantjs\/missing\/ext"/)
  })
})

describe("diffManifestRegistry", () => {
  it("reports manifest entries with no factory and orphan factories", () => {
    const diff = diffManifestRegistry(
      ["@voyantjs/a", "@voyantjs/missing"],
      ["@voyantjs/a", "@voyantjs/orphan"],
    )
    expect(diff.missingFactories).toEqual(["@voyantjs/missing"])
    expect(diff.orphanFactories).toEqual(["@voyantjs/orphan"])
  })

  it("is clean when manifest and registry match (entries normalized)", () => {
    const diff = diffManifestRegistry(
      [{ resolve: "@voyantjs/a" }, "@voyantjs/b"],
      ["@voyantjs/b", "@voyantjs/a"],
    )
    expect(diff.missingFactories).toEqual([])
    expect(diff.orphanFactories).toEqual([])
  })
})
