import { describe, expect, it } from "vitest"

import { resolveInvalidationKeys } from "../../src/query-keys.js"

describe("resolveInvalidationKeys", () => {
  const map = (hint: { entity: string; id?: string }) =>
    hint.id
      ? [
          ["voyant", hint.entity, "list"],
          ["voyant", hint.entity, "detail", hint.id],
        ]
      : [["voyant", hint.entity, "list"]]

  it("maps a hint with an id to list + detail keys", () => {
    const keys = resolveInvalidationKeys(
      {
        event: "booking.confirmed",
        data: { event: "booking.confirmed", entity: "booking", id: "bk_1" },
      },
      map,
    )
    expect(keys).toEqual([
      ["voyant", "booking", "list"],
      ["voyant", "booking", "detail", "bk_1"],
    ])
  })

  it("maps a hint without an id to just the list key", () => {
    const keys = resolveInvalidationKeys(
      {
        event: "availability.slot.changed",
        data: { event: "availability.slot.changed", entity: "availability" },
      },
      map,
    )
    expect(keys).toEqual([["voyant", "availability", "list"]])
  })

  it("returns [] when the payload is not a recognisable hint", () => {
    expect(resolveInvalidationKeys({ event: "x", data: "not-a-hint" }, map)).toEqual([])
    expect(resolveInvalidationKeys({ event: "x", data: null }, map)).toEqual([])
    expect(resolveInvalidationKeys({ event: "x", data: { id: "1" } }, map)).toEqual([])
  })
})
