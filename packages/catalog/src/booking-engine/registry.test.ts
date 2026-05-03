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

describe("createSourceAdapterRegistry — backward-compat (register without connection id)", () => {
  it("registers an adapter under its declared kind", () => {
    const registry = createSourceAdapterRegistry()
    registry.register(stubAdapter("demo"))
    expect(registry.hasKind("demo")).toBe(true)
    expect(registry.resolveOrThrow("demo").kind).toBe("demo")
  })

  it("returns undefined for unknown kinds", () => {
    const registry = createSourceAdapterRegistry()
    expect(registry.hasKind("voyant-connect")).toBe(false)
    expect(registry.byKind("voyant-connect")).toEqual([])
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

  it("re-registering without connection id replaces under the synthetic key", () => {
    const registry = createSourceAdapterRegistry()
    const first = stubAdapter("demo")
    const second = stubAdapter("demo")
    registry.register(first)
    registry.register(second)
    expect(registry.resolveOrThrow("demo")).toBe(second)
    expect(registry.resolveByConnection("default:demo")).toBe(second)
  })

  it("kinds() lists every registered kind", () => {
    const registry = createSourceAdapterRegistry()
    registry.register(stubAdapter("demo"))
    registry.register(stubAdapter("voyant-connect"))
    expect([...registry.kinds()].sort()).toEqual(["demo", "voyant-connect"])
  })
})

describe("createSourceAdapterRegistry — per-connection registration", () => {
  it("registers and resolves by connection id", () => {
    const registry = createSourceAdapterRegistry()
    const adapter = stubAdapter("tui")
    registry.register("conn_tui_dev", adapter)
    expect(registry.has("conn_tui_dev")).toBe(true)
    expect(registry.resolveByConnection("conn_tui_dev")).toBe(adapter)
    expect(registry.resolveByConnectionOrThrow("conn_tui_dev")).toBe(adapter)
  })

  it("supports multiple connections of the same kind", () => {
    const registry = createSourceAdapterRegistry()
    const dev = stubAdapter("tui")
    const prod = stubAdapter("tui")
    registry.register("conn_tui_dev", dev)
    registry.register("conn_tui_prod", prod)

    expect(registry.resolveByConnection("conn_tui_dev")).toBe(dev)
    expect(registry.resolveByConnection("conn_tui_prod")).toBe(prod)

    const both = registry.byKind("tui")
    expect(both.map((e) => e.connectionId).sort()).toEqual(["conn_tui_dev", "conn_tui_prod"])
  })

  it("byKind returns empty array for unknown kind", () => {
    const registry = createSourceAdapterRegistry()
    expect(registry.byKind("nope")).toEqual([])
  })

  it("resolveByConnectionOrThrow throws on miss", () => {
    const registry = createSourceAdapterRegistry()
    expect(() => registry.resolveByConnectionOrThrow("conn_x")).toThrowError(
      NoAdapterRegisteredError,
    )
  })

  it("re-registering same connection id replaces and updates kind index", () => {
    const registry = createSourceAdapterRegistry()
    registry.register("conn_x", stubAdapter("tui"))
    registry.register("conn_x", stubAdapter("voyant-connect"))
    expect(registry.byKind("tui")).toEqual([])
    expect(registry.byKind("voyant-connect").map((e) => e.connectionId)).toEqual(["conn_x"])
  })

  it("connections() returns every registered id", () => {
    const registry = createSourceAdapterRegistry()
    registry.register("conn_a", stubAdapter("tui"))
    registry.register("conn_b", stubAdapter("voyant-connect"))
    expect([...registry.connections()].sort()).toEqual(["conn_a", "conn_b"])
  })

  it("rejects register(connectionId) without an adapter argument", () => {
    const registry = createSourceAdapterRegistry()
    // @ts-expect-error — missing adapter argument
    expect(() => registry.register("conn_x")).toThrowError(TypeError)
  })
})

describe("createSourceAdapterRegistry — outbound-only adapters", () => {
  it("accepts adapters with no inbound methods", () => {
    const outboundOnly: SourceAdapter = {
      kind: "syndicate-target",
      capabilities: {
        verticals: ["products"],
        supportsLiveResolution: false,
        supportsDriftDetection: false,
        supportsBookingForwarding: false,
        postBookOperations: [],
        supportsBookingPush: true,
        supportsAvailabilityPush: true,
        supportsContentPush: true,
      },
      pushBooking: async () => ({ upstreamRef: "ext_1" }),
      pushAvailability: async () => ({}),
      pushContent: async () => ({}),
    }
    const registry = createSourceAdapterRegistry()
    registry.register("conn_syn_a", outboundOnly)
    expect(registry.resolveByConnection("conn_syn_a")).toBe(outboundOnly)
    expect(registry.byKind("syndicate-target").length).toBe(1)
  })
})
