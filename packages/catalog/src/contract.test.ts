import { describe, expect, it } from "vitest"

import {
  ancestorPaths,
  createFieldPolicyRegistry,
  defineFieldPolicy,
  FieldPolicyError,
  type FieldPolicyInput,
} from "./contract.js"

const baseLeaf: Omit<FieldPolicyInput, "path"> = {
  class: "merchandisable",
  merge: "replace",
  editRole: "marketing",
  overrideFriction: "none",
  snapshot: "on-book",
}

describe("ancestorPaths", () => {
  it("returns empty for a single-segment path", () => {
    expect(ancestorPaths("title")).toEqual([])
  })

  it("returns nearest-first for nested paths", () => {
    expect(ancestorPaths("geography.countries[].name")).toEqual([
      "geography.countries[]",
      "geography",
    ])
  })

  it("treats list[] as one segment", () => {
    expect(ancestorPaths("gallery[].caption")).toEqual(["gallery[]"])
  })
})

describe("defineFieldPolicy — required axes", () => {
  it("throws if a non-inheriting axis is missing", () => {
    expect(() =>
      defineFieldPolicy([
        // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid for the test
        { path: "title", class: "merchandisable" } as any,
      ]),
    ).toThrow(FieldPolicyError)
  })

  it("throws on duplicate paths", () => {
    expect(() =>
      defineFieldPolicy([
        { path: "title", ...baseLeaf },
        { path: "title", ...baseLeaf },
      ]),
    ).toThrow(/duplicate/)
  })

  it("throws on malformed path syntax", () => {
    expect(() => defineFieldPolicy([{ path: "with spaces", ...baseLeaf }])).toThrow(
      /invalid path segment/,
    )
  })
})

describe("defineFieldPolicy — inheritance", () => {
  it("inherits drift / reindex / query / localized / visibility / sourceFreshness from ancestor", () => {
    const policies = defineFieldPolicy([
      {
        path: "geography.countries[]",
        ...baseLeaf,
        class: "structural",
        merge: "source-only",
        editRole: "ops",
        drift: "high",
        reindex: "facet-affecting",
        query: "indexed-column",
        localized: false,
        visibility: ["staff", "customer", "partner"],
        sourceFreshness: "sync",
      },
      {
        // Leaf declares only the non-inheriting axes; everything else inherits.
        path: "geography.countries[].name",
        ...baseLeaf,
        class: "merchandisable",
        merge: "replace",
        editRole: "marketing",
      },
    ])
    const leaf = policies[1]
    expect(leaf?.drift).toBe("high")
    expect(leaf?.reindex).toBe("facet-affecting")
    expect(leaf?.query).toBe("indexed-column")
    expect(leaf?.visibility).toEqual(["staff", "customer", "partner"])
    expect(leaf?.sourceFreshness).toBe("sync")
  })

  it("applies registry defaults when no ancestor declares the inheriting axis", () => {
    const policies = defineFieldPolicy([{ path: "title", ...baseLeaf }])
    const title = policies[0]
    expect(title?.drift).toBe("none")
    expect(title?.reindex).toBe("none")
    expect(title?.query).toBe("blob-only")
    expect(title?.localized).toBe(false)
    expect(title?.visibility).toEqual(["staff"])
    expect(title?.sourceFreshness).toBeNull()
  })
})

describe("createFieldPolicyRegistry", () => {
  it("resolves exact matches first", () => {
    const policies = defineFieldPolicy([
      { path: "title", ...baseLeaf },
      { path: "gallery[]", ...baseLeaf },
      { path: "gallery[].caption", ...baseLeaf, editRole: "marketing" },
    ])
    const registry = createFieldPolicyRegistry(policies)
    expect(registry.resolve("gallery[].caption")?.path).toBe("gallery[].caption")
    expect(registry.resolve("gallery[]")?.path).toBe("gallery[]")
    expect(registry.resolve("title")?.path).toBe("title")
  })

  it("falls back to nearest ancestor when exact match is missing", () => {
    const policies = defineFieldPolicy([{ path: "geography", ...baseLeaf, class: "structural" }])
    const registry = createFieldPolicyRegistry(policies)
    // No exact policy for `geography.country` — falls back to `geography`.
    expect(registry.resolve("geography.country")?.path).toBe("geography")
  })

  it("returns undefined when no ancestor matches", () => {
    const policies = defineFieldPolicy([{ path: "title", ...baseLeaf }])
    const registry = createFieldPolicyRegistry(policies)
    expect(registry.resolve("description")).toBeUndefined()
  })
})
