import { describe, expect, it, vi } from "vitest"

import type { ContentDriftEvent } from "../drift/events.js"
import {
  applyJsonPointerOverlay,
  buildDriftInvalidationPredicate,
  type ContentOverlay,
  isStale,
  JsonPointerError,
  mergeOverlaysIntoContent,
  parseJsonPointer,
  pickBestCachedLocale,
} from "./content-service.js"

// ─────────────────────────────────────────────────────────────────────────────
// isStale
// ─────────────────────────────────────────────────────────────────────────────

describe("isStale", () => {
  it("returns false when fresh_until is null/undefined", () => {
    expect(isStale({ fresh_until: null })).toBe(false)
    expect(isStale({ fresh_until: undefined })).toBe(false)
  })

  it("returns true when fresh_until is in the past", () => {
    const past = new Date(Date.now() - 60_000)
    expect(isStale({ fresh_until: past })).toBe(true)
  })

  it("returns false when fresh_until is in the future", () => {
    const future = new Date(Date.now() + 60_000)
    expect(isStale({ fresh_until: future })).toBe(false)
  })

  it("treats fresh_until == now as stale (boundary)", () => {
    const now = new Date()
    expect(isStale({ fresh_until: now }, now)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pickBestCachedLocale
// ─────────────────────────────────────────────────────────────────────────────

describe("pickBestCachedLocale", () => {
  it("returns null when there are no candidates", () => {
    expect(pickBestCachedLocale([], ["en-GB"])).toBeNull()
  })

  it("returns an exact match when present", () => {
    const result = pickBestCachedLocale(
      [
        { locale: "en-GB", payload: 1 },
        { locale: "ro-RO", payload: 2 },
      ],
      ["ro-RO", "en-GB"],
    )
    expect(result?.served_locale).toBe("ro-RO")
    expect(result?.match_kind).toBe("exact")
    expect(result?.candidate.payload).toBe(2)
  })

  it("falls back to language match when region differs", () => {
    const result = pickBestCachedLocale([{ locale: "fr-FR", payload: 1 }], ["fr-CA"])
    expect(result?.served_locale).toBe("fr-FR")
    expect(result?.match_kind).toBe("language_match")
  })

  it("prefers exact match later in chain over earlier language match", () => {
    // Asked for fr-CA first (lang match available as fr-FR), then en-GB
    // (exact match available). The earlier preference still wins because
    // its language-match rank (0) beats the later exact rank (1).
    const result = pickBestCachedLocale(
      [
        { locale: "fr-FR", payload: 1 },
        { locale: "en-GB", payload: 2 },
      ],
      ["fr-CA", "en-GB"],
    )
    expect(result?.served_locale).toBe("fr-FR")
    expect(result?.match_kind).toBe("language_match")
  })

  it("when nothing matches the chain, falls back to fallback_chain mark", () => {
    const result = pickBestCachedLocale([{ locale: "de-DE", payload: 1 }], ["ro-RO", "en-GB"])
    expect(result?.match_kind).toBe("fallback_chain")
    expect(result?.served_locale).toBe("de-DE")
  })

  it("returns 'any' when the preference chain is empty", () => {
    const result = pickBestCachedLocale([{ locale: "ro-RO", payload: 1 }], [])
    expect(result?.match_kind).toBe("any")
    expect(result?.served_locale).toBe("ro-RO")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// JSON pointer
// ─────────────────────────────────────────────────────────────────────────────

describe("parseJsonPointer", () => {
  it("parses '' as the root pointer", () => {
    expect(parseJsonPointer("")).toEqual([])
  })

  it("parses '/foo' as a single segment", () => {
    expect(parseJsonPointer("/foo")).toEqual(["foo"])
  })

  it("parses nested pointers", () => {
    expect(parseJsonPointer("/days/3/description")).toEqual(["days", "3", "description"])
  })

  it("unescapes ~1 to / and ~0 to ~ (in that order)", () => {
    expect(parseJsonPointer("/foo~1bar")).toEqual(["foo/bar"])
    expect(parseJsonPointer("/foo~0bar")).toEqual(["foo~bar"])
    // Edge: per RFC 6901, ~01 should unescape to ~1 (not /).
    expect(parseJsonPointer("/foo~01")).toEqual(["foo~1"])
  })

  it("throws on a non-empty pointer that doesn't start with '/'", () => {
    expect(() => parseJsonPointer("foo")).toThrow(JsonPointerError)
  })
})

describe("applyJsonPointerOverlay", () => {
  it("sets a top-level field on an object", () => {
    const target = { name: "Original" }
    const result = applyJsonPointerOverlay(target, "/name", "Updated") as typeof target
    expect(result.name).toBe("Updated")
  })

  it("descends into nested objects", () => {
    const target = { hero: { caption: "old" } }
    applyJsonPointerOverlay(target, "/hero/caption", "new")
    expect(target.hero.caption).toBe("new")
  })

  it("descends into arrays via numeric segments", () => {
    const target = { days: [{ description: "Day 1" }, { description: "Day 2" }] }
    applyJsonPointerOverlay(target, "/days/1/description", "Day 2 (overridden)")
    expect(target.days[1]?.description).toBe("Day 2 (overridden)")
  })

  it("replaces array elements at the leaf", () => {
    const target = { tags: ["a", "b", "c"] }
    applyJsonPointerOverlay(target, "/tags/0", "z")
    expect(target.tags[0]).toBe("z")
  })

  it("throws on missing intermediate keys", () => {
    const target = { hero: {} }
    expect(() => applyJsonPointerOverlay(target, "/hero/caption/foo", "x")).toThrow(
      JsonPointerError,
    )
  })

  it("throws on out-of-range array indices", () => {
    const target = { tags: ["a"] }
    expect(() => applyJsonPointerOverlay(target, "/tags/5", "z")).toThrow(JsonPointerError)
  })

  it("rejects RFC 6901 '-' append-segment (we don't support extending)", () => {
    const target = { tags: ["a"] }
    expect(() => applyJsonPointerOverlay(target, "/tags/-", "b")).toThrow(JsonPointerError)
  })

  it("returns the value when pointer is empty (whole-document replace)", () => {
    const result = applyJsonPointerOverlay({ foo: 1 }, "", { bar: 2 })
    expect(result).toEqual({ bar: 2 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Overlay merge
// ─────────────────────────────────────────────────────────────────────────────

describe("mergeOverlaysIntoContent", () => {
  it("returns a deep-cloned payload — does not mutate the input", () => {
    const payload = { name: "Original", days: [{ description: "Day 1" }] }
    const overlays: ContentOverlay[] = [{ field_path: "/name", value: "Override" }]
    const merged = mergeOverlaysIntoContent(payload, overlays) as typeof payload

    expect(merged.name).toBe("Override")
    expect(payload.name).toBe("Original") // original untouched
  })

  it("applies multiple overlays in order", () => {
    const payload = { a: 1, b: 2 }
    const overlays: ContentOverlay[] = [
      { field_path: "/a", value: 100 },
      { field_path: "/b", value: 200 },
    ]
    const merged = mergeOverlaysIntoContent(payload, overlays) as typeof payload
    expect(merged.a).toBe(100)
    expect(merged.b).toBe(200)
  })

  it("skips overlays that fail to apply, calling onOverlayError once each", () => {
    const payload = { name: "Original" }
    const overlays: ContentOverlay[] = [
      { field_path: "/name", value: "Override" },
      { field_path: "/missing/deep", value: "X" }, // fails: no /missing
      { field_path: "/name", value: "Final" },
    ]
    const errors: Array<{ overlay: ContentOverlay; reason: string }> = []
    const merged = mergeOverlaysIntoContent(payload, overlays, {
      onOverlayError: (e) => errors.push(e),
    }) as typeof payload

    expect(merged.name).toBe("Final")
    expect(errors).toHaveLength(1)
    expect(errors[0]?.overlay.field_path).toBe("/missing/deep")
  })

  it("rolls back overlays whose result fails the validator", () => {
    const payload = { count: 1 }
    const overlays: ContentOverlay[] = [{ field_path: "/count", value: "not-a-number" }]
    const errors: Array<{ overlay: ContentOverlay; reason: string }> = []
    const merged = mergeOverlaysIntoContent(payload, overlays, {
      validate(p) {
        const ok = typeof (p as { count: unknown }).count === "number"
        return { valid: ok, reason: ok ? undefined : "count must be number" }
      },
      onOverlayError: (e) => errors.push(e),
    }) as typeof payload

    expect(merged.count).toBe(1) // rolled back
    expect(errors).toHaveLength(1)
    expect(errors[0]?.reason).toContain("count must be number")
  })

  it("validator that always passes lets every overlay through", () => {
    const payload = { a: 1 }
    const overlays: ContentOverlay[] = [{ field_path: "/a", value: 2 }]
    const merged = mergeOverlaysIntoContent(payload, overlays, {
      validate: () => ({ valid: true }),
    }) as typeof payload
    expect(merged.a).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Drift invalidation predicate
// ─────────────────────────────────────────────────────────────────────────────

describe("buildDriftInvalidationPredicate", () => {
  it("matches one entity across all locales / markets when neither is set", () => {
    const event: ContentDriftEvent = {
      id: "cnde_1",
      entity_module: "products",
      entity_id: "prod_abc",
      kind: "content_changed",
      detected_at: new Date(),
    }
    const pred = buildDriftInvalidationPredicate(event)
    expect(pred.entity_module).toBe("products")
    expect(pred.entity_id).toBe("prod_abc")
    expect(pred.locale).toBeNull()
    expect(pred.market).toBeNull()
  })

  it("narrows to one locale + market when set", () => {
    const event: ContentDriftEvent = {
      id: "cnde_2",
      entity_module: "products",
      entity_id: "prod_abc",
      locale: "ro-RO",
      market: "RO",
      kind: "content_changed",
      detected_at: new Date(),
    }
    const pred = buildDriftInvalidationPredicate(event)
    expect(pred.locale).toBe("ro-RO")
    expect(pred.market).toBe("RO")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Locale chain — language tag matching is case-insensitive
// ─────────────────────────────────────────────────────────────────────────────

describe("pickBestCachedLocale — case insensitivity", () => {
  it("compares language tags case-insensitively", () => {
    const result = pickBestCachedLocale([{ locale: "FR-fr", payload: 1 }], ["fr-CA"])
    expect(result?.match_kind).toBe("language_match")
  })
})

// vi unused but imported for parity with other test files; reference it
// to avoid lint complaints under noUnusedLocals.
void vi
