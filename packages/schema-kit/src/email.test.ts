import { describe, expect, it } from "vitest"
import { z } from "zod"

import { emailAddress, emailPattern } from "./email.js"

/**
 * The load-bearing claim of voyant#4598's fix is that swapping zod's default
 * email pattern for a lookaround-free one does not weaken validation. Assert it
 * against zod's default rather than against a hand-written expectation, so the
 * comparison stays honest if zod changes either pattern.
 */
const zodDefault = z.email()

const ACCEPTED = [
  "a@b.co",
  "john.doe+x@mail.example.com",
  "o'brien@x.io",
  "a_b@x.co",
  "A@B.CO",
  "a@b-c.io",
]

const REJECTED = [
  "",
  "plainstring",
  ".a@b.co",
  "a..b@c.io",
  "a.@b.co",
  "a@b",
  "a@.b.co",
  "a@b..co",
  "a b@c.co",
  "a@",
  "@b.co",
]

describe("emailAddress", () => {
  it("advertises a pattern with no regex lookaround", () => {
    // Round-trip through JSON: this is the document a transport serializes and
    // a client parses, not the in-memory payload type.
    const serialized: { properties: { email: { pattern: string } } } = JSON.parse(
      JSON.stringify(z.toJSONSchema(z.object({ email: emailAddress() }), { io: "input" })),
    )
    const { pattern } = serialized.properties.email
    expect(pattern).toBe(emailPattern.source)
    expect(/\((\?=|\?!|\?<=|\?<!)/.test(pattern)).toBe(false)
  })

  it("accepts every address zod's default accepts", () => {
    for (const value of ACCEPTED) {
      expect(zodDefault.safeParse(value).success, `${value} (zod default)`).toBe(true)
      expect(emailAddress().safeParse(value).success, value).toBe(true)
    }
  })

  it("rejects every address zod's default rejects", () => {
    for (const value of REJECTED) {
      expect(zodDefault.safeParse(value).success, `${value} (zod default)`).toBe(false)
      expect(emailAddress().safeParse(value).success, value).toBe(false)
    }
  })

  it("additionally accepts three forms RFC 5322 permits and zod's default does not", () => {
    for (const value of ['"quoted local"@x.co', "postmaster@[192.168.0.1]", "ünï@x.co"]) {
      expect(zodDefault.safeParse(value).success, `${value} (zod default)`).toBe(false)
      expect(emailAddress().safeParse(value).success, value).toBe(true)
    }
  })

  it("carries a caller-supplied error message", () => {
    const result = emailAddress("Enter a valid email address").safeParse("nope")
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Enter a valid email address")
  })

  it("chains string constraints", () => {
    const bounded = emailAddress().max(10)
    expect(bounded.safeParse("a@b.co").success).toBe(true)
    expect(bounded.safeParse("aaaaaaaaaa@b.co").success).toBe(false)
  })

  it("keeps trim-before-validate available through emailPattern", () => {
    const trimmed = z.string().trim().email({ pattern: emailPattern })
    expect(trimmed.safeParse(" a@b.co ").success).toBe(true)
    expect(trimmed.safeParse(" nope ").success).toBe(false)
  })
})
