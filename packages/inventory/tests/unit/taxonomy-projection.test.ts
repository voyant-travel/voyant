import { describe, expect, it } from "vitest"

import { __test__ } from "../../src/service-catalog-plane-taxonomy.js"

const { buildTaxonomyProjection } = __test__

interface CategoryRow {
  id: string
  parentId: string | null
  name: string
  slug: string
  active: boolean
}

function cat(
  id: string,
  name: string,
  parentId: string | null = null,
  slug = name.toLowerCase().replace(/\s+/g, "-"),
  active = true,
): CategoryRow {
  return { id, name, slug, parentId, active }
}

describe("buildTaxonomyProjection", () => {
  it("emits empty projection when no links and no tags", () => {
    const out = buildTaxonomyProjection([], new Map(), [])
    expect(out.categoryIds).toEqual([])
    expect(out.categoryNames).toEqual([])
    expect(out.categorySlugs).toEqual([])
    expect(out.primaryCategoryId).toBeNull()
    expect(out.primaryCategoryName).toBeNull()
    expect(out.primaryCategorySlug).toBeNull()
    expect(out.tagIds).toEqual([])
    expect(out.tagLabels).toEqual([])
  })

  it("emits direct link with no ancestors when category has no parent", () => {
    const resolved = new Map([["cat_a", cat("cat_a", "Adventure")]])
    const out = buildTaxonomyProjection([{ categoryId: "cat_a", sortOrder: 0 }], resolved, [])
    expect(out.categoryNames).toEqual(["Adventure"])
    expect(out.categoryIds).toEqual(["cat_a"])
    expect(out.categorySlugs).toEqual(["adventure"])
    expect(out.primaryCategoryName).toBe("Adventure")
  })

  it("walks parent chain so child links surface ancestor labels (Adventure filter use case)", () => {
    // Tree: Adventure > Hiking > Mountain Hiking
    const resolved = new Map([
      ["cat_adv", cat("cat_adv", "Adventure")],
      ["cat_hik", cat("cat_hik", "Hiking", "cat_adv")],
      ["cat_mtn", cat("cat_mtn", "Mountain Hiking", "cat_hik")],
    ])
    const out = buildTaxonomyProjection([{ categoryId: "cat_mtn", sortOrder: 0 }], resolved, [])
    // Direct-link first, then ancestors walking up.
    expect(out.categoryNames).toEqual(["Mountain Hiking", "Hiking", "Adventure"])
    expect(out.categoryIds).toEqual(["cat_mtn", "cat_hik", "cat_adv"])
  })

  it("dedupes when multiple direct links share the same ancestor", () => {
    // Two leaves under the same parent — Adventure must appear once.
    const resolved = new Map([
      ["cat_adv", cat("cat_adv", "Adventure")],
      ["cat_hik", cat("cat_hik", "Hiking", "cat_adv")],
      ["cat_clm", cat("cat_clm", "Climbing", "cat_adv")],
    ])
    const out = buildTaxonomyProjection(
      [
        { categoryId: "cat_hik", sortOrder: 1 },
        { categoryId: "cat_clm", sortOrder: 2 },
      ],
      resolved,
      [],
    )
    expect(out.categoryNames).toEqual(["Hiking", "Climbing", "Adventure"])
    expect(new Set(out.categoryIds).size).toBe(out.categoryIds.length)
  })

  it("stops the chain at an inactive ancestor (resolved map omits it)", () => {
    // Ancestor walk reads from the resolved map. The fetcher filters
    // inactive rows out, so a paused parent is absent from the map and the
    // chain truncates there.
    const resolved = new Map([
      // cat_adv is intentionally omitted (operator paused it).
      ["cat_hik", cat("cat_hik", "Hiking", "cat_adv")],
    ])
    const out = buildTaxonomyProjection([{ categoryId: "cat_hik", sortOrder: 0 }], resolved, [])
    expect(out.categoryNames).toEqual(["Hiking"])
    expect(out.categoryIds).toEqual(["cat_hik"])
  })

  it("primary = lowest sortOrder direct link, regardless of category-row name order", () => {
    const resolved = new Map([
      ["cat_z", cat("cat_z", "Zebra")],
      ["cat_a", cat("cat_a", "Apple")],
    ])
    const out = buildTaxonomyProjection(
      [
        { categoryId: "cat_z", sortOrder: 0 }, // pinned first
        { categoryId: "cat_a", sortOrder: 1 },
      ],
      resolved,
      [],
    )
    expect(out.primaryCategoryId).toBe("cat_z")
    expect(out.primaryCategoryName).toBe("Zebra")
  })

  it("breaks sortOrder ties by category name asc", () => {
    const resolved = new Map([
      ["cat_z", cat("cat_z", "Zebra")],
      ["cat_a", cat("cat_a", "Apple")],
    ])
    const out = buildTaxonomyProjection(
      [
        { categoryId: "cat_z", sortOrder: 0 },
        { categoryId: "cat_a", sortOrder: 0 },
      ],
      resolved,
      [],
    )
    expect(out.primaryCategoryId).toBe("cat_a")
  })

  it("primary is null when every direct link resolved as inactive (missing from map)", () => {
    // Direct link exists in the join but the category is paused — inactive
    // row was filtered upstream, so the resolved map doesn't include it.
    const resolved = new Map<string, CategoryRow>()
    const out = buildTaxonomyProjection([{ categoryId: "cat_paused", sortOrder: 0 }], resolved, [])
    expect(out.primaryCategoryId).toBeNull()
    expect(out.primaryCategoryName).toBeNull()
  })

  it("emits tag labels and ids preserving fetch order", () => {
    const out = buildTaxonomyProjection([], new Map(), [
      { id: "tag_1", name: "Family-friendly" },
      { id: "tag_2", name: "Eco" },
    ])
    expect(out.tagLabels).toEqual(["Family-friendly", "Eco"])
    expect(out.tagIds).toEqual(["tag_1", "tag_2"])
  })

  it("survives a parent loop (cat_a → cat_b → cat_a) without infinite walking", () => {
    // Misconfigured data: a loop in parentId. Per-walk guard catches it.
    const resolved = new Map([
      ["cat_a", cat("cat_a", "A", "cat_b")],
      ["cat_b", cat("cat_b", "B", "cat_a")],
    ])
    const out = buildTaxonomyProjection([{ categoryId: "cat_a", sortOrder: 0 }], resolved, [])
    // Both walked once, then guard stops the cycle.
    expect(out.categoryIds.sort()).toEqual(["cat_a", "cat_b"])
  })

  describe("locale overrides (#502)", () => {
    it("uses translated names when the override map has an entry", () => {
      const resolved = new Map([
        ["cat_adv", cat("cat_adv", "Adventure")],
        ["cat_hik", cat("cat_hik", "Hiking", "cat_adv")],
      ])
      const overrides = new Map([
        ["cat_adv", "Aventure"],
        ["cat_hik", "Randonnée"],
      ])
      const out = buildTaxonomyProjection(
        [{ categoryId: "cat_hik", sortOrder: 0 }],
        resolved,
        [],
        overrides,
      )
      expect(out.categoryNames).toEqual(["Randonnée", "Aventure"])
      // Slugs and ids stay canonical regardless of locale.
      expect(out.categorySlugs).toEqual(["hiking", "adventure"])
      expect(out.categoryIds).toEqual(["cat_hik", "cat_adv"])
    })

    it("falls back to canonical name when an override entry is missing", () => {
      // it-IT translation exists for Hiking but not for Adventure → only
      // Hiking is translated; Adventure stays canonical.
      const resolved = new Map([
        ["cat_adv", cat("cat_adv", "Adventure")],
        ["cat_hik", cat("cat_hik", "Hiking", "cat_adv")],
      ])
      const overrides = new Map([["cat_hik", "Escursionismo"]])
      const out = buildTaxonomyProjection(
        [{ categoryId: "cat_hik", sortOrder: 0 }],
        resolved,
        [],
        overrides,
      )
      expect(out.categoryNames).toEqual(["Escursionismo", "Adventure"])
    })

    it("primaryCategoryName follows the locale override too", () => {
      const resolved = new Map([["cat_a", cat("cat_a", "Adventure")]])
      const overrides = new Map([["cat_a", "Aventure"]])
      const out = buildTaxonomyProjection(
        [{ categoryId: "cat_a", sortOrder: 0 }],
        resolved,
        [],
        overrides,
      )
      expect(out.primaryCategoryName).toBe("Aventure")
    })

    it("tag labels use the locale override map", () => {
      const tagOverrides = new Map([["tag_fam", "Adapté aux familles"]])
      const out = buildTaxonomyProjection(
        [],
        new Map(),
        [
          { id: "tag_fam", name: "Family-friendly" },
          { id: "tag_eco", name: "Eco" },
        ],
        new Map(),
        tagOverrides,
      )
      expect(out.tagLabels).toEqual(["Adapté aux familles", "Eco"])
      // Ids stay canonical.
      expect(out.tagIds).toEqual(["tag_fam", "tag_eco"])
    })

    it("tie-break for primary uses the canonical name (stable across locales)", () => {
      // If the tie-break used translated names, an it-IT slice could pick
      // a different primary than en-GB — operators expect the badge to be
      // the same category in every locale, just rendered with a different
      // string. So tie-break stays on canonical row.name.
      const resolved = new Map([
        ["cat_z", cat("cat_z", "Zebra")],
        ["cat_a", cat("cat_a", "Apple")],
      ])
      const overrides = new Map([
        // Translation flips the lex order — Zebra → "Aardvark", Apple → "Zebra"
        ["cat_z", "Aardvark"],
        ["cat_a", "Zebra"],
      ])
      const out = buildTaxonomyProjection(
        [
          { categoryId: "cat_z", sortOrder: 0 },
          { categoryId: "cat_a", sortOrder: 0 },
        ],
        resolved,
        [],
        overrides,
      )
      // Tie-break still picks cat_a (canonical "Apple" < "Zebra"), then the
      // primary's translated label is emitted.
      expect(out.primaryCategoryId).toBe("cat_a")
      expect(out.primaryCategoryName).toBe("Zebra")
    })
  })
})
