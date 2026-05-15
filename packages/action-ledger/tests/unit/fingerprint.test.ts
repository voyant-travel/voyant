import { describe, expect, test } from "vitest"

import {
  buildIdempotencyFingerprint,
  canonicalize,
  canonicalJson,
  sha256,
} from "../../src/fingerprint.js"

describe("canonicalize", () => {
  test("alphabetizes object keys recursively", () => {
    expect(
      canonicalize({
        z: 1,
        nested: { y: 2, x: 3 },
        a: [{ b: 1, a: 2 }],
      }),
    ).toEqual({
      a: [{ a: 2, b: 1 }],
      nested: { x: 3, y: 2 },
      z: 1,
    })
  })

  test("turns undefined into null", () => {
    expect(canonicalJson({ a: undefined })).toBe('{"a":null}')
  })
})

describe("sha256", () => {
  test("hashes structurally equivalent input identically", async () => {
    await expect(sha256({ z: 1, a: 2 })).resolves.toBe(await sha256({ a: 2, z: 1 }))
  })

  test("distinguishes different command input", async () => {
    const first = await buildIdempotencyFingerprint({
      actionName: "booking.cancel",
      actionVersion: "v1",
      targetType: "booking",
      targetId: "book_123",
      commandInput: { reason: "customer" },
    })
    const second = await buildIdempotencyFingerprint({
      actionName: "booking.cancel",
      actionVersion: "v1",
      targetType: "booking",
      targetId: "book_123",
      commandInput: { reason: "operator" },
    })

    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(first).not.toBe(second)
  })
})
