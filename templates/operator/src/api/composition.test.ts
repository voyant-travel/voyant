import { composeFromManifest, diffManifestRegistry } from "@voyantjs/hono/composition"
import { describe, expect, it } from "vitest"

import voyantConfig from "../../voyant.config"
import {
  buildOperatorCapabilities,
  OPERATOR_RUNTIME_MANIFEST,
  operatorComposition,
} from "./composition"

function entryName(entry: string | { resolve: string }): string {
  return typeof entry === "string" ? entry : entry.resolve
}

describe("operator runtime composition", () => {
  it("registry covers the manifest exactly (no missing factories, no orphans)", () => {
    const modules = diffManifestRegistry(
      OPERATOR_RUNTIME_MANIFEST.modules,
      Object.keys(operatorComposition.modules),
    )
    expect(modules.missingFactories).toEqual([])
    expect(modules.orphanFactories).toEqual([])

    const extensions = diffManifestRegistry(
      OPERATOR_RUNTIME_MANIFEST.extensions,
      Object.keys(operatorComposition.extensions ?? {}),
    )
    expect(extensions.missingFactories).toEqual([])
    expect(extensions.orphanFactories).toEqual([])
  })

  it("composes the full module + extension set in manifest order", () => {
    const composed = composeFromManifest(
      OPERATOR_RUNTIME_MANIFEST,
      operatorComposition,
      buildOperatorCapabilities(),
    )

    // 24 manifest entries expand to 27 mounted modules because Commerce owns
    // the pricing/markets/sellability/promotions runtime cluster.
    expect(OPERATOR_RUNTIME_MANIFEST.modules).toHaveLength(24)
    expect(composed.modules).toHaveLength(27)
    expect(composed.extensions).toHaveLength(7)

    // Every composed unit is a real HonoModule/HonoExtension.
    for (const m of composed.modules) expect(m.module?.name).toBeTypeOf("string")
    for (const e of composed.extensions) expect(e.extension?.module).toBeTypeOf("string")

    // Module names are unique (no double-mount).
    const names = composed.modules.map((m) => m.module.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("every schema-migrated module (voyant.config) is actually mounted at runtime", () => {
    // The dangerous drift: a module added to voyant.config (so its tables
    // migrate) but never mounted — migrated-but-dead. Guard: voyant.config
    // modules ⊆ runtime manifest modules. (Route-only modules like
    // storefront/checkout are mounted-but-schema-less and live only in the
    // runtime manifest, which is fine.)
    //
    // Carve-out: modules whose API is mounted APP-LOCALLY instead of as a
    // package Hono module. `@voyantjs/flights` exports no Hono module — its
    // routes live in src/api/flights.ts (adapter wiring is app-specific) —
    // but it must sit in voyant.config `modules` so `voyant admin generate`
    // composes its package-delivered admin surface
    // (@voyantjs/flights-react/admin). Not migrated-but-dead: the flights
    // reference tables are served by those app-local routes.
    const APP_LOCAL_API_MODULES = new Set(["@voyantjs/flights"])
    const runtime = new Set(OPERATOR_RUNTIME_MANIFEST.modules)
    const runtimeAliases = new Map([
      ["@voyantjs/pricing", "@voyantjs/commerce"],
      ["@voyantjs/markets", "@voyantjs/commerce"],
      ["@voyantjs/sellability", "@voyantjs/commerce"],
      ["@voyantjs/promotions", "@voyantjs/commerce"],
    ])
    const schemaModules = (voyantConfig.modules ?? []).map(entryName)
    const migratedButNotMounted = schemaModules.filter(
      (name) =>
        !runtime.has(name) &&
        !runtime.has(runtimeAliases.get(name) ?? "") &&
        !APP_LOCAL_API_MODULES.has(name),
    )
    expect(migratedButNotMounted).toEqual([])
  })

  it("throws loudly when the manifest references an unregistered factory", () => {
    expect(() =>
      composeFromManifest(
        { modules: ["@voyantjs/does-not-exist"] },
        operatorComposition,
        buildOperatorCapabilities(),
      ),
    ).toThrow(/no module factory registered for "@voyantjs\/does-not-exist"/)
  })
})
