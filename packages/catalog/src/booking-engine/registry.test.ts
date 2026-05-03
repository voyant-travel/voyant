import { describe, expect, it } from "vitest"

import type { SourceAdapter } from "../adapter/contract.js"

import { NoAdapterRegisteredError } from "./errors.js"
import { createSourceAdapterRegistry } from "./registry.js"

function stubAdapter(kind: string): SourceAdapter {
  // Minimal SourceAdapter conforming to the contract surface — none of
  // these methods get called by registry tests, but they need to exist
  // for the type to satisfy.
  return {
    kind,
    capabilities: {
      verticals: ["products"],
      supportsLiveResolution: false,
      supportsDriftDetection: false,
      supportsBookingForwarding: false,
      postBookOperations: [],
    },
    connect: async () => undefined,
    pause: async () => undefined,
    disconnect: async () => undefined,
    getState: async () => "active",
    discover: async () => ({ projections: [], next_cursor: undefined }),
  }
}

describe("createSourceAdapterRegistry", () => {
  it("registers an adapter under its declared kind", () => {
    const registry = createSourceAdapterRegistry()
    registry.register(stubAdapter("demo"))
    expect(registry.has("demo")).toBe(true)
    expect(registry.get("demo")?.kind).toBe("demo")
  })

  it("returns undefined for unknown kinds", () => {
    const registry = createSourceAdapterRegistry()
    expect(registry.get("voyant-connect")).toBeUndefined()
    expect(registry.has("voyant-connect")).toBe(false)
  })

  it("resolveOrThrow throws NoAdapterRegisteredError on miss", () => {
    const registry = createSourceAdapterRegistry()
    expect(() => registry.resolveOrThrow("voyant-connect")).toThrowError(NoAdapterRegisteredError)
  })

  it("resolveOrThrow returns the adapter on hit", () => {
    const registry = createSourceAdapterRegistry()
    registry.register(stubAdapter("demo"))
    const adapter = registry.resolveOrThrow("demo")
    expect(adapter.kind).toBe("demo")
  })

  it("re-registering the same kind replaces the previous adapter", () => {
    const registry = createSourceAdapterRegistry()
    const first = stubAdapter("demo")
    const second = stubAdapter("demo")
    registry.register(first)
    registry.register(second)
    expect(registry.get("demo")).toBe(second)
    expect(registry.get("demo")).not.toBe(first)
  })

  it("kinds() lists every registered kind", () => {
    const registry = createSourceAdapterRegistry()
    registry.register(stubAdapter("demo"))
    registry.register(stubAdapter("voyant-connect"))
    expect([...registry.kinds()].sort()).toEqual(["demo", "voyant-connect"])
  })
})
