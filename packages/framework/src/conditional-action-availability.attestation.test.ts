import { describe, expect, it } from "vitest"

import { assertVoyantGraphMcpRuntime } from "./conditional-action-availability.js"
import { createVoyantGraphRuntime } from "./runtime-lowering.js"

/** Must stay aligned with the realm registry keys in conditional-action-availability.ts. */
const FRAMEWORK_OWNED_RUNTIMES_KEY = Symbol.for("@voyant-travel/framework:graph-runtime-owned")

function emptyRuntime() {
  return createVoyantGraphRuntime({
    graphHash: "sha256:realm-attestation",
    providerSelections: {},
    entries: {},
    modules: [],
    extensions: [],
    plugins: [],
    adapters: [],
    providerUnits: [],
  })
}

describe("framework runtime realm attestation", () => {
  it("records ownership in a Symbol.for registry on globalThis", () => {
    const runtime = emptyRuntime()
    const registry = (globalThis as Record<symbol, WeakSet<object> | undefined>)[
      FRAMEWORK_OWNED_RUNTIMES_KEY
    ]
    expect(registry).toBeInstanceOf(WeakSet)
    expect(registry?.has(runtime)).toBe(true)
  })

  it("accepts a framework-owned runtime that has no conditional actions", () => {
    expect(() => assertVoyantGraphMcpRuntime(emptyRuntime())).not.toThrow()
  })

  it("rejects a structural copy that never crossed createFrameworkOwnedRuntime", () => {
    const runtime = emptyRuntime()
    expect(() => assertVoyantGraphMcpRuntime({ ...runtime })).toThrow(
      /VOYANT_GRAPH_RUNTIME_NOT_FRAMEWORK_OWNED/,
    )
  })

  it("lets a second realm-local assert agree when it only shares the Symbol.for registry", () => {
    const runtime = emptyRuntime()
    const registry = (globalThis as Record<symbol, WeakSet<object> | undefined>)[
      FRAMEWORK_OWNED_RUNTIMES_KEY
    ]
    expect(registry).toBeInstanceOf(WeakSet)
    if (!registry) throw new Error("expected realm ownership registry")

    // Mimic a Vite-bundled duplicate of this module: it does not share the
    // original module binding, only the realm-wide Symbol.for registry.
    const assertFromBundledCopy = (value: unknown) => {
      if (typeof value !== "object" || value === null || !registry.has(value)) {
        throw new Error(
          "VOYANT_GRAPH_RUNTIME_NOT_FRAMEWORK_OWNED: MCP registration requires a runtime created by the framework.",
        )
      }
    }

    expect(() => assertFromBundledCopy(runtime)).not.toThrow()
    expect(() => assertFromBundledCopy({ ...runtime })).toThrow(
      /VOYANT_GRAPH_RUNTIME_NOT_FRAMEWORK_OWNED/,
    )
  })
})
