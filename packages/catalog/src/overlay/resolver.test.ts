import { describe, expect, it } from "vitest"

import { createFieldPolicyRegistry, defineFieldPolicy } from "../contract.js"
import {
  applyMerge,
  type ResolverOverlay,
  type ResolverScope,
  resolveOverlay,
  variantFallbackChain,
} from "./resolver.js"
import { OVERLAY_DEFAULT_SCOPE } from "./schema.js"

const merchandisable = {
  class: "merchandisable" as const,
  merge: "replace" as const,
  editRole: "marketing" as const,
  overrideFriction: "none" as const,
  snapshot: "on-book" as const,
}

describe("variantFallbackChain", () => {
  it("walks 8 steps from most-specific to least-specific", () => {
    const scope: ResolverScope = {
      locale: "en-GB",
      audience: "customer",
      market: "UK",
      actor: "customer",
    }
    const chain = variantFallbackChain(scope)
    expect(chain).toHaveLength(8)
    expect(chain[0]).toEqual({ locale: "en-GB", audience: "customer", market: "UK" })
    expect(chain[7]).toEqual({
      locale: OVERLAY_DEFAULT_SCOPE,
      audience: OVERLAY_DEFAULT_SCOPE,
      market: OVERLAY_DEFAULT_SCOPE,
    })
  })
})

describe("applyMerge", () => {
  const policy = (merge: "replace" | "additive-set" | "additive-list" | "list-position") => ({
    path: "field",
    class: "merchandisable" as const,
    merge,
    drift: "none" as const,
    reindex: "none" as const,
    snapshot: "never" as const,
    query: "blob-only" as const,
    localized: false,
    visibility: ["staff" as const],
    editRole: "none" as const,
    overrideFriction: "none" as const,
    sourceFreshness: null,
  })

  it("replace returns the overlay value", () => {
    expect(applyMerge(policy("replace"), "source", "overlay")).toBe("overlay")
  })

  it("additive-set unions arrays preserving first-occurrence order", () => {
    expect(applyMerge(policy("additive-set"), ["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"])
  })

  it("additive-list concatenates arrays without dedupe", () => {
    expect(applyMerge(policy("additive-list"), ["a"], ["a", "b"])).toEqual(["a", "a", "b"])
  })

  it("list-position sparsely overrides positions", () => {
    expect(applyMerge(policy("list-position"), ["x", "y", "z"], { 1: "Y" })).toEqual([
      "x",
      "Y",
      "z",
    ])
  })

  it("source-only throws when an overlay is passed", () => {
    expect(() =>
      applyMerge({ ...policy("replace"), merge: "source-only" }, "source", "overlay"),
    ).toThrow(/source-only/)
  })
})

describe("resolveOverlay", () => {
  const policies = defineFieldPolicy([
    { path: "title", ...merchandisable, localized: true, visibility: ["staff", "customer"] },
    { path: "description", ...merchandisable, visibility: ["staff", "customer"] },
    {
      path: "internal_notes",
      ...merchandisable,
      editRole: "ops",
      visibility: ["staff"],
    },
  ])
  const registry = createFieldPolicyRegistry(policies)

  it("applies an exact-match overlay and records provenance", () => {
    const source = new Map([["title", "Source title"]])
    const overlays: ResolverOverlay[] = [
      {
        field_path: "title",
        locale: "en-GB",
        audience: "customer",
        market: "UK",
        value: "Marketing title",
      },
    ]
    const view = resolveOverlay(registry, source, overlays, {
      locale: "en-GB",
      audience: "customer",
      market: "UK",
      actor: "customer",
    })
    expect(view.values.get("title")).toBe("Marketing title")
    expect(view.provenance.get("title")).toEqual({
      locale: "en-GB",
      audience: "customer",
      market: "UK",
    })
  })

  it("falls back from market=UK to market=default when no UK overlay exists", () => {
    const source = new Map([["title", "Source title"]])
    const overlays: ResolverOverlay[] = [
      {
        field_path: "title",
        locale: "en-GB",
        audience: "customer",
        market: OVERLAY_DEFAULT_SCOPE,
        value: "Default-market title",
      },
    ]
    const view = resolveOverlay(registry, source, overlays, {
      locale: "en-GB",
      audience: "customer",
      market: "UK",
      actor: "customer",
    })
    expect(view.values.get("title")).toBe("Default-market title")
    expect(view.provenance.get("title")?.market).toBe(OVERLAY_DEFAULT_SCOPE)
  })

  it("returns the source value when no overlay matches at any fallback level", () => {
    const source = new Map([["title", "Source title"]])
    const view = resolveOverlay(registry, source, [], {
      locale: "en-GB",
      audience: "customer",
      market: "UK",
      actor: "customer",
    })
    expect(view.values.get("title")).toBe("Source title")
    expect(view.provenance.get("title")).toBeNull()
  })

  it("hides fields not visible to the requesting actor", () => {
    const source = new Map([
      ["title", "Source title"],
      ["internal_notes", "Internal note"],
    ])
    const view = resolveOverlay(registry, source, [], {
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      actor: "customer",
    })
    expect(view.values.has("title")).toBe(true)
    expect(view.values.has("internal_notes")).toBe(false)
    expect(view.hidden.has("internal_notes")).toBe(true)
  })

  it("ignores overlays whose field is not in the registry", () => {
    const source = new Map([["title", "Source title"]])
    const overlays: ResolverOverlay[] = [
      {
        field_path: "title",
        locale: "en-GB",
        audience: "customer",
        market: OVERLAY_DEFAULT_SCOPE,
        value: "Marketing title",
      },
    ]
    const view = resolveOverlay(registry, source, overlays, {
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      actor: "customer",
    })
    // Source contains "title", but not "phantom" — the resolver should
    // skip "phantom" because it's not in the registry, but apply title.
    const sourceWithPhantom = new Map([
      ["title", "Source title"],
      ["phantom", "shouldn't appear"],
    ])
    const phantomView = resolveOverlay(registry, sourceWithPhantom, overlays, {
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      actor: "customer",
    })
    expect(phantomView.values.has("phantom")).toBe(false)
    expect(view.values.get("title")).toBe("Marketing title")
  })

  it("can resolve an overlay-only localized field absent from the source projection", () => {
    const overlays: ResolverOverlay[] = [
      {
        field_path: "title",
        locale: "ro-RO",
        audience: "customer",
        market: OVERLAY_DEFAULT_SCOPE,
        value: "Titlu romanesc",
      },
    ]

    const view = resolveOverlay(registry, new Map(), overlays, {
      locale: "ro-RO",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      actor: "customer",
    })

    expect(view.values.get("title")).toBe("Titlu romanesc")
    expect(view.provenance.get("title")).toEqual({
      locale: "ro-RO",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
    })
  })

  it("does not use default-locale overlays as requested-locale translations", () => {
    const overlays: ResolverOverlay[] = [
      {
        field_path: "title",
        locale: OVERLAY_DEFAULT_SCOPE,
        audience: "customer",
        market: OVERLAY_DEFAULT_SCOPE,
        value: "Default copy",
      },
      {
        field_path: "description",
        locale: OVERLAY_DEFAULT_SCOPE,
        audience: "customer",
        market: OVERLAY_DEFAULT_SCOPE,
        value: "Locale neutral",
      },
    ]

    const view = resolveOverlay(registry, new Map([["title", "Source title"]]), overlays, {
      locale: "ro-RO",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      actor: "customer",
    })

    expect(view.values.get("title")).toBe("Source title")
    expect(view.values.get("description")).toBe("Locale neutral")
  })

  it("keeps non-root content-node overlays out of the flat projection resolver", () => {
    const overlays: ResolverOverlay[] = [
      {
        field_path: "description",
        node_kind: "itinerary-day",
        node_key: "day-1",
        locale: "en-GB",
        audience: "customer",
        market: OVERLAY_DEFAULT_SCOPE,
        value: "Day copy",
      },
    ]

    const view = resolveOverlay(registry, new Map([["description", "Root copy"]]), overlays, {
      locale: "en-GB",
      audience: "customer",
      market: OVERLAY_DEFAULT_SCOPE,
      actor: "customer",
    })

    expect(view.values.get("description")).toBe("Root copy")
  })
})
