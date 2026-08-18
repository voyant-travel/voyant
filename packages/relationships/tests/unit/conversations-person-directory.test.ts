import { describe, expect, it } from "vitest"

import { classifyDirectoryRows } from "../../src/runtime-contributor.js"

describe("Conversations Person directory", () => {
  it("returns none, unique, and exact ambiguity without choosing a Person", () => {
    expect(classifyDirectoryRows([], "email")).toEqual({ kind: "none" })
    expect(
      classifyDirectoryRows(
        [{ id: "contact_1", personRef: "person_1", address: "guest@example.test" }],
        "email",
      ),
    ).toEqual({
      kind: "unique",
      personRef: "person_1",
      contactPointRef: "contact_1",
      address: "guest@example.test",
      channel: "email",
    })
    expect(
      classifyDirectoryRows(
        [
          { id: "contact_1", personRef: "person_1", address: "+12025550100" },
          { id: "contact_2", personRef: "person_2", address: "+12025550100" },
        ],
        "sms",
      ),
    ).toEqual({ kind: "ambiguous" })
  })

  it("treats duplicate matching contact points on one Person as ambiguous", () => {
    expect(
      classifyDirectoryRows(
        [
          { id: "contact_1", personRef: "person_1", address: "guest@example.test" },
          { id: "contact_2", personRef: "person_1", address: "guest@example.test" },
        ],
        "email",
      ),
    ).toEqual({ kind: "ambiguous" })
  })

  it("rejects non-E.164 phone values instead of inventing a normalized identity", () => {
    expect(() =>
      classifyDirectoryRows(
        [{ id: "contact_1", personRef: "person_1", address: "+1 (202) 555-0100" }],
        "sms",
      ),
    ).toThrow(/normalized E\.164/)
  })
})
