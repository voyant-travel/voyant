import { describe, expect, it } from "vitest"

import { personNameFromContact } from "../../src/service/accounts-resolve.js"

describe("personNameFromContact", () => {
  it("prefers explicit first/last when both are set", () => {
    expect(
      personNameFromContact({ firstName: "Alice", lastName: "Walker", email: "a@x.test" }),
    ).toEqual({ firstName: "Alice", lastName: "Walker" })
  })

  it("falls back to the single `name` split when first/last are blank", () => {
    expect(personNameFromContact({ name: "Marie  Curie", email: null })).toEqual({
      firstName: "Marie",
      lastName: "Curie",
    })
    expect(personNameFromContact({ name: "Cher" })).toEqual({
      firstName: "Cher",
      lastName: "Guest",
    })
  })

  it("treats empty-string fields as missing (whitespace stripped)", () => {
    expect(
      personNameFromContact({ firstName: " ", lastName: "", email: "robin@example.com" }),
    ).toEqual({ firstName: "robin", lastName: "Guest" })
  })

  it("issue #961 acceptance: never inserts the literal 'Unknown'; uses email local-part for firstName", () => {
    expect(personNameFromContact({ email: "alice.walker@example.com" })).toEqual({
      firstName: "alice walker",
      lastName: "Guest",
    })
  })

  it("falls back to 'Customer' / 'Guest' only when there's nothing else to use", () => {
    expect(personNameFromContact({})).toEqual({ firstName: "Customer", lastName: "Guest" })
  })
})
