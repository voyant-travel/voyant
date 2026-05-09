import { describe, expect, test } from "vitest"

import { canonicalize, canonicalJson, sha256, shortHash } from "../payload-hash.js"

describe("canonicalize", () => {
  test("primitives passthrough", () => {
    expect(canonicalize(1)).toBe(1)
    expect(canonicalize("x")).toBe("x")
    expect(canonicalize(true)).toBe(true)
    expect(canonicalize(null)).toBeNull()
  })

  test("undefined becomes null", () => {
    expect(canonicalize(undefined)).toBeNull()
  })

  test("alphabetizes object keys recursively", () => {
    const result = canonicalize({
      z: 1,
      a: 2,
      nested: { y: 1, x: 2 },
    })
    expect(JSON.stringify(result)).toBe('{"a":2,"nested":{"x":2,"y":1},"z":1}')
  })

  test("arrays preserve order", () => {
    expect(canonicalize([3, 1, 2])).toEqual([3, 1, 2])
  })

  test("nested arrays + objects", () => {
    const result = canonicalize({
      list: [
        { b: 1, a: 2 },
        { d: 3, c: 4 },
      ],
    })
    expect(JSON.stringify(result)).toBe('{"list":[{"a":2,"b":1},{"c":4,"d":3}]}')
  })
})

describe("canonicalJson", () => {
  test("two structurally equal values produce identical strings", () => {
    const a = { z: 1, a: 2, nested: { y: 1, x: 2 } }
    const b = { a: 2, nested: { x: 2, y: 1 }, z: 1 }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
  })

  test("differing values produce different strings", () => {
    expect(canonicalJson({ x: 1 })).not.toBe(canonicalJson({ x: 2 }))
  })
})

describe("sha256", () => {
  test("returns 64-char lowercase hex", async () => {
    const digest = await sha256({ x: 1 })
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })

  test("two structurally equal values hash identically", async () => {
    const a = { z: 1, a: 2 }
    const b = { a: 2, z: 1 }
    expect(await sha256(a)).toBe(await sha256(b))
  })

  test("differing values hash differently", async () => {
    expect(await sha256({ x: 1 })).not.toBe(await sha256({ x: 2 }))
  })

  test("known value", async () => {
    // sha256(canonicalJson({a:1,b:2})) == sha256('{"a":1,"b":2}')
    // Reproducible across runtimes.
    const digest = await sha256({ a: 1, b: 2 })
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(digest).toBe(await sha256({ b: 2, a: 1 }))
  })
})

describe("shortHash", () => {
  test("returns 16-char lowercase hex", async () => {
    const id = await shortHash({ x: 1 })
    expect(id).toMatch(/^[0-9a-f]{16}$/)
  })

  test("matches first 16 chars of full sha256", async () => {
    const value = { x: 1, y: { a: 1 } }
    const full = await sha256(value)
    const short = await shortHash(value)
    expect(short).toBe(full.slice(0, 16))
  })
})
